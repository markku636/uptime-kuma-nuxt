// Email notifications: templates, the mail that is built, and a real send to a
// throwaway local SMTP server.
import net from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildMail, emailProvider } from '../../server/services/notification/providers/email'
import { renderTemplate } from '../../server/services/notification/template'

const message = {
  title: '🔴 API is DOWN',
  body: 'HTTP 503 - <Service Unavailable>',
  monitorName: 'API',
  monitorUrl: 'https://api.example',
  status: 'down' as const,
  ping: 42,
  time: '2026-11-17T01:00:00.000Z',
}

describe('renderTemplate', () => {
  it('fills both placeholder styles and keeps unknown ones', () => {
    expect(renderTemplate('[Kuma] {{ monitorJSON.name }} is {{ statusText }}: {{ msg }}', message))
      .toBe('[Kuma] API is DOWN: HTTP 503 - <Service Unavailable>')
    expect(renderTemplate('{{monitorName}} {{status}} {{ping}}ms {{ nope }}', message)).toBe('API down 42ms {{ nope }}')
  })
})

describe('buildMail', () => {
  const base = { smtpHost: 'smtp.local', smtpPort: 25 }

  it('accepts either form\'s field names', () => {
    expect(buildMail({ ...base, fromEmail: 'a@x', toEmail: 'b@x' }, message)).toMatchObject({ from: 'a@x', to: 'b@x', subject: message.title })
    expect(buildMail({ ...base, smtpFrom: 'c@x', smtpBCC: 'd@x' }, message)).toMatchObject({ from: 'c@x', to: undefined, bcc: 'd@x' })
  })

  it('renders custom subject and body; HTML bodies are escaped', () => {
    const mail = buildMail({ ...base, smtpFrom: 'a@x', smtpTo: 'b@x', customSubject: '{{ monitorJSON.name }}\n{{ statusText }}', customBody: '<b>{{ msg }}</b>', htmlBody: true }, message)
    expect(mail.subject).toBe('API DOWN')
    expect(mail.html).toBe('<b>HTTP 503 - &lt;Service Unavailable&gt;</b>')
    expect(mail.text).toBeUndefined()
  })

  it('requires a sender and a recipient', () => {
    expect(() => buildMail({ ...base, smtpTo: 'b@x' }, message)).toThrow(/From/)
    expect(() => buildMail({ ...base, smtpFrom: 'a@x' }, message)).toThrow(/recipient/)
  })
})

// A minimal SMTP server that records what it receives
let server: net.Server
let port = 0
const received: { from: string; to: string[]; data: string }[] = []

beforeAll(async () => {
  server = net.createServer((socket) => {
    let mail = { from: '', to: [] as string[], data: '' }
    let inData = false
    let buffer = ''
    socket.write('220 test ESMTP\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      let i: number
      while ((i = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, i)
        buffer = buffer.slice(i + 2)
        if (inData) {
          if (line === '.') {
            inData = false
            received.push(mail)
            mail = { from: '', to: [], data: '' }
            socket.write('250 queued\r\n')
          } else {
            mail.data += `${line}\n`
          }
          continue
        }
        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === 'EHLO' || cmd === 'HELO') socket.write('250 test\r\n')
        else if (cmd === 'MAIL') { mail.from = line; socket.write('250 ok\r\n') }
        else if (cmd === 'RCPT') { mail.to.push(line); socket.write('250 ok\r\n') }
        else if (cmd === 'DATA') { inData = true; socket.write('354 go\r\n') }
        else if (cmd === 'QUIT') { socket.end('221 bye\r\n') }
        else socket.write('250 ok\r\n')
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => resolve()))
  port = (server.address() as net.AddressInfo).port
})

afterAll(() => { server?.close() })

describe('emailProvider.send', () => {
  it('delivers through SMTP', async () => {
    await emailProvider.send({ smtpHost: '127.0.0.1', smtpPort: port, smtpFrom: 'kuma@example.com', smtpTo: 'ops@example.com', smtpCC: 'lead@example.com' }, message)
    expect(received).toHaveLength(1)
    expect(received[0].from).toContain('kuma@example.com')
    expect(received[0].to.join(' ')).toContain('ops@example.com')
    expect(received[0].to.join(' ')).toContain('lead@example.com')
    expect(received[0].data).toContain('Status: DOWN')
  })
})
