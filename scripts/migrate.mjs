import pg from 'pg'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()
try {
  // Serialize schema migration processes; the dedicated K8s migration Job is preferred.
  await client.query("SELECT pg_advisory_lock(736291041)")
  const { rows: [state] } = await client.query("SELECT to_regclass('public.users') AS users, to_regclass('public._prisma_migrations') AS migrations")
  function prisma(...args) {
    const result = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', ...args], { stdio: 'inherit', env: process.env })
    if (result.status !== 0) throw new Error(`Prisma migrate ${args[0]} failed`)
  }
  if (state.users && !state.migrations) {
    const baseline = readFileSync(new URL('../prisma/migrations/20261114000000_baseline/migration.sql', import.meta.url), 'utf8')
    const expected = [...baseline.matchAll(/CREATE TABLE "([^"\n]+)" \(([\s\S]+?)\n\);/g)]
      .flatMap(([, table, body]) => [...body.matchAll(/^\s+"([^"\n]+)"\s+(\w+)/gm)].map(([, column, type]) => ({ table, column, type })))
    const { rows } = await client.query("SELECT table_name, column_name, udt_name FROM information_schema.columns WHERE table_schema='public'")
    const aliases = { SERIAL: 'int4', BIGSERIAL: 'int8', INTEGER: 'int4', BIGINT: 'int8', SMALLINT: 'int2', BOOLEAN: 'bool', TEXT: 'text', JSONB: 'jsonb', TIMESTAMP: 'timestamp', TIMESTAMPTZ: 'timestamptz' }
    const missing = expected.filter(e => !rows.some(r => r.table_name === e.table && r.column_name === e.column && r.udt_name === aliases[e.type]))
    const constraints = [...baseline.matchAll(/ADD CONSTRAINT "([^"\n]+)"/g)].map(x => x[1])
    const actualConstraints = (await client.query("SELECT conname FROM pg_constraint WHERE connamespace='public'::regnamespace")).rows.map(x => x.conname)
    const missingConstraints = constraints.filter(x => !actualConstraints.includes(x))
    if (missing.length || missingConstraints.length) {
      console.error(JSON.stringify({ error: 'Unknown or partial legacy schema; baseline refused', missingColumns: missing, missingConstraints }, null, 2))
      throw new Error('Repair schema to the documented legacy baseline before retrying; no data changed')
    }
    const relationshipChecks = {
      monitor_tags: `SELECT x.monitor_id,x.tag_id FROM monitor_tags x JOIN monitors m ON m.id=x.monitor_id JOIN tags t ON t.id=x.tag_id WHERE m.user_id<>t.user_id LIMIT 100`,
      monitor_notifications: `SELECT x.monitor_id,x.notification_id FROM monitor_notifications x JOIN monitors m ON m.id=x.monitor_id JOIN notifications n ON n.id=x.notification_id WHERE m.user_id<>n.user_id LIMIT 100`,
      status_page_monitors: `SELECT x.id,x.monitor_id FROM status_page_monitors x JOIN monitors m ON m.id=x.monitor_id JOIN status_page_groups g ON g.id=x.group_id JOIN status_pages p ON p.id=g.status_page_id WHERE m.user_id<>p.user_id LIMIT 100`,
      maintenance_monitors: `SELECT x.id,x.monitor_id FROM maintenance_monitors x LEFT JOIN monitors m ON m.id=x.monitor_id LEFT JOIN maintenances a ON a.id=x.maintenance_id WHERE m.id IS NULL OR a.id IS NULL OR m.user_id<>a.user_id LIMIT 100`,
      maintenance_status_pages: `SELECT x.id,x.status_page_id FROM maintenance_status_pages x LEFT JOIN status_pages p ON p.id=x.status_page_id LEFT JOIN maintenances a ON a.id=x.maintenance_id WHERE p.id IS NULL OR a.id IS NULL OR p.user_id<>a.user_id LIMIT 100`,
      monitor_proxy: `SELECT m.id,m.proxy_id FROM monitors m JOIN proxies p ON p.id=m.proxy_id WHERE m.user_id<>p.user_id LIMIT 100`,
    }
    const invalid = {}
    for (const [name, query] of Object.entries(relationshipChecks)) {
      const rows = (await client.query(query)).rows; if (rows.length) invalid[name] = rows
    }
    if (Object.keys(invalid).length) {
      console.error(JSON.stringify({ error: 'Legacy association preflight failed; explicit repair required; no data changed', invalid }, null, 2))
      throw new Error('Legacy association preflight failed')
    }
    prisma('resolve', '--applied', '20261114000000_baseline')
  }
  prisma('deploy')
} finally { await client.query('SELECT pg_advisory_unlock(736291041)'); await client.end() }
