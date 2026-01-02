// server/services/monitor/checkers/database-checker.ts
import type { CheckResult } from '../checker'

export async function checkMongoDB(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const { MongoClient } = await import('mongodb')
    
    if (!monitor.databaseConnectionString) {
      return {
        status: 0,
        ping: 0,
        msg: 'MongoDB connection string is required'
      }
    }

    const client = new MongoClient(monitor.databaseConnectionString, {
      serverSelectionTimeoutMS: (monitor.timeout || 48) * 1000,
    })

    await client.connect()
    
    // Run command to check connection
    const adminDb = client.db('admin')
    await adminDb.command({ ping: 1 })
    
    const ping = Date.now() - startTime
    await client.close()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'MongoDB connection successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'MongoDB connection failed'
    }
  }
}

export async function checkMySQL(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const mysql = await import('mysql2/promise')
    
    if (!monitor.databaseConnectionString) {
      return {
        status: 0,
        ping: 0,
        msg: 'MySQL connection string is required'
      }
    }

    const connection = await mysql.createConnection(monitor.databaseConnectionString)
    
    // Run query if provided, otherwise just ping
    if (monitor.databaseQuery) {
      await connection.query(monitor.databaseQuery)
    } else {
      await connection.ping()
    }
    
    const ping = Date.now() - startTime
    await connection.end()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'MySQL connection successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'MySQL connection failed'
    }
  }
}

export async function checkPostgres(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const { Client } = await import('pg')
    
    if (!monitor.databaseConnectionString) {
      return {
        status: 0,
        ping: 0,
        msg: 'PostgreSQL connection string is required'
      }
    }

    const client = new Client({
      connectionString: monitor.databaseConnectionString,
      connectionTimeoutMillis: (monitor.timeout || 48) * 1000,
    })

    await client.connect()
    
    // Run query if provided, otherwise just select 1
    const query = monitor.databaseQuery || 'SELECT 1'
    await client.query(query)
    
    const ping = Date.now() - startTime
    await client.end()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'PostgreSQL connection successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'PostgreSQL connection failed'
    }
  }
}

export async function checkSqlServer(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const mssql = await import('mssql')
    
    if (!monitor.databaseConnectionString) {
      return {
        status: 0,
        ping: 0,
        msg: 'SQL Server connection string is required'
      }
    }

    const pool = await mssql.connect(monitor.databaseConnectionString)
    
    // Run query if provided, otherwise just select 1
    const query = monitor.databaseQuery || 'SELECT 1'
    await pool.request().query(query)
    
    const ping = Date.now() - startTime
    await pool.close()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'SQL Server connection successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'SQL Server connection failed'
    }
  }
}

export async function checkRedis(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const { createClient } = await import('redis')
    
    if (!monitor.databaseConnectionString && !monitor.redisConnectionString) {
      return {
        status: 0,
        ping: 0,
        msg: 'Redis connection string is required'
      }
    }

    const connectionString = monitor.redisConnectionString || monitor.databaseConnectionString
    const client = createClient({ url: connectionString })
    
    await client.connect()
    await client.ping()
    
    const ping = Date.now() - startTime
    await client.disconnect()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'Redis connection successful'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'Redis connection failed'
    }
  }
}
