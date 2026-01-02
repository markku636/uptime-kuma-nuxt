// API endpoint for database info
import { defineEventHandler, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // Get monitor count
    const monitorCount = await prisma.monitor.count()

    // Get heartbeat count
    const heartbeatCount = await prisma.heartbeat.count()

    // Get database size (PostgreSQL specific)
    let dbSize = 0
    try {
      const result = await prisma.$queryRaw<[{ pg_database_size: bigint }]>`
        SELECT pg_database_size(current_database())
      `
      dbSize = Number(result[0]?.pg_database_size || 0)
    } catch (e) {
      // If query fails, estimate size
      dbSize = heartbeatCount * 100 // Rough estimate
    }

    return {
      type: 'PostgreSQL',
      size: dbSize,
      monitors: monitorCount,
      heartbeats: heartbeatCount
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to get database info'
    })
  }
})
