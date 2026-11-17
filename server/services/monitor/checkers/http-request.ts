// server/services/monitor/checkers/http-request.ts
/// <reference path="../../../../types/httpntlm.d.ts" />
// One HTTP request as an HTTP / keyword / JSON-query monitor defines it:
// method, headers, body, timeout, redirects, TLS, proxy and authentication
// (basic or NTLM). Shared by the checkers so they honour the same options.
import http from 'node:http'
import https from 'node:https'
import axios from 'axios'
import { HttpProxyAgent } from 'http-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { prisma } from '../../../utils/prisma'
import { parseHeaders, proxyUrl, splitNtlmUser, type ProxyRow } from './http-options'

export { bodyText } from './http-options'

export interface HttpResponse {
  status: number
  statusText: string
  data: unknown
}

async function loadProxy(monitor: any): Promise<ProxyRow | null> {
  if (!monitor.proxyId) return null
  const proxy = await prisma.proxy.findFirst({ where: { id: monitor.proxyId, userId: monitor.userId, active: true } })
  return proxy
}

function ntlmRequest(monitor: any, headers: Record<string, string>, timeoutMs: number): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    // Loaded lazily: only NTLM monitors need it
    import('httpntlm').then((mod: any) => {
      const httpntlm = mod.default ?? mod
      const method = String(monitor.method || 'GET').toLowerCase()
      const send = httpntlm[method]
      if (typeof send !== 'function') return reject(new Error(`NTLM does not support ${method.toUpperCase()}`))
      const isHttps = String(monitor.url).startsWith('https://')
      const agent = isHttps
        ? new https.Agent({ keepAlive: true, rejectUnauthorized: !monitor.ignoreTls })
        : new http.Agent({ keepAlive: true })
      const { domain, username } = splitNtlmUser(monitor.basicAuthUser || '')
      // The handshake is two requests; bound the whole of it
      const timer = setTimeout(() => {
        agent.destroy()
        reject(new Error(`timeout of ${timeoutMs}ms exceeded`))
      }, timeoutMs)
      send({
        url: monitor.url,
        username,
        password: monitor.basicAuthPass || '',
        domain,
        workstation: '',
        headers,
        body: monitor.body || undefined,
        timeout: timeoutMs,
        agent,
      }, (err: Error | null, res: any) => {
        clearTimeout(timer)
        agent.destroy()
        if (err) return reject(err)
        resolve({
          status: res.statusCode,
          statusText: http.STATUS_CODES[res.statusCode] ?? '',
          data: res.body,
        })
      })
    }, reject)
  })
}

/** Send the monitor's request; network errors throw, any HTTP status resolves */
export async function sendMonitorRequest(monitor: any): Promise<HttpResponse> {
  const timeoutMs = (monitor.timeout || 48) * 1000
  const headers = parseHeaders(monitor.headers)
  const proxy = await loadProxy(monitor)

  if (monitor.authMethod === 'ntlm' && monitor.basicAuthUser) {
    if (proxy) throw new Error('NTLM authentication cannot be used through a proxy')
    return ntlmRequest(monitor, headers, timeoutMs)
  }

  const config: any = {
    method: monitor.method || 'GET',
    url: monitor.url,
    timeout: timeoutMs,
    headers,
    maxRedirects: Math.max(0, Number(monitor.maxRedirects ?? 10)),
    validateStatus: () => true, // the checker decides what is up
  }
  if (monitor.body) config.data = monitor.body

  const tls = { rejectUnauthorized: !monitor.ignoreTls }
  if (proxy) {
    const url = proxyUrl(proxy)
    if (!url) throw new Error(`${proxy.protocol.toUpperCase()} proxies are not supported for HTTP monitors`)
    config.proxy = false // the agents below do the proxying (CONNECT for HTTPS)
    config.httpAgent = new HttpProxyAgent(url)
    config.httpsAgent = new HttpsProxyAgent(url, tls)
  } else if (monitor.ignoreTls) {
    config.httpsAgent = new https.Agent(tls)
  }

  if (monitor.authMethod === 'basic' && monitor.basicAuthUser) {
    config.auth = { username: monitor.basicAuthUser, password: monitor.basicAuthPass || '' }
  }

  const response = await axios(config)
  return { status: response.status, statusText: response.statusText, data: response.data }
}
