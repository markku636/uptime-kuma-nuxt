// 失敗调查證據包：把分散的 heartbeat／TLS／健檢報告／失敗截圖／通知紀錄
// 彙整成一份可下載、不含 secret 的 JSON，供值班或 agent 判斷。
import { prisma } from '../../utils/prisma'

export interface InvestigationBundle {
  generatedAt: string
  monitor: { id: number; name: string; type: string; active: boolean; interval: number; urlHost: string | null }
  latest: { status: number; checkCode: string | null; time: string | null; ping: number } | null
  heartbeats: Array<{ time: string; status: number; checkCode: string | null; ping: number; important: boolean }>
  tls: { daysRemaining: number; issuer: string; validTo: string; valid: boolean } | null
  auditReports: Array<{ checkedAt: string; score: number | null; grade: string | null; failedChecks: string[] }>
  browserEvidence: { available: boolean; checkedAt: string | null; metrics: unknown; endpoint: string }
  notifications: Array<{ eventType: string; status: string; attempts: number; errorCode: string | null; createdAt: string }>
  agentHint: string
}

const LIMITS = { heartbeats: 50, auditReports: 5, notifications: 20 }

export async function buildInvestigationBundle(
  monitorId: number,
  workspaceId: number,
  environmentId: number,
  db: any = prisma,
): Promise<InvestigationBundle | null> {
  const monitor = await db.monitor.findFirst({
    where: { id: monitorId, workspaceId, environmentId },
    select: { id: true, name: true, type: true, active: true, interval: true, url: true, tlsInfo: true },
  })
  if (!monitor) return null

  const [beats, audits, evidence, notifications] = await Promise.all([
    db.heartbeat.findMany({
      where: { monitorId }, orderBy: [{ time: 'desc' }, { id: 'desc' }], take: LIMITS.heartbeats,
      select: { time: true, status: true, checkCode: true, ping: true, important: true },
    }),
    db.visualCheckArtifact.findMany({
      where: { monitorId, viewportLabel: 'audit-report' }, orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
      take: LIMITS.auditReports, select: { checkedAt: true, metrics: true },
    }),
    db.visualCheckArtifact.findFirst({
      where: { monitorId, viewportLabel: 'flow-fail' }, orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }],
      select: { checkedAt: true, metrics: true },
    }),
    db.notificationOutbox.findMany({
      where: { monitorId }, orderBy: { id: 'desc' }, take: LIMITS.notifications,
      select: { eventType: true, status: true, attempts: true, errorCode: true, createdAt: true },
    }),
  ])

  let host: string | null = null
  try { host = monitor.url ? new URL(monitor.url).hostname : null } catch { host = null }
  const tls: any = monitor.tlsInfo
  const tlsInfo = tls && typeof tls === 'object' && Number.isFinite(Number(tls.daysRemaining)) ? {
    daysRemaining: Number(tls.daysRemaining), issuer: String(tls.issuer || '').slice(0, 200),
    validTo: tls.validTo instanceof Date ? tls.validTo.toISOString() : String(tls.validTo || ''),
    valid: tls.valid === true,
  } : null
  const latest = beats[0] ? {
    status: beats[0].status, checkCode: beats[0].checkCode, time: beats[0].time.toISOString(), ping: beats[0].ping || 0,
  } : null
  const agentHint = [
    `Monitor #${monitor.id} (${monitor.name}, ${monitor.type})`,
    latest ? `Latest: ${latest.checkCode || 'UNKNOWN'} at ${latest.time} (ping/score ${latest.ping})` : 'No heartbeat yet',
    `Recent DOWN count: ${beats.filter((row: any) => row.status === 0).length}/${beats.length}`,
    tlsInfo ? `TLS: ${tlsInfo.daysRemaining} days left, valid=${tlsInfo.valid}` : 'No cached TLS info',
    `Alert delivery: ${notifications.filter((row: any) => row.status !== 'delivered').length} undelivered`,
  ].join('\n')

  return {
    generatedAt: new Date().toISOString(),
    monitor: { id: monitor.id, name: monitor.name, type: monitor.type, active: monitor.active, interval: monitor.interval, urlHost: host },
    latest,
    heartbeats: beats.map((row: any) => ({ time: row.time.toISOString(), status: row.status, checkCode: row.checkCode, ping: row.ping || 0, important: row.important })),
    tls: tlsInfo,
    auditReports: audits.map((row: any) => {
      const metrics: any = row.metrics
      return {
        checkedAt: row.checkedAt.toISOString(), score: Number.isFinite(metrics?.score) ? Number(metrics.score) : null,
        grade: typeof metrics?.grade === 'string' ? metrics.grade : null,
        failedChecks: Array.isArray(metrics?.checks) ? metrics.checks.filter((check: any) => check?.status === 'fail').map((check: any) => String(check.id)) : [],
      }
    }),
    browserEvidence: {
      available: !!evidence, checkedAt: evidence ? evidence.checkedAt.toISOString() : null,
      metrics: evidence?.metrics ?? null, endpoint: `/api/v1/monitors/${monitor.id}/visual-artifacts`,
    },
    notifications: notifications.map((row: any) => ({
      eventType: row.eventType, status: row.status, attempts: row.attempts,
      errorCode: row.errorCode, createdAt: row.createdAt.toISOString(),
    })),
    agentHint,
  }
}
