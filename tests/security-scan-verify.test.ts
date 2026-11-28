import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  issueVerifyToken, verifyOwnershipFor, VERIFY_TTL_MS,
  type TokenStore, type VerifyTokenEntry,
} from '../server/services/security-scan/verify'
import { resolveTxt } from 'node:dns/promises'

function memoryStore(initial: VerifyTokenEntry[] = []): TokenStore & { items: VerifyTokenEntry[] } {
  const store = {
    items: [...initial],
    async read() { return [...store.items] },
    async write(entries: VerifyTokenEntry[]) { store.items = [...entries] },
  }
  return store
}

test('取得驗證碼會產生 dns/well-known 兩種放置方式，90 天效期', async () => {
  const store = memoryStore()
  const issued = await issueVerifyToken(7, 'https://example.com/app?x=1', { store, now: () => 1000 })
  assert.equal(issued.host, 'example.com')
  assert.equal(issued.dnsName, '_sealscan-verify.example.com')
  assert.equal(issued.dnsValue, `sealscan-verify=${issued.token}`)
  assert.equal(issued.wellKnownUrl, 'https://example.com/.well-known/sealscan-verify.txt')
  assert.equal(issued.expiresAt, new Date(1000 + VERIFY_TTL_MS).toISOString())
  assert.match(issued.token, /^sealscan-[0-9a-f]{32}$/)
  assert.equal(store.items.length, 1)
})

test('重新取得驗證碼會輪替舊 token 並清掉過期項目', async () => {
  const store = memoryStore([
    { token: 'sealscan-old', workspaceId: 7, host: 'example.com', createdAt: 1 },
    { token: 'sealscan-expired', workspaceId: 7, host: 'other.com', createdAt: 1 },
  ])
  const issued = await issueVerifyToken(7, 'https://example.com/', { store, now: () => 1000 + VERIFY_TTL_MS + 1 })
  assert.notEqual(issued.token, 'sealscan-old')
  assert.equal(store.items.length, 1)
  assert.equal(store.items[0]!.host, 'example.com')
})

test('DNS TXT 比對完整值或純 token，錯的工作區／host 不算', async () => {
  const store = memoryStore([{
    token: 'sealscan-abcdef0123456789abcdef0123456789', workspaceId: 7,
    host: 'example.com', createdAt: 1000,
  }])
  const token = store.items[0]!.token
  const resolve = (async (name: string) => {
    assert.equal(name, '_sealscan-verify.example.com')
    return [['sealscan-verify=' + token]]
  }) as unknown as typeof resolveTxt
  const input = { url: 'https://example.com/', profile: 'active_light' as const, verify: { method: 'dns-txt' as const, token } }
  assert.equal(await verifyOwnershipFor(input, 7, { store, resolveTxtFn: resolve, now: () => 1000 }), true)
  assert.equal(await verifyOwnershipFor(input, 8, { store, resolveTxtFn: resolve, now: () => 1000 }), false)
  assert.equal(await verifyOwnershipFor({ ...input, url: 'https://evil.com/' }, 7, { store, resolveTxtFn: resolve, now: () => 1000 }), false)
})

test('DNS TXT 值不符或過期時拒絕', async () => {
  const token = 'sealscan-abcdef0123456789abcdef0123456789'
  const store = memoryStore([{ token, workspaceId: 7, host: 'example.com', createdAt: 1000 }])
  const wrong = (async () => [['sealscan-verify=other']]) as unknown as typeof resolveTxt
  const input = { url: 'https://example.com/', profile: 'active_light' as const, verify: { method: 'dns-txt' as const, token } }
  assert.equal(await verifyOwnershipFor(input, 7, { store, resolveTxtFn: wrong, now: () => 1000 }), false)
  assert.equal(await verifyOwnershipFor(input, 7, {
    store, resolveTxtFn: wrong, now: () => 1000 + VERIFY_TTL_MS + 1,
  }), false)
})

test('well-known 只接受完全一致且 200 的內容，且用注入的 fetcher', async () => {
  const token = 'sealscan-abcdef0123456789abcdef0123456789'
  const store = memoryStore([{ token, workspaceId: 7, host: 'example.com', createdAt: 1000 }])
  const fetcher = async (url: string) => ({
    status: 200, headers: { 'content-type': 'text/plain' },
    body: url.endsWith('/.well-known/sealscan-verify.txt') ? token + '\n' : '',
    elapsed: 1, finalUrl: url, redirectChain: [],
  })
  const input = { url: 'https://example.com/', profile: 'active_light' as const, verify: { method: 'well-known' as const, token } }
  assert.equal(await verifyOwnershipFor(input, 7, { store, fetcher, now: () => 1000 }), true)
  const badFetcher = async (url: string) => ({ status: 200, headers: {}, body: token + '-extra', elapsed: 1, finalUrl: url })
  assert.equal(await verifyOwnershipFor(input, 7, { store, fetcher: badFetcher, now: () => 1000 }), false)
})

test('private / 含帳密的 URL 不能取得驗證碼', async () => {
  const store = memoryStore()
  await assert.rejects(issueVerifyToken(7, 'http://192.168.1.1/', { store, now: () => 1000 }))
  await assert.rejects(issueVerifyToken(7, 'https://user:pass@example.com/', { store, now: () => 1000 }))
  assert.equal(store.items.length, 0)
})
