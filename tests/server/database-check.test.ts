// Database monitors against the PostgreSQL the tests can reach (TEST_PG_URL),
// plus clean failures for servers that are not there.
import { describe, expect, it } from 'vitest'
import { checkMySQL, checkPostgres, checkRedis, checkSqlServer } from '../../server/services/monitor/checkers/database-checker'

const PG = process.env.TEST_PG_URL

describe.skipIf(!PG)('checkPostgres (live)', () => {
  it('runs the query', async () => {
    expect((await checkPostgres({ databaseConnectionString: PG, databaseQuery: 'SELECT 1', timeout: 5 }, Date.now())).status).toBe(1)
  })

  it('closes the connection when the query fails', async () => {
    const { Client } = await import('pg')
    const count = async () => {
      const c = new Client({ connectionString: PG })
      await c.connect()
      const r = await c.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name = 'kuma-leak-test'")
      await c.end()
      return r.rows[0].n as number
    }
    const url = `${PG}${PG!.includes('?') ? '&' : '?'}application_name=kuma-leak-test`
    for (let i = 0; i < 3; i++) {
      const r = await checkPostgres({ databaseConnectionString: url, databaseQuery: 'SELECT * FROM no_such_table', timeout: 5 }, Date.now())
      expect(r.status).toBe(0)
    }
    expect(await count()).toBe(0)
  })
})

describe('database checks without a server', () => {
  it('fail cleanly', async () => {
    const closed = { timeout: 2 }
    expect((await checkMySQL({ ...closed, databaseConnectionString: 'mysql://u:p@127.0.0.1:9/db' }, Date.now())).status).toBe(0)
    expect((await checkRedis({ ...closed, redisConnectionString: 'redis://127.0.0.1:9' }, Date.now())).status).toBe(0)
    expect((await checkSqlServer({ ...closed, databaseConnectionString: 'Server=127.0.0.1,9;Database=x;User Id=u;Password=p;Encrypt=false;Connect Timeout=2' }, Date.now())).status).toBe(0)
  }, 30_000)
})
