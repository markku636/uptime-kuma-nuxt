// server/services/monitor/checkers/host-name.ts
// Host names handed to command-line tools (ping, tailscale). Pure: tests/server/host-name.test.ts.

/**
 * A DNS name, IPv4 or IPv6 address (IPv6 may carry a %zone). No spaces,
 * shell characters or a leading "-" (which a tool would read as an option).
 */
export function isSafeHostName(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const host = value.trim()
  if (!host || host.length > 253 || host.startsWith('-')) return false
  return /^[A-Za-z0-9._-]+$/.test(host) || /^[0-9A-Fa-f:.]+(%[A-Za-z0-9_.-]+)?$/.test(host)
}
