// server/services/security-scan/batch.ts
// 多站弱點檢查：有界併發、保留順序、單筆失敗隔離。一律 passive（批次沒有人可以在場驗證擁有權）。

import { runSecurityScan } from './scan'
import type { SecurityScanReport } from '../../../shared/types/security-scan'

export interface BatchScanRow {
  url: string
  status: 'ok' | 'error'
  score: number | null
  grade: string | null
  riskLevel: string | null
  finalUrl: string | null
  durationMs: number
  findings: number
  error: string | null
}
export interface BatchScanResult {
  results: BatchScanRow[]
  passed: number
  failed: number
  errors: number
}

export const MAX_BATCH_URLS = 20
const CONCURRENCY = 3

export async function runBatchSecurityScan(
  urls: string[],
  scan: typeof runSecurityScan = runSecurityScan,
): Promise<BatchScanResult> {
  const results: BatchScanRow[] = new Array(urls.length)
  let next = 0
  const worker = async () => {
    while (next < urls.length) {
      const index = next++
      const url = urls[index]!
      const started = Date.now()
      try {
        const report: SecurityScanReport = await scan({ url, profile: 'passive' })
        results[index] = {
          url, status: 'ok', score: report.score, grade: report.grade, riskLevel: report.riskLevel,
          finalUrl: report.finalUrl, durationMs: Date.now() - started,
          findings: report.findings.length, error: null,
        }
      } catch (error: any) {
        results[index] = {
          url, status: 'error', score: null, grade: null, riskLevel: null, finalUrl: null,
          durationMs: Date.now() - started, findings: 0,
          error: String(error?.message || error).slice(0, 200),
        }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker))
  return {
    results,
    passed: results.filter(row => row.status === 'ok' && (row.score ?? 0) >= 60).length,
    failed: results.filter(row => row.status === 'ok' && (row.score ?? 0) < 60).length,
    errors: results.filter(row => row.status === 'error').length,
  }
}
