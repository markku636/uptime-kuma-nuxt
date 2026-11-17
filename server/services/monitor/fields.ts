// server/services/monitor/fields.ts
// The monitor columns a client may set, shared by create and update, plus the
// aliases the two monitor forms use. Pure (zod only): tests/server/monitor-fields.test.ts.
import { z } from 'zod'

const str = z.string().nullable().optional()
const int = z.number().int().nullable().optional()
const strList = z.array(z.string()).nullable().optional()

/** Columns that cannot be null: a null from a form means "leave as is" */
const NOT_NULL = new Set([
  'name', 'active', 'interval', 'retryInterval', 'maxretries', 'timeout', 'type', 'method',
  'invertKeyword', 'ignoreTls', 'upsideDown', 'weight', 'maxRedirects', 'grpcEnableTls', 'expiryNotification',
])

const INT_FIELDS = [
  'interval', 'retryInterval', 'maxretries', 'timeout', 'port', 'weight', 'maxRedirects',
  'proxyId', 'remoteBrowserId', 'parent', 'workspaceId',
]

/** Every settable column, all optional (create adds its required ones) */
export const monitorFields = {
  name: z.string().min(1).max(150).optional(),
  description: str,
  type: z.string().min(1).optional(),
  active: z.boolean().optional(),
  interval: z.number().int().min(1).optional(),
  retryInterval: z.number().int().min(1).optional(),
  maxretries: z.number().int().min(0).optional(),
  timeout: z.number().min(0).optional(),
  weight: z.number().int().optional(),
  // HTTP
  url: str,
  hostname: str,
  port: int,
  method: z.string().optional(),
  body: str,
  headers: z.record(z.string(), z.string()).nullable().optional(),
  keyword: str,
  invertKeyword: z.boolean().optional(),
  ignoreTls: z.boolean().optional(),
  upsideDown: z.boolean().optional(),
  authMethod: str,
  basicAuthUser: str,
  basicAuthPass: str,
  maxRedirects: z.number().int().min(0).optional(),
  acceptedStatuscodes: strList,
  proxyId: int,
  // JSON query
  jsonPath: str,
  expectedValue: str,
  // gRPC
  grpcUrl: str,
  grpcProtoContent: str,
  grpcMethod: str,
  grpcServiceName: str,
  grpcEnableTls: z.boolean().optional(),
  grpcBody: str,
  grpcMetadata: str,
  // Databases
  databaseType: str,
  databaseConnectionString: str,
  databaseQuery: str,
  redisConnectionString: str,
  // Docker (dockerHost is the Docker host's id or a socket / URL)
  dockerHost: z.union([z.string(), z.number()]).transform(v => String(v)).nullable().optional(),
  dockerDaemon: str,
  dockerContainer: str,
  // Message queues
  mqttTopic: str,
  mqttUsername: str,
  mqttPassword: str,
  mqttSuccessMessage: str,
  kafkaBrokers: strList,
  kafkaTopic: str,
  kafkaSaslMechanism: str,
  kafkaUsername: str,
  kafkaPassword: str,
  rabbitmqNodes: strList,
  rabbitmqUsername: str,
  rabbitmqPassword: str,
  // RADIUS, games, browser
  radiusSecret: str,
  radiusCalledStationId: str,
  radiusCallingStationId: str,
  game: str,
  remoteBrowserId: int,
  // DNS
  dnsRecordType: str,
  dnsResolver: str,
  // TLS expiry
  expiryNotification: z.boolean().optional(),
  tlsExpiryDays: z.array(z.number().int().positive()).nullable().optional(),
  // Cluster
  assignedNode: str,
  // Organization and relations (handled by the routes, not plain columns)
  parent: z.number().int().positive().nullable().optional(),
  workspaceId: z.number().int().positive().nullable().optional(),
  tags: z.array(z.number().int().positive()).nullable().optional(),
  notifications: z.array(z.number().int().positive()).nullable().optional(),
}

export const updateMonitorSchema = z.object(monitorFields)

/** Ids from `[3, 4]`, `[{ tag_id: 3 }, { id: 4 }]` or `{ "3": true, "4": false }` */
export function idList(value: unknown): number[] | undefined {
  if (value == null) return undefined
  let ids: unknown[] = []
  if (Array.isArray(value)) {
    ids = value.map(v => (v && typeof v === 'object' ? (v as any).tag_id ?? (v as any).tagId ?? (v as any).id : v))
  } else if (typeof value === 'object') {
    ids = Object.entries(value as Record<string, unknown>).filter(([, on]) => !!on).map(([id]) => id)
  } else {
    return undefined
  }
  return [...new Set(ids.map(Number).filter(n => Number.isInteger(n) && n > 0))]
}

/** Lines or commas → list (Kafka brokers, RabbitMQ nodes) */
function listOf(value: unknown): unknown {
  if (typeof value !== 'string') return value
  return value.split(/[\n,]/).map(s => s.trim()).filter(Boolean)
}

/**
 * Map the forms' alternative keys onto columns and tidy values (numbers sent
 * as text, null for columns that cannot be null). Runs after the generic
 * normalizeMonitorPayload (headers, basic auth, status codes).
 */
export function normalizeMonitorFields<T extends Record<string, any>>(body: T): T {
  if (!body || typeof body !== 'object') return body
  const out: Record<string, any> = { ...body }
  const alias = (from: string, to: string) => {
    if (from in out) {
      if (out[to] === undefined) out[to] = out[from]
      delete out[from]
    }
  }
  alias('maxredirects', 'maxRedirects')
  alias('dns_resolve_server', 'dnsResolver')
  alias('dnsResolveServer', 'dnsResolver')
  alias('dns_resolve_type', 'dnsRecordType')
  alias('dnsResolveType', 'dnsRecordType')
  alias('remote_browser', 'remoteBrowserId')
  alias('remoteBrowser', 'remoteBrowserId')
  alias('assigned_node', 'assignedNode')
  alias('notificationIDList', 'notifications')
  alias('kafkaProducerBrokers', 'kafkaBrokers')

  if ('tags' in out) out.tags = idList(out.tags) ?? null
  if ('notifications' in out) out.notifications = idList(out.notifications) ?? null
  for (const key of ['kafkaBrokers', 'rabbitmqNodes']) if (key in out) out[key] = listOf(out[key])

  for (const key of INT_FIELDS) {
    const v = out[key]
    if (typeof v === 'string') out[key] = v.trim() === '' ? null : (/^-?\d+$/.test(v.trim()) ? Number(v) : v)
  }
  if (typeof out.timeout === 'string' && /^\d+(\.\d+)?$/.test(out.timeout)) out.timeout = Number(out.timeout)
  for (const key of NOT_NULL) if (out[key] === null) delete out[key]
  return out as T
}

/** The monitor columns of validated data (relations and placement removed) */
export function columnData(data: Record<string, any>) {
  const { tags, notifications, parent, workspaceId, ...columns } = data
  return columns
}
