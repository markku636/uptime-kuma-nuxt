import pg from 'pg'
import {PrismaClient,Prisma} from '@prisma/client'
import {spawnSync} from 'node:child_process'
import {writeFileSync,mkdirSync} from 'node:fs'
import {rawUptimeWindows} from '../server/services/uptime/queries'
import {recentHeartbeats,monitorMetadataSelect} from '../server/utils/monitor-query'
const adminURL=process.env.TEST_PG_ADMIN_URL||'postgresql://postgres@127.0.0.1:55464/postgres'
if(!['127.0.0.1','localhost'].includes(new URL(adminURL).hostname))throw Error('Read benchmark requires a local disposable database')
const name='uptime_read_benchmark_'+Date.now(),admin=new pg.Client({connectionString:adminURL});await admin.connect();await admin.query(`CREATE DATABASE "${name}"`)
const url=new URL(adminURL);url.pathname='/'+name;url.searchParams.set('connection_limit','4')
const db=new PrismaClient({datasourceUrl:url.toString()}),report:any={fixture:{monitors:4000,samplesPerMonitor:1440,rows:5760000,targets:'none: read-only synthetic history, monitors paused'},node:process.version,createdAt:new Date().toISOString()}
mkdirSync('.data/validation-logs',{recursive:true});mkdirSync('docs/validation',{recursive:true})
try{
 const migration=spawnSync(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'ignore'});if(migration.status!==0)throw Error('Benchmark migration failed')
 const owner=await db.user.create({data:{username:'read-benchmark',password:'not-a-login'}}),workspace=await db.workspace.create({data:{name:'Owned read benchmark',members:{create:{userId:owner.id,role:'owner'}},environments:{create:{name:'synthetic'}}},include:{environments:true}}),environmentId=workspace.environments[0]!.id
 await db.$executeRaw`INSERT INTO monitors(name,type,active,user_id,workspace_id,environment_id) SELECT 'Synthetic '||n,'http',false,${owner.id},${workspace.id},${environmentId} FROM generate_series(1,4000) n`
 const started=Date.now();await db.$executeRaw`INSERT INTO heartbeats(monitor_id,status,time,ping,important,duration,coverage_seconds,check_code) SELECT m.id,CASE WHEN s%100=0 THEN 0 ELSE 1 END,date_trunc('minute',statement_timestamp())-(1440-s)*interval '1 minute',s%200,s%100=0,60,120,'SYNTHETIC' FROM monitors m CROSS JOIN generate_series(0,1439) s`;report.fixture.insertMs=Date.now()-started
 await db.$executeRawUnsafe('ANALYZE monitors');await db.$executeRawUnsafe('ANALYZE heartbeats')
 report.fixture.databaseBytes=Number((await db.$queryRaw<any[]>`SELECT pg_database_size(current_database()) AS bytes`)[0].bytes)
 const sizes=await db.$queryRaw<any[]>`SELECT pg_table_size('heartbeats') AS rows,pg_indexes_size('heartbeats') AS indexes`;report.fixture.rowBytes=Number(sizes[0].rows);report.fixture.indexBytes=Number(sizes[0].indexes)
 const ids=(await db.monitor.findMany({select:{id:true},orderBy:{id:'asc'},take:100})).map(row=>row.id),end=new Date(),timings:Record<string,number[]>={list:[],recent:[],uptime:[]}
 for(let i=0;i<20;i++){
  let start=performance.now();await db.monitor.findMany({where:{workspaceId:workspace.id,environmentId},select:monitorMetadataSelect,take:100,orderBy:{id:'asc'}});timings.list!.push(performance.now()-start)
  start=performance.now();await recentHeartbeats(ids,20,db);timings.recent!.push(performance.now()-start)
  start=performance.now();await rawUptimeWindows(ids,[{key:'24',start:new Date(end.getTime()-86400000),end}],db);timings.uptime!.push(performance.now()-start)
 }
 report.timings=Object.fromEntries(Object.entries(timings).map(([key,values])=>{const sorted=[...values].sort((a,b)=>a-b);return [key,{samples:values.length,p50:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1)}]}))
 report.plans={recent:await db.$queryRaw(Prisma.sql`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT h.* FROM unnest(ARRAY[${Prisma.join(ids)}]::int[]) selected(id) CROSS JOIN LATERAL(SELECT id,time,status FROM heartbeats WHERE monitor_id=selected.id ORDER BY time DESC,id DESC LIMIT 20) h`),history:await db.$queryRaw`EXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) SELECT id,time,status FROM heartbeats WHERE monitor_id=${ids[0]} AND time<statement_timestamp() ORDER BY time DESC,id DESC LIMIT 50`}
 report.memory=process.memoryUsage();report.cleanup={database:name,exclusive:true,dropped:true};writeFileSync('docs/validation/read-path-benchmark.json',JSON.stringify(report,(_key,value)=>typeof value==='bigint'?String(value):value,2));console.info(JSON.stringify({rows:report.fixture.rows,bytes:report.fixture.databaseBytes,timings:report.timings,cleanup:'exclusive disposable DB removed'}))
}finally{await db.$disconnect();await admin.query(`DROP DATABASE "${name}" WITH(FORCE)`);await admin.end()}
