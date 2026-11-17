// server/services/monitor/checkers/database-checker.ts
// Database monitors: connect, run the monitor's query (or a ping), close.
// Every connection is closed in `finally`: a failing query must not leave a
// connection open per check on the monitored server.
import type { CheckResult } from '../checker'

const up = (monitor: any, ping: number, msg: string): CheckResult => ({ status: monitor.upsideDown ? 0 : 1, ping, msg })
const down = (monitor: any, startTime: number, msg: string): CheckResult => ({ status: monitor.upsideDown ? 1 : 0, ping: Date.now() - startTime, msg })
const timeoutMs = (monitor: any) => (monitor.timeout || 48) * 1000

export async function checkMongoDB(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.databaseConnectionString) return { status: 0, ping: 0, msg: 'MongoDB connection string is required' }
  let client: any = null
  try {
    const { MongoClient } = await import('mongodb')
    client = new MongoClient(monitor.databaseConnectionString, {
      serverSelectionTimeoutMS: timeoutMs(monitor),
      connectTimeoutMS: timeoutMs(monitor),
    })
    await client.connect()
    await client.db('admin').command({ ping: 1 })
    return up(monitor, Date.now() - startTime, 'MongoDB connection successful')
  } catch (error: any) {
    return down(monitor, startTime, error.message || 'MongoDB connection failed')
  } finally {
    if (client) await client.close().catch(() => {})
  }
}

export async function checkMySQL(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.databaseConnectionString) return { status: 0, ping: 0, msg: 'MySQL connection string is required' }
  let connection: any = null
  try {
    const mysql = await import('mysql2/promise')
    connection = await mysql.createConnection({ uri: monitor.databaseConnectionString, connectTimeout: timeoutMs(monitor) })
    if (monitor.databaseQuery) await connection.query({ sql: monitor.databaseQuery, timeout: timeoutMs(monitor) })
    else await connection.ping()
    return up(monitor, Date.now() - startTime, 'MySQL connection successful')
  } catch (error: any) {
    return down(monitor, startTime, error.message || 'MySQL connection failed')
  } finally {
    if (connection) await connection.end().catch(() => connection.destroy?.())
  }
}

export async function checkPostgres(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.databaseConnectionString) return { status: 0, ping: 0, msg: 'PostgreSQL connection string is required' }
  let client: any = null
  try {
    const { Client } = await import('pg')
    client = new Client({
      connectionString: monitor.databaseConnectionString,
      connectionTimeoutMillis: timeoutMs(monitor),
      query_timeout: timeoutMs(monitor),
    })
    await client.connect()
    await client.query(monitor.databaseQuery || 'SELECT 1')
    return up(monitor, Date.now() - startTime, 'PostgreSQL connection successful')
  } catch (error: any) {
    return down(monitor, startTime, error.message || 'PostgreSQL connection failed')
  } finally {
    if (client) await client.end().catch(() => {})
  }
}

export async function checkSqlServer(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.databaseConnectionString) return { status: 0, ping: 0, msg: 'SQL Server connection string is required' }
  let pool: any = null
  try {
    const mssql: any = await import('mssql')
    const ConnectionPool = mssql.ConnectionPool ?? mssql.default?.ConnectionPool
    // A pool of its own: mssql.connect() shares one global pool, so every
    // SQL Server monitor would have used the first monitor's database
    pool = new ConnectionPool(monitor.databaseConnectionString)
    await pool.connect()
    const request = pool.request()
    request.timeout = timeoutMs(monitor)
    await request.query(monitor.databaseQuery || 'SELECT 1')
    return up(monitor, Date.now() - startTime, 'SQL Server connection successful')
  } catch (error: any) {
    return down(monitor, startTime, error.message || 'SQL Server connection failed')
  } finally {
    if (pool) await pool.close().catch(() => {})
  }
}

export async function checkRedis(monitor: any, startTime: number): Promise<CheckResult> {
  const connectionString = monitor.redisConnectionString || monitor.databaseConnectionString
  if (!connectionString) return { status: 0, ping: 0, msg: 'Redis connection string is required' }
  let client: any = null
  try {
    const { createClient } = await import('redis')
    client = createClient({
      url: connectionString,
      // One attempt: a monitor reports the failure instead of reconnecting forever
      socket: { connectTimeout: timeoutMs(monitor), reconnectStrategy: false },
    })
    client.on('error', () => { /* reported through connect / ping */ })
    await client.connect()
    await client.ping()
    return up(monitor, Date.now() - startTime, 'Redis connection successful')
  } catch (error: any) {
    return down(monitor, startTime, error.message || 'Redis connection failed')
  } finally {
    if (client?.isOpen) await client.disconnect().catch(() => {})
  }
}
