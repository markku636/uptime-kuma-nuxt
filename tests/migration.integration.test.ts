import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { readFile, readdir } from 'node:fs/promises'
import { spawn } from 'node:child_process'
const adminURL = process.env.TEST_PG_ADMIN_URL || 'postgresql://postgres@127.0.0.1:55464/postgres'
const parsed = new URL(adminURL)
if (!['127.0.0.1','localhost'].includes(parsed.hostname)) throw new Error('Migration tests require a local disposable PostgreSQL instance')
const baseline = await readFile('prisma/migrations/20261114000000_baseline/migration.sql','utf8')
async function fixture(run: (client: pg.Client, url: string) => Promise<void>) {
  const admin = new pg.Client({connectionString:adminURL}); await admin.connect()
  const name='uptime_migration_'+Date.now()+'_'+Math.floor(Math.random()*100000)
  await admin.query(`CREATE DATABASE "${name}"`)
  const url = new URL(adminURL); url.pathname='/'+name
  const client = new pg.Client({connectionString:url.toString()}); await client.connect()
  try { await run(client,url.toString()) }
  finally { await client.end(); await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`); await admin.end() }
}
async function migrate(url: string) {
  const child=spawn(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:url},stdio:['ignore','pipe','pipe']})
  let log=''; child.stdout.on('data',x=>log+=x); child.stderr.on('data',x=>log+=x)
  const code=await new Promise<number|null>(resolve=>child.on('close',resolve)); return {code,log}
}
test('fresh install applies every declared migration without db push',async()=>fixture(async(client,url)=>{
  const result=await migrate(url); assert.equal(result.code,0,result.log)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL')).rows[0].n,(await readdir('prisma/migrations',{withFileTypes:true})).filter(x=>x.isDirectory()).length)
  assert.ok((await client.query("SELECT to_regclass('public.workspace_members') AS name")).rows[0].name)
}))
test('legacy migration preserves users, monitors, heartbeat history and associations',async()=>fixture(async(client,url)=>{
  await client.query(baseline)
  const id=(await client.query("INSERT INTO users(username,password) VALUES('legacy','unusable-test-hash') RETURNING id")).rows[0].id
  const monitor=(await client.query("INSERT INTO monitors(name,user_id,type,active) VALUES('legacy-http',$1,'http',false) RETURNING id",[id])).rows[0].id
  await client.query('INSERT INTO heartbeats(monitor_id,status,msg) VALUES($1,1,$2)',[monitor,'legacy-history'])
  const tag=(await client.query("INSERT INTO tags(name,color,user_id) VALUES('legacy-tag','#333',$1) RETURNING id",[id])).rows[0].id
  await client.query('INSERT INTO monitor_tags(monitor_id,tag_id) VALUES($1,$2)',[monitor,tag])
  const result=await migrate(url); assert.equal(result.code,0,result.log)
  const row=(await client.query('SELECT m.id,m.workspace_id,m.environment_id,u.platform_admin,w.personal_user_id,e.name FROM monitors m JOIN users u ON u.id=m.user_id JOIN workspaces w ON w.id=m.workspace_id JOIN environments e ON e.id=m.environment_id WHERE m.id=$1',[monitor])).rows[0]
  assert.equal(row.personal_user_id,id); assert.equal(row.name,'default'); assert.equal(row.platform_admin,true)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM heartbeats WHERE monitor_id=$1',[monitor])).rows[0].n,1)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM monitor_tags WHERE monitor_id=$1 AND tag_id=$2',[monitor,tag])).rows[0].n,1)
  assert.equal((await client.query("SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2",[row.workspace_id,id])).rows[0].role,'owner')
}))
test('partial unknown legacy schemas are rejected before baseline metadata is written',async()=>fixture(async(client,url)=>{
  await client.query('CREATE TABLE users(id serial PRIMARY KEY,username text,password text)')
  const result=await migrate(url); assert.notEqual(result.code,0); assert.match(result.log,/Unknown or partial legacy schema/)
  assert.equal((await client.query("SELECT to_regclass('public._prisma_migrations') AS name")).rows[0].name,null)
}))
test('cross-owner legacy relationships fail closed without deleting or changing resources',async()=>fixture(async(client,url)=>{
  await client.query(baseline)
  const a=(await client.query("INSERT INTO users(username,password) VALUES('legacy-a','x') RETURNING id")).rows[0].id
  const b=(await client.query("INSERT INTO users(username,password) VALUES('legacy-b','x') RETURNING id")).rows[0].id
  const monitor=(await client.query("INSERT INTO monitors(name,user_id,type,active) VALUES('legacy-http',$1,'http',false) RETURNING id",[a])).rows[0].id
  const tag=(await client.query("INSERT INTO tags(name,color,user_id) VALUES('cross-owner','#333',$1) RETURNING id",[b])).rows[0].id
  await client.query('INSERT INTO monitor_tags(monitor_id,tag_id) VALUES($1,$2)',[monitor,tag])
  const result=await migrate(url); assert.notEqual(result.code,0); assert.match(result.log,/Legacy association preflight failed/)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM monitor_tags')).rows[0].n,1)
  assert.equal((await client.query('SELECT count(*)::int AS n FROM monitors')).rows[0].n,1)
  assert.equal((await client.query("SELECT to_regclass('public.workspaces') AS name")).rows[0].name,null)
}))
test('legacy request backfill fails closed without a key, seals in batches and removes plaintext atomically',async()=>fixture(async(client,url)=>{
  await client.query(baseline)
  const owner=(await client.query("INSERT INTO users(username,password) VALUES('legacy-secret','x') RETURNING id")).rows[0].id
  const id=(await client.query("INSERT INTO monitors(name,user_id,type,active,url,headers,basic_auth_pass) VALUES('legacy-secret',$1,'http',false,$2,$3::jsonb,$4) RETURNING id",[owner,'http://localhost/?token=BACKFILL_SECRET',JSON.stringify({Authorization:'BACKFILL_SECRET'}),'BACKFILL_SECRET'])).rows[0].id
  const result=await migrate(url);assert.equal(result.code,0,result.log)
  const {PrismaClient}=await import('@prisma/client')
  const {backfillMonitorSecrets,hydrateMonitor}=await import('../server/utils/monitor-secrets')
  const db=new PrismaClient({datasourceUrl:url}),oldKey=process.env.APP_ENCRYPTION_KEY
  try{
    delete process.env.APP_ENCRYPTION_KEY
    await assert.rejects(backfillMonitorSecrets(db),/APP_ENCRYPTION_KEY/)
    assert.equal((await db.monitor.findUniqueOrThrow({where:{id}})).basicAuthPass,'BACKFILL_SECRET')
    process.env.APP_ENCRYPTION_KEY||='0123456789abcdef'.repeat(4)
    assert.equal(await backfillMonitorSecrets(db),1);assert.equal(await backfillMonitorSecrets(db),0)
    const row=await db.monitor.findUniqueOrThrow({where:{id}})
    assert.equal(row.url,null);assert.equal(row.headers,null);assert.equal(row.basicAuthPass,null)
    assert.ok(!JSON.stringify(row,(_key,value)=>typeof value==='bigint'?String(value):value).includes('BACKFILL_SECRET'))
    assert.equal(hydrateMonitor(row).basicAuthPass,'BACKFILL_SECRET')
    await db.monitor.update({where:{id},data:{dockerHost:'https://user:NEW_LEGACY_SECRET@localhost'}})
    assert.equal(await backfillMonitorSecrets(db),1)
    const expanded=await db.monitor.findUniqueOrThrow({where:{id}})
    assert.equal(expanded.dockerHost,null);assert.equal(hydrateMonitor(expanded).dockerHost,'https://user:NEW_LEGACY_SECRET@localhost')
  }finally{if(oldKey===undefined)delete process.env.APP_ENCRYPTION_KEY;else process.env.APP_ENCRYPTION_KEY=oldKey;await db.$disconnect()}
}))
