import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { emailProvider } from '../server/services/notification/providers/email'

const saved = { host: process.env.SMTP_HOST, from: process.env.SMTP_FROM }

describe('email notification transport', () => {
  it('rejects when no operator SMTP relay is configured', async () => {
    delete process.env.SMTP_HOST
    await assert.rejects(() => emailProvider.send({ to: 'a@example.com' }, { title: 't', body: 'b' }), /UNSUPPORTED_PROVIDER/)
  })

  it('rejects malformed or header-injecting recipients without sending', async () => {
    process.env.SMTP_HOST = 'smtp.example.com'
    process.env.SMTP_FROM = 'alerts@example.com'
    for (const to of ['not-an-email', 'a@example.com\nBcc: evil@example.com', '']) {
      await assert.rejects(() => emailProvider.send({ to }, { title: 't', body: 'b' }), /UNSUPPORTED_PROVIDER/)
    }
  })

  it('rejects an invalid relay host', async () => {
    process.env.SMTP_HOST = 'smtp.example.com/evil'
    process.env.SMTP_FROM = 'alerts@example.com'
    await assert.rejects(() => emailProvider.send({ to: 'a@example.com' }, { title: 't', body: 'b' }), /UNSUPPORTED_PROVIDER/)
  })
})

// restore environment for other test files in the same runner
process.on('beforeExit', () => {
  if (saved.host === undefined) delete process.env.SMTP_HOST; else process.env.SMTP_HOST = saved.host
  if (saved.from === undefined) delete process.env.SMTP_FROM; else process.env.SMTP_FROM = saved.from
})
