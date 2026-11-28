// server/services/security-scan/verify.ts
// 擁有權驗證（參考 ai-security-monitor webscan 的 dns-txt／well-known，效期 90 天）。
// token 存在既有 Setting 表（key = securityScan.verifyTokens），不需要 migration。
// 只比對「完全相等」的 token；private/metadata 目標由 fetcher／DNS guard 阻擋。

import { randomBytes } from 'node:crypto'
import { resolveTxt } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { SecurityScanInput } from '../../../shared/types/security-scan'
import { prisma } from '../../utils/prisma'
import { isForbiddenAddress } from '../monitor/checkers/http-request'
import type { AuditFetcher } from '../site-audit/audit'
import { defaultAuditFetcher } from '../site-audit/audit'

const STORE_KEY = 'securityScan.verifyTokens'
export const VERIFY_TTL_MS = 90 * 24 * 60 * 60 * 1000
export const VERIFY_DNS_PREFIX = '_sealscan-verify'
export const VERIFY_WELL_KNOWN = '/.well-known/sealscan-verify.txt'

export interface VerifyTokenEntry {
  token: string
  workspaceId: number
  host: string
  createdAt: number
}

export interface TokenStore {
  read(): Promise<VerifyTokenEntry[]>
  write(entries: VerifyTokenEntry[]): Promise<void>
}

export const prismaTokenStore: TokenStore = {
  async read() {
    const row = await prisma.setting.findUnique({ where: { key: STORE_KEY }, select: { value: true } })
    if (!row?.value) return []
    try {
      const parsed: unknown = JSON.parse(row.value)
      return Array.isArray(parsed) ? parsed.filter(isEntry).slice(0, 200) : []
    } catch { return [] }
  },
  async write(entries) {
    await prisma.setting.upsert({
      where: { key: STORE_KEY },
      update: { value: JSON.stringify(entries.slice(-200)), type: 'string' },
      create: { key: STORE_KEY, value: JSON.stringify(entries.slice(-200)), type: 'string' },
    })
  },
}

function isEntry(value: unknown): value is VerifyTokenEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Partial<VerifyTokenEntry>
  return typeof entry.token === 'string' && typeof entry.host === 'string'
    && Number.isSafeInteger(entry.workspaceId) && typeof entry.createdAt === 'number'
}

export function normalizedHostname(inputUrl: string): string {
  const url = new URL(inputUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('INVALID_URL')
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (!host || ['localhost', 'metadata.google.internal', 'metadata.google', 'instance-data.ec2.internal', 'metadata.azure.internal'].includes(host)) throw new Error('DESTINATION_DENIED')
  if (isIP(host) && isForbiddenAddress(host, false)) throw new Error('DESTINATION_DENIED')
  return host
}

export interface IssuedVerifyToken {
  token: string
  host: string
  dnsName: string
  dnsValue: string
  wellKnownUrl: string
  expiresAt: string
}

export async function issueVerifyToken(
  workspaceId: number, inputUrl: string,
  deps: { store?: TokenStore; now?: () => number } = {},
): Promise<IssuedVerifyToken> {
  const store = deps.store || prismaTokenStore
  const now = (deps.now || Date.now)()
  const host = normalizedHostname(inputUrl)
  if (!host) throw new Error('INVALID_URL')
  const token = `sealscan-${randomBytes(16).toString('hex')}`
  const kept = (await store.read()).filter(entry =>
    !(entry.workspaceId === workspaceId && entry.host === host) && now - entry.createdAt < VERIFY_TTL_MS)
  kept.push({ token, workspaceId, host, createdAt: now })
  await store.write(kept)
  return {
    token, host,
    dnsName: `${VERIFY_DNS_PREFIX}.${host}`,
    dnsValue: `sealscan-verify=${token}`,
    wellKnownUrl: new URL(VERIFY_WELL_KNOWN, inputUrl).href,
    expiresAt: new Date(now + VERIFY_TTL_MS).toISOString(),
  }
}

export interface VerifyDeps {
  store?: TokenStore
  resolveTxtFn?: typeof resolveTxt
  fetcher?: AuditFetcher
  now?: () => number
}

/** 只回 true 代表 token 有效且目標上確實放著同一組 token。任何錯誤都當作未驗證。 */
export async function verifyOwnershipFor(
  input: SecurityScanInput, workspaceId: number, deps: VerifyDeps = {},
): Promise<boolean> {
  if (!input.verify?.token || !['dns-txt', 'well-known'].includes(input.verify.method)) return false
  const store = deps.store || prismaTokenStore
  const now = (deps.now || Date.now)()
  let host: string
  try { host = normalizedHostname(input.url) } catch { return false }
  const entry = (await store.read()).find(candidate =>
    candidate.workspaceId === workspaceId && candidate.host === host
    && candidate.token === input.verify!.token && now - candidate.createdAt < VERIFY_TTL_MS)
  if (!entry) return false

  try {
    if (input.verify.method === 'dns-txt') {
      const resolve = deps.resolveTxtFn || resolveTxt
      const records = await resolve(`${VERIFY_DNS_PREFIX}.${host}`)
      return records.some(parts => {
        const value = parts.join('')
        return value === entry.token || value === `sealscan-verify=${entry.token}`
      })
    }
    const fetcher = deps.fetcher || defaultAuditFetcher
    const response = await fetcher(new URL(VERIFY_WELL_KNOWN, input.url).href, 'GET')
    return response.status === 200 && response.body.trim() === entry.token
  } catch { return false }
}
