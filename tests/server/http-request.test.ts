// The HTTP request monitors send, against throwaway local servers:
// NTLM handshake, HTTP proxy, redirects, stored headers.
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const proxies = new Map<number, any>()
vi.mock('../../server/utils/prisma', () => ({
  prisma: { proxy: { findFirst: async ({ where }: any) => proxies.get(where.id) ?? null } },
}))

const { sendMonitorRequest } = await import('../../server/services/monitor/checkers/http-request')

// A minimal NTLM type 2 (challenge) message
const TYPE2 = 'TlRMTVNTUAACAAAAAAAAACgAAAABggAAU3J2Tm9uY2UAAAAAAAAAAA=='

let target: http.Server
let proxy: http.Server
let base = ''
let proxied = 0

function listen(server: http.Server): Promise<number> {
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port)))
}

beforeAll(async () => {
  target = http.createServer((req, res) => {
    if (req.url === '/ntlm') {
      const auth = req.headers.authorization ?? ''
      if (!auth.startsWith('NTLM ')) {
        res.writeHead(401, { 'WWW-Authenticate': 'NTLM' }).end()
        return
      }
      const type = Buffer.from(auth.slice(5), 'base64')[8]
      if (type === 1) {
        res.writeHead(401, { 'WWW-Authenticate': `NTLM ${TYPE2}` }).end()
        return
      }
      res.writeHead(type === 3 ? 200 : 400).end(`ntlm type ${type}, x-custom=${req.headers['x-custom']}`)
      return
    }
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/ok' }).end()
      return
    }
    res.writeHead(200).end(`ok via=${req.headers['x-via'] ?? 'direct'} x-custom=${req.headers['x-custom'] ?? ''}`)
  })
  // Forward proxy for plain HTTP: the request line carries the absolute URL
  proxy = http.createServer((req, res) => {
    proxied++
    const url = new URL(req.url!)
    const upstream = http.request(
      { host: url.hostname, port: url.port, path: url.pathname, method: req.method, headers: { ...req.headers, 'x-via': 'proxy' } },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers)
        up.pipe(res)
      },
    )
    req.pipe(upstream)
  })
  base = `http://127.0.0.1:${await listen(target)}`
  const proxyPort = await listen(proxy)
  proxies.set(1, { protocol: 'http', host: '127.0.0.1', port: proxyPort, auth: false, username: null, password: null })
  proxies.set(2, { protocol: 'socks5', host: '127.0.0.1', port: 1080, auth: false, username: null, password: null })
})

afterAll(() => {
  target?.close()
  proxy?.close()
})

describe('sendMonitorRequest', () => {
  it('sends headers stored as a JSON string', async () => {
    const res = await sendMonitorRequest({ url: `${base}/ok`, headers: '{"X-Custom":"yes"}', timeout: 5 })
    expect(res.status).toBe(200)
    expect(res.data).toContain('x-custom=yes')
  })

  it('follows redirects up to maxRedirects', async () => {
    expect((await sendMonitorRequest({ url: `${base}/redirect`, timeout: 5 })).status).toBe(200)
    const stopped = await sendMonitorRequest({ url: `${base}/redirect`, maxRedirects: 0, timeout: 5 })
    expect(stopped.status).toBe(302)
  })

  it('goes through the monitor proxy', async () => {
    const before = proxied
    const res = await sendMonitorRequest({ url: `${base}/ok`, proxyId: 1, userId: 1, timeout: 5 })
    expect(res.data).toContain('via=proxy')
    expect(proxied).toBe(before + 1)
  })

  it('refuses proxies it cannot use', async () => {
    await expect(sendMonitorRequest({ url: `${base}/ok`, proxyId: 2, userId: 1, timeout: 5 })).rejects.toThrow(/SOCKS5 proxies are not supported/)
  })

  it('completes an NTLM handshake', async () => {
    const res = await sendMonitorRequest({
      url: `${base}/ntlm`,
      authMethod: 'ntlm',
      basicAuthUser: 'CORP\\alice',
      basicAuthPass: 'pw',
      headers: { 'X-Custom': 'kept' },
      timeout: 5,
    })
    expect(res.status).toBe(200)
    expect(String(res.data)).toBe('ntlm type 3, x-custom=kept')
    expect(res.statusText).toBe('OK')
  })
})
