// server/utils/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function client(){
  const raw=process.env.DATABASE_URL
  if(!raw)return new PrismaClient()
  const url=new URL(raw),limit=Number(process.env.DB_POOL_SIZE||url.searchParams.get('connection_limit')||6)
  if(!Number.isSafeInteger(limit)||limit<1||limit>20)throw new Error('Invalid DB_POOL_SIZE')
  url.searchParams.set('connection_limit',String(limit));url.searchParams.set('pool_timeout','5')
  return new PrismaClient({datasourceUrl:url.toString()})
}
export const prisma = globalForPrisma.prisma || client()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Default export for Nuxt auto-import compatibility
export default prisma
