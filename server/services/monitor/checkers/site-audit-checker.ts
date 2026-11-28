// 排程版網站健檢：沿用 on-demand audit 引擎，把分數寫成心跳（ping=score），
// 三角判定由操作者設定（minScore，預設 60）。不新增資料表。
import { z } from 'zod'
import type { CheckResult } from '../checker'
import { runSiteAudit, type AuditReport } from '../../site-audit/audit'

export const siteAuditConfigSchema = z.object({
  url: z.string().url().max(8192).optional(),
  keyword: z.string().min(1).max(200).optional(),
  minScore: z.number().int().min(0).max(100).default(60),
}).strict()

export interface SiteAuditCheckDeps { audit: (input: { url: string; keyword?: string }) => Promise<AuditReport> }

export async function checkSiteAudit(
  monitor: any,
  startTime: number,
  signal?: AbortSignal,
  deps: SiteAuditCheckDeps = { audit: runSiteAudit },
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
