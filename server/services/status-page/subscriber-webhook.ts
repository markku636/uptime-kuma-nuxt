// Webhook 訂閱者：目的地位址加密存放，投遞前重新驗證 public destination。
import { resolveDestination } from '../monitor/checkers/http-request'
import { encryptSecret, decryptSecret } from '../../utils/variables'

export function subscriberSecretContext(workspaceId: number, statusPageId: number): string {
  return `${workspaceId}:status-subscriber:${statusPageId}`
}

export function sealSubscriberUrl(raw: string, workspaceId: number, statusPageId: number): string {
  return encryptSecret(raw, subscriberSecretContext(workspaceId, statusPageId))
}

export function openSubscriberUrl(sealed: string | null, workspaceId: number, statusPageId: number): string | null {
  if (!sealed) return null
  try { return decryptSecret(sealed, subscriberSecretContext(workspaceId, statusPageId)) } catch { return null }
}

export async function assertPublicWebhook(raw: string): Promise<URL> {
  let url: URL
  try { url = new URL(raw) } catch { throw new Error('INVALID_URL') }
  if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 2048 || url.username || url.password) throw new Error('DESTINATION_DENIED')
  await resolveDestination(url, AbortSignal.timeout(5000), false)
  return url
}

export async function sendSubscriberWebhook(raw: string, payload: unknown): Promise<void> {
  const url = await assertPublicWebhook(raw)
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'SealWatch-StatusSubscriber/1.0' },
    body: JSON.stringify(payload).slice(0, 64 * 1024),
    signal: AbortSignal.timeout(10_000),
    redirect: 'error',
  })
  if (!response.ok) throw new Error(`WEBHOOK_${response.status}`)
  await response.arrayBuffer().catch(() => {})
}
