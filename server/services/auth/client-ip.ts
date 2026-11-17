// server/services/auth/client-ip.ts
// The client's address for rate limiting. X-Forwarded-For is believed only
// from a reverse proxy: a loopback peer (proxy on the same host), or any
// peer when Trust Proxy is on (Settings > Reverse Proxy, or
// TRUST_PROXY=true, e.g. a Docker network behind OpenResty). Even then only
// the last hop counts: the proxy appends the address it saw, while earlier
// hops and X-Real-IP may simply be copied from what the client sent.

type Headers = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

export function isLoopback(address: string | undefined): boolean {
  if (!address) return false
  const a = address.toLowerCase().replace(/^::ffff:/, '')
  return a === '::1' || /^127\.\d+\.\d+\.\d+$/.test(a)
}

export function clientIp(headers: Headers, socketAddress: string | undefined, trustProxy: boolean): string {
  if (trustProxy || isLoopback(socketAddress)) {
    const hops = first(headers['x-forwarded-for'])?.split(',').map(s => s.trim()).filter(Boolean)
    if (hops?.length) return hops[hops.length - 1]
  }
  return socketAddress || 'unknown'
}

export function envTrustsProxy(value = process.env.TRUST_PROXY): boolean {
  return /^(1|true|yes)$/i.test(value ?? '')
}
