// API endpoint for shrinking database (VACUUM for PostgreSQL)
import { defineEventHandler, createError } from 'h3'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  try {
    // Run VACUUM ANALYZE for PostgreSQL
    await prisma.$executeRaw`VACUUM ANALYZE`

    // Get new database size
    const result = await prisma.$queryRaw<[{ pg_database_size: bigint }]>`
      SELECT pg_database_size(current_database())
    `
    const newSize = Number(result[0]?.pg_database_size || 0)

    return {
      success: true,
      message: 'Database shrunk successfully',
      newSize
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      message: error.message || 'Failed to shrink database'
    })
  }
})
