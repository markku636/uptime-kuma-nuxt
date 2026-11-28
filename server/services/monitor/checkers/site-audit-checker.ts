// 排程版網站健檢：沿用 on-demand audit 引擎，把分數寫成心跳（ping=score），
// 並把去敏感報告寫入既有 visualCheckArtifact（不新增資料表）。
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { CheckResult } from '../checker'
import { runSiteAudit, type AuditReport } from '../../site-audit/audit'
import { workerPrisma } from '../../../utils/worker-prisma'

export const siteAuditConfigSchema = z.object({
  url: z.string().url().max(8192).optional(),
  keyword: z.string().min(1).max(200).optional(),
  minScore: z.number().int().min(0).max(100).default(60),
}).strict()

export interface SiteAuditCheckDeps {
  audit: (input: { url: string; keyword?: string }) => Promise<AuditReport>
  saveReport?: (monitorId: number, report: AuditReport) => Promise<void>
}

const URL_PATTERN = /https?:\/\/[^\s)）"'，,]+/gi

/** 報告可含使用者輸入的 URL（可能帶 token）；只保留 origin + pathname。 */
export function redactAuditReport(report: AuditReport): AuditReport {
  const clean = (value: string): string => value.replace(URL_PATTERN, raw => {
    try { const url = new URL(raw); return `${url.origin}${url.pathname}` } catch { return '[redacted-url]' }
  })
  return {
    ...report,
    url: clean(report.url), finalUrl: clean(report.finalUrl),
    checkedAt: report.checkedAt, durationMs: report.durationMs,
    checks: report.checks.map(check => ({
      ...check, summary: clean(check.summary), detail: check.detail?.map(clean),
    })),
  }
}

const MAX_REPORTS = 20
const defaultSaveReport: NonNullable<SiteAuditCheckDeps['saveReport']> = async (monitorId, report) => {
  const where = { monitorId, viewportLabel: 'audit-report' }
  const existing = await workerPrisma.visualCheckArtifact.findMany({
    where, orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }], take: MAX_REPORTS, select: { id: true },
  })
  if (existing.length >= MAX_REPORTS) {
    await workerPrisma.visualCheckArtifact.deleteMany({ where: { ...where, id: { in: existing.slice(MAX_REPORTS - 1).map(row => row.id) } } })
  }
  await workerPrisma.visualCheckArtifact.create({ data: {
    monitorId, viewportLabel: 'audit-report', status: 1, currentImage: null, diffImage: null,
    metrics: redactAuditReport(report) as unknown as Prisma.InputJsonValue,
  } })
}

export async function checkSiteAudit(
  monitor: any,
  startTime: number,
  signal?: AbortSignal,
  deps: SiteAuditCheckDeps = { audit: runSiteAudit, saveReport: defaultSaveReport },
): Promise<CheckResult> {
  let config: z.infer<typeof siteAuditConfigSchema>
  try { config = siteAuditConfigSchema.parse(typeof monitor.body === 'string' ? JSON.parse(monitor.body) : monitor.body || {}) }
  catch { return { status: 0, ping: Date.now() - startTime, code: 'CONFIG_ERROR', msg: 'Invalid site-audit configuration' } }
  const target = config.url || monitor.url
  if (!target) return { status: 0, ping: Date.now() - startTime, code: 'CONFIG_ERROR', msg: 'URL is required for site-audit monitors' }
  if (signal?.aborted) return { status: 0, ping: Date.now() - startTime, code: 'ABORTED', msg: 'Check aborted' }

  try {
    const report = await deps.audit({ url: target, ...(config.keyword ? { keyword: config.keyword } : {}) })
    if (signal?.aborted) return { status: 0, ping: Date.now() - startTime, code: 'ABORTED', msg: 'Check aborted' }
    if (!monitor.includeTrialResponse && monitor.id && deps.saveReport) {
      try { await deps.saveReport(monitor.id, report) } catch { /* 報告保存失敗不影響判定 */ }
    }
    const up = report.score >= config.minScore
    const failures = report.checks.filter(check => check.status === 'fail').map(check => check.id)
    return {
      status: up ? 1 : 0,
      // ping 在 site-audit 代表分數（0–100），不是毫秒。
      ping: report.score,
      code: up ? 'AUDIT_OK' : 'AUDIT_LOW',
      msg: `Audit ${report.score}/100 (${report.grade})${failures.length ? ` · fail: ${failures.join(',')}` : ''}`,
    }
  } catch (error: any) {
    return { status: 0, ping: Date.now() - startTime, code: 'AUDIT_ERROR', msg: String(error?.message || error).slice(0, 200) }
  }
}
