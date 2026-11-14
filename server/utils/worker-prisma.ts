import {PrismaClient} from '@prisma/client'
import {PrismaPg} from '@prisma/adapter-pg'
import pg from 'pg'
import {BoundedPgClient,BoundedPgPool} from './bounded-pg'
import {positiveSetting} from '../services/monitor/runtime-config'
function createWorkerDatabase(){
  if(!process.env.DATABASE_URL)return new PrismaClient()
  const url=new URL(process.env.DATABASE_URL),schema=url.searchParams.get('schema')||'public'
  const options=(url.searchParams.get('options')||'')+' -c statement_timeout=2000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=5000'
  url.searchParams.set('options',options)
  for(const key of ['schema','connection_limit','socket_timeout','connect_timeout','pool_timeout','pgbouncer'])url.searchParams.delete(key)
  const pool=new BoundedPgPool({connectionString:url.toString(),max:positiveSetting('WORKER_DB_POOL_SIZE',3,1,6),connectionTimeoutMillis:2000,idleTimeoutMillis:10000,Client:BoundedPgClient} as pg.PoolConfig)
  pool.on('error',()=>{})
  return new PrismaClient({adapter:new PrismaPg(pool,{schema,disposeExternalPool:true})})
}
export const workerPrisma=createWorkerDatabase()
