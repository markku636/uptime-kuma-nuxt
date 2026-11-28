// shared/types/security-scan.ts — 網站弱點／滲透檢查（參考 ai-security-monitor webscan 的 finding 格式）

/** 被動檢查只發出與一般瀏覽器相近的請求；active_light 需先驗證擁有權。 */
export const SECURITY_SCAN_PROFILES = ['passive', 'active_light'] as const
export type SecurityScanProfile = (typeof SECURITY_SCAN_PROFILES)[number]

export const SECURITY_SCAN_SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'] as const
export type SecurityScanSeverity = (typeof SECURITY_SCAN_SEVERITIES)[number]

export const SECURITY_SCAN_CATEGORIES = ['fingerprint', 'headers', 'cookies', 'tls', 'dns', 'redirect', 'exposure', 'vulnerabilities'] as const
export type SecurityScanCategory = (typeof SECURITY_SCAN_CATEGORIES)[number]

export interface SecurityFinding {
  /** 同一份報告內的去重鍵（rule + 位置 + 參數）。 */
  key: string
  /** 規則 id，例如 `headers.csp.missing`。 */
  rule: string
  category: SecurityScanCategory
  severity: SecurityScanSeverity
  title: string
  detail: string
  recommendation: string
  location: { url?: string; host?: string; param?: string }
  evidence: Record<string, string | number | boolean | null>
  cwe: string[]
  /** 外部參考（CVE / OWASP / MDN）；只放公開文件連結，不對第三方發出請求。 */
  refs: string[]
  tags: string[]
}

export interface SecurityScanFingerprint {
  status: number | null
  title: string | null
  server: string | null
  technologies: string[]
  finalUrl: string
  redirects: number
}

export interface SecurityScanReport {
  url: string
  finalUrl: string
  host: string
  profile: SecurityScanProfile
  checkedAt: string
  durationMs: number
  /** 0–100，100 代表沒有發現；依嚴重度扣分。 */
  score: number
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  riskLevel: SecurityScanSeverity | 'none'
  findings: SecurityFinding[]
  fingerprint: SecurityScanFingerprint
  warnings: string[]
  limits: { maxProbes: number; probesUsed: number; maxFindings: number }
}

export interface SecurityScanInput {
  url: string
  profile?: SecurityScanProfile
  verify?: { method: 'dns-txt' | 'well-known'; token: string }
  /** 可關閉個別類別；預設全部開啟。 */
  categories?: Partial<Record<SecurityScanCategory, boolean>>
  /** 主動探測的路徑上限（0–6，伺服器端會夾制）。 */
  maxProbes?: number
}

/** 漏洞規則可由使用者維護；source/sourceUrl 顯示在規則清單與掃描報告，便於追溯。 */
export const SECURITY_RULE_SOURCES = ['NVD', 'OWASP', 'CISA KEV', 'GitHub Advisory', 'Custom'] as const
export type SecurityRuleSource = typeof SECURITY_RULE_SOURCES[number]

export interface SecurityRule {
  key: string
  source: SecurityRuleSource
  sourceUrl: string
  product: string
  /** 出現在 header／HTML 的可見字串；只做大小寫不敏感的字串比對，不執行正則。 */
  signature: string
  /** 比對到的版本 <= 此值才通報；空值表示只做資訊提示。 */
  maxVersion?: string
  severity: SecurityScanSeverity
  title: string
  detail: string
  recommendation: string
  refs: string[]
  cwe: string[]
  active?: boolean
  id?: number
  updatedAt?: string
}
