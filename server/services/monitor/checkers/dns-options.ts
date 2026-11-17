// server/services/monitor/checkers/dns-options.ts
// DNS monitor settings → resolver servers. Pure: tests/server/dns-options.test.ts.

export const DNS_RECORD_TYPES = ['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'PTR', 'SOA', 'SRV', 'TXT'] as const

/**
 * "1.1.1.1, 8.8.8.8:5353 [2606:4700::1111]" → servers for dns.Resolver.
 * A server without a port gets `port` (the monitor's port) when it is not 53.
 */
export function dnsServers(value: string | null | undefined, port?: number | null): string[] {
  const usePort = port && port !== 53 && port > 0 && port < 65536 ? port : null
  return String(value ?? '')
    .split(/[\s,;]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map((server) => {
      if (/^\[.*\](:\d+)?$/.test(server) || /^[\d.]+:\d+$/.test(server)) return server // already has a port / bracketed IPv6
      if (!usePort) return server
      return server.includes(':') ? `[${server}]:${usePort}` : `${server}:${usePort}`
    })
}

export function recordType(value: string | null | undefined): string {
  const type = String(value || 'A').toUpperCase()
  return (DNS_RECORD_TYPES as readonly string[]).includes(type) ? type : 'A'
}

/** One line per record, as shown in the heartbeat message */
export function formatRecords(type: string, records: any): string[] {
  if (!Array.isArray(records)) records = records ? [records] : []
  switch (type) {
    case 'MX': return records.map((r: any) => `${r.priority} ${r.exchange}`)
    case 'TXT': return records.map((r: any) => (Array.isArray(r) ? r.join('') : String(r)))
    case 'SRV': return records.map((r: any) => `${r.priority} ${r.weight} ${r.port} ${r.name}`)
    case 'CAA': return records.map((r: any) => `${r.critical} ${r.issue ?? r.issuewild ?? r.iodef ?? ''}`.trim())
    case 'SOA': return records.map((r: any) => `${r.nsname} ${r.hostmaster} ${r.serial}`)
    default: return records.map((r: any) => String(r))
  }
}
