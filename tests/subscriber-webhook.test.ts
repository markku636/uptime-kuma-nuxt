import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertPublicWebhook, sealSubscriberUrl, openSubscriberUrl } from '../server/services/status-page/subscriber-webhook'

process.env.APP_ENCRYPTION_KEY ||= '0123456789abcdef'.repeat(4)

test('webhook URL guard rejects private, metadata and credentialed destinations', async () => {
  for (const url of ['http://127.0.0.1/hook', 'http://10.0.0.5/hook', 'http://169.254.169.254/latest', 'https://user:pass@example.com/hook', 'ftp://example.com/hook']) {
    await assert.rejects(() => assertPublicWebhook(url))
  }
})

test('sealed webhook URL round-trips and never appears in plaintext', () => {
  const sealed = sealSubscriberUrl('https://hooks.example.com/secret-path', 1, 7)
  assert.notEqual(sealed, 'https://hooks.example.com/secret-path')
  assert.equal(sealed.includes('secret-path'), false)
  assert.equal(openSubscriberUrl(sealed, 1, 7), 'https://hooks.example.com/secret-path')
  assert.equal(openSubscriberUrl(sealed, 2, 7), null)
})
