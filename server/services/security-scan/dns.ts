// server/services/security-scan/dns.ts
// DNS 建議檢查：只有該 host 有 MX（確實收／寄信）時才要求 SPF／DMARC，
// 避免把不寄信的網站（例如 uptime 後台）誤判為弱點。全部為被動 DNS 查詢，不打第三方。

import { lookup, resolveMx, resolveTxt } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { SecurityFinding } from '../../../shared/types/security-scan'
import { isForbiddenAddress } from '../monitor/checkers/http-request'

type FindingInput = Omit<SecurityFinding, 'key'>

export interface DnsDeps {
  lookupFn?: typeof lookup
  resolveTxtFn?: typeof resolveTxt
  resolveMxFn?: typeof resolveMx
}

export async function dnsFindings(
  host: string, url: string, deps: DnsDeps,
): Promise<{ findings: FindingInput[]; warnings: string[] }> {
  const lookupFn = deps.lookupFn || lookup
  const resolveTxtFn = deps.resolveTxtFn || resolveTxt
  const resolveMxFn = deps.resolveMxFn || resolveMx
  const warnings: string[] = []
  const addresses = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookupFn(host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address, false))) {
    return { findings: [], warnings: ['DNS_SKIPPED: destination denied'] }
  }

  let mx: Awaited<ReturnType<typeof resolveMx>> = []
  try { mx = await resolveMxFn(host) } catch { mx = [] }
  if (!mx.length) {
    // 沒有 MX 就沒有寄信身分可驗證，SPF／DMARC 不適用。
    return { findings: [], warnings: ['DNS_MAIL_SKIPPED: no MX records'] }
  }

  const txt = async (name: string): Promise<string[]> => {
    try { return (await resolveTxtFn(name)).map(parts => parts.join('')) } catch { return [] }
  }
  const findings: FindingInput[] = []
  const spf = (await txt(host)).find(value => /^v=spf1\b/i.test(value))
  if (!spf) findings.push({
    rule: 'dns.spf.missing', category: 'dns', severity: 'low',
    title: '未發現 SPF 記錄', detail: `${host} 有 MX 但沒有 v=spf1 TXT 記錄。`,
    recommendation: '為寄信網域發布 SPF 記錄，降低冒名寄信風險。',
    location: { url, host }, evidence: { host }, cwe: [],
    refs: ['https://datatracker.ietf.org/doc/html/rfc7208'], tags: ['passive', 'dns'],
  })
  const dmarc = (await txt(`_dmarc.${host}`)).find(value => /^v=dmarc1\b/i.test(value))
  if (!dmarc) findings.push({
    rule: 'dns.dmarc.missing', category: 'dns', severity: 'medium',
    title: '未發現 DMARC 記錄', detail: `_dmarc.${host} 沒有 v=DMARC1 TXT 記錄。`,
    recommendation: '先發布 SPF／DKIM，再逐步启用 DMARC（p=none 起步）。',
    location: { url, host }, evidence: { host }, cwe: [],
    refs: ['https://datatracker.ietf.org/doc/html/rfc7489'], tags: ['passive', 'dns'],
  })
  return { findings, warnings }
}
