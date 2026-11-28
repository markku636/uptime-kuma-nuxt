import { runSiteAudit, type AuditReport, type AuditInput } from './audit'

export interface BatchAuditRow {
  url: string
  status: 'ok' | 'error'
  score: number | null
  grade: string | null
  finalUrl: string | null
  durationMs: number
  failedChecks: string[]
  error: string | null
}
export interface BatchAuditResult { results: BatchAuditRow[]; passed: number; failed: number; errors: number }

const CONCURRENCY = 3

/** 有界併發；單一 URL 失敗不影響其他筆，也不丟原始順序。 */
export async function runBatchAudit(
  urls: string[],
  keyword: string | undefined,
  audit: (input: AuditInput) => Promise<AuditReport> = runSiteAudit,
  concurrency = CONCURRENCY,
  checks?: AuditInput['checks'],
): Promise<BatchAuditResult> {
  const limit = Math.max(1, Math.min(5, concurrency))
  const rows: BatchAuditRow[] = new Array(urls.length)
  let cursor = 0
  const worker = async (): Promise<void> => {
    while (cursor < urls.length) {
      const index = cursor++
      const url = urls[index]!
      try {
        const report = await audit({ url, ...(keyword ? { keyword } : {}), ...(checks ? { checks } : {}) })
        rows[index] = {
          url, status: 'ok', score: report.score, grade: report.grade,
          finalUrl: report.finalUrl, durationMs: report.durationMs,
          failedChecks: report.checks.filter(check => check.status === 'fail').map(check => check.id),
          error: null,
        }
      } catch (error: any) {
        rows[index] = {
          url, status: 'error', score: null, grade: null, finalUrl: null, durationMs: 0,
          failedChecks: [], error: String(error?.message || error).slice(0, 200),
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, urls.length) }, worker))
  return {
    results: rows,
    passed: rows.filter(row => row.status === 'ok' && row.failedChecks.length === 0).length,
    failed: rows.filter(row => row.status === 'ok' && row.failedChecks.length > 0).length,
    errors: rows.filter(row => row.status === 'error').length,
  }
}
