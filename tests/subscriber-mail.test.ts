import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validSubscriberEmail, confirmationText } from '../server/services/status-page/subscriber-mail'

test('subscriber email validation rejects injection and oversized values', () => {
  assert.equal(validSubscriberEmail(' User@Example.COM '), 'user@example.com')
  for (const bad of ['not-an-email', 'a@b', 'a@b.com, c@d.com', 'a@b.com\nBcc: x@y.z', 'a'.repeat(320) + '@b.com']) {
    assert.equal(validSubscriberEmail(bad), null)
  }
})

test('confirmation text carries tokenised links only through env base URL', () => {
  const previous = process.env.NUXT_PUBLIC_APP_URL
  process.env.NUXT_PUBLIC_APP_URL = 'https://uptime.markkulab.net'
  try {
    const message = confirmationText('api-platform-demo', 'a'.repeat(64))
    assert.match(message.text, /https:\/\/uptime\.markkulab\.net\/api\/status\/api-platform-demo\/subscribers\/verify\?token=a{64}/)
    assert.match(message.text, /Unsubscribe:/)
  } finally {
    if (previous === undefined) delete process.env.NUXT_PUBLIC_APP_URL
    else process.env.NUXT_PUBLIC_APP_URL = previous
  }
})
