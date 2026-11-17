// server/services/auth/client-ip.ts
// The client's address for rate limiting. Forwarded headers are believed
// only from a reverse proxy: when the connection comes from a loopback or
// private address (where a proxy sits: same host, Docker network, LAN), or
// when Trust Proxy is on (Settings > Reverse Proxy, or TRUST_PROXY=true).
// A client on the internet connecting directly cannot pick its "address".

type Headers = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** Loopback, private (RFC 1918), link-local, CGNAT and unique-local addresses */
export function isPrivateAddress(address: string | undefined): boolean {
  if (!address) return false
  const a = address.toLowerCase().replace(/^::ffff:/, '')
  if (a === '::1' || a.startsWith('fe80:') || /^f[cd][0-9a-f]{2}:/.test(a)) return true
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(a)
  if (!m) return false
  const [x, y] = [Number(m[1]), Number(m[2])]
  return x === 127 || x === 10 || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168)
    || (x === 169 && y === 254) || (x === 100 && y >= 64 && y <= 127)
}

/**
 * From a trusted proxy: X-Real-IP (the proxy sets it), else the last
 * X-Forwarded-For hop (the one the proxy appended; earlier hops come from
 * the client and can be forged). Otherwise: the socket address.
 */
export function clientIp(headers: Headers, socketAddress: string | undefined, trustProxy: boolean): string {
  if (trustProxy || isPrivateAddress(socketAddress)) {
    const real = first(headers['x-real-ip'])?.trim()
    if (real) return real
    const hops = first(headers['x-forwarded-for'])?.split(',').map(s => s.trim()).filter(Boolean)
    if (hops?.length) return hops[hops.length - 1]
  }
  return socketAddress || 'unknown'
}

export function envTrustsProxy(value = process.env.TRUST_PROXY): boolean {
  return /^(1|true|yes)$/i.test(value ?? '')
}
