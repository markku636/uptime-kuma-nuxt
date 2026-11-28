// 排程版弱點檢查：分數寫進心跳（ping=score），去敏感報告寫入既有 visualCheckArtifact，
// 不新增資料表、不發額外通知（沿用既有 DOWN／UP 通知）。
// 排程永遠用 passive：active_light 需要擁有權 token 與即得驗證，不適合沒有人員在場的背景工作。
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import type { CheckResult } from '../checker'
import { runSecurityScan } from '../../security-scan/scan'
import type { SecurityScanReport, SecurityRule } from '../../../../shared/types/security-scan'
import { SECURITY_SCAN_CATEGORIES } from '../../../../shared/types/security-scan'
import { workerPrisma } from '../../../utils/worker-prisma'

const categorySchema = z.object(Object.fromEntries(
  SECURITY_SCAN_CATEGORIES.map(id => [id, z.boolean().optional()]),
) as Record<typeof SECURITY_SCAN_CATEGORIES[number], z.ZodOptional<z.ZodBoolean>>).strict()

export const securityScanConfigSchema = z.object({
  url: z.string().url().max(8192).optional(),
  minScore: z.number().int().min(0).max(100).default(60),
  categories: categorySchema.optional(),
}).strict()

export interface SecurityScanCheckDeps {
  scan: (input: { url: string; categories?: Record<string, boolean | undefined> }, options?: { rules?: SecurityRule[] }) => Promise<SecurityScanReport>
  saveReport?: (monitorId: number, report: SecurityScanReport) => Promise<void>
}

const URL_PATTERN = /https?:\/\/[^\s)）"'，,]+/gi

/** 報告可能含使用者輸入的 URL（query/fragment 可能有 token）；只留 origin + pathname。 */
export function redactSecurityReport(report: SecurityScanReport): SecurityScanReport {
  const clean = (value: string): string => value.replace(URL_PATTERN, raw => {
    try { const url = new URL(raw); return `${url.origin}${url.pathname}` } catch { return '[redacted-url]' }
  })
  return {
    ...report,
    url: clean(report.url), finalUrl: clean(report.finalUrl),
    findings: report.findings.map(finding => ({
      ...finding,
      detail: clean(finding.detail),
      location: {
        ...(finding.location.url ? { url: clean(finding.location.url) } : {}),
        ...(finding.location.host ? { host: clean(finding.location.host) } : {}),
        ...(finding.location.param ? { param: clean(finding.location.param) } : {}),
      },
    })),
    warnings: report.warnings.map(clean),
    fingerprint: { ...report.fingerprint, finalUrl: clean(report.fingerprint.finalUrl), title: report.fingerprint.title ? clean(report.fingerprint.title) : null },
  }
}

const MAX_REPORTS = 20
const defaultSaveReport: NonNullable<SecurityScanCheckDeps['saveReport']> = async (monitorId, report) => {
  const where = { monitorId, viewportLabel: 'security-report' }
  const existing = await workerPrisma.visualCheckArtifact.findMany({
    where, orderBy: [{ checkedAt: 'desc' }, { id: 'desc' }], take: MAX_REPORTS, select: { id: true },
  })
  if (existing.length >= MAX_REPORTS) {
    await workerPrisma.visualCheckArtifact.deleteMany({ where: { ...where, id: { in: existing.slice(MAX_REPORTS - 1).map(row => row.id) } } })
  }
  await workerPrisma.visualCheckArtifact.create({ data: {
    monitorId, viewportLabel: 'security-report', status: 1, currentImage: null, diffImage: null,
    metrics: redactSecurityReport(report) as unknown as Prisma.InputJsonValue,
  } })
}

export async function checkSecurityScan(
  monitor: any,
  startTime: number,
  signal?: AbortSignal,
  deps: SecurityScanCheckDeps = { scan: (input, options) => runSecurityScan(input, options || {}), saveReport: defaultSaveReport },
): Promise<CheckResult> {
  let config: z.infer<typeof securityScanConfigSchema>
  try { config = securityScanConfigSchema.parse(typeof monitor.body === 'string' ? JSON.parse(monitor.body) : monitor.body || {}) }
  catch { return { status: 0, ping: Date.now() - startTime, code: 'CONFIG_ERROR', msg: 'Invalid security-scan configuration' } }
  const target = config.url || monitor.url
  if (!target) return { status: 0, ping: Date.now() - startTime, code: 'CONFIG_ERROR', msg: 'URL is required for security-scan monitors' }
  if (signal?.aborted) return { status: 0, ping: Date.now() - startTime, code: 'ABORTED', msg: 'Check aborted' }

  try {
    let rules: SecurityRule[] = []
    try {
      const rows = await workerPrisma.securityRule.findMany({ where: { workspaceId: monitor.workspaceId, active: true }, take: 100 })
      rules = rows.map(row => ({
        key: row.key, source: row.source as SecurityRule['source'], sourceUrl: row.sourceUrl, product: row.product,
        signature: row.signature, ...(row.maxVersion ? { maxVersion: row.maxVersion } : {}),
        severity: row.severity as SecurityRule['severity'], title: row.title, detail: row.detail,
        recommendation: row.recommendation,
        refs: Array.isArray(row.refs) ? row.refs as string[] : [],
        cwe: Array.isArray(row.cwe) ? row.cwe as string[] : [],
        active: row.active,
      }))
    } catch { /* 規則庫讀取失敗時仍執行內建掃描 */ }
    const report = await deps.scan({ url: target, ...(config.categories ? { categories: config.categories } : {}) }, { rules })
    if (signal?.aborted) return { status: 0, ping: Date.now() - startTime, code: 'ABORTED', msg: 'Check aborted' }
    if (!monitor.includeTrialResponse && monitor.id && deps.saveReport) {
      try { await deps.saveReport(monitor.id, report) } catch { /* 報告保存失敗不影響判定 */ }
    }
    const up = report.score >= config.minScore
    const top = report.findings[0]
    return {
      status: up ? 1 : 0,
      // ping 在 security-scan 代表分數（0–100），不是毫秒。
      ping: report.score,
      code: up ? 'SCAN_OK' : 'SCAN_LOW',
      msg: `Scan ${report.score}/100 (${report.grade}) · ${report.riskLevel} · ${report.findings.length} findings${top ? ` · top: ${top.title}` : ''}`,
    }
  } catch (error: any) {
    return { status: 0, ping: Date.now() - startTime, code: 'SCAN_ERROR', msg: String(error?.message || error).slice(0, 200) }
  }
}
