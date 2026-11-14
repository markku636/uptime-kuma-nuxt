import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { spawn } from 'node:child_process'
const adminURL=process.env.TEST_PG_ADMIN_URL||'postgresql://postgres@127.0.0.1:55464/postgres'
if (!['127.0.0.1','localhost'].includes(new URL(adminURL).hostname)) throw new Error('Setup test requires local disposable PostgreSQL')
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms))
async function fixture(callback:(url:string)=>Promise<void>){
  const admin=new pg.Client({connectionString:adminURL});await admin.connect()
  const name='uptime_setup_'+Date.now()+'_'+Math.floor(Math.random()*100000)
  await admin.query(`CREATE DATABASE "${name}"`)
  const url=new URL(adminURL);url.pathname='/'+name
  try{
    const child=spawn(process.execPath,['scripts/migrate.mjs'],{env:{...process.env,DATABASE_URL:url.toString()},stdio:'ignore'})
    assert.equal(await new Promise(resolve=>child.on('exit',resolve)),0)
    await callback(url.toString())
  }finally{await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end()}
}
test('parallel anonymous setup creates exactly one platform administrator',{timeout:30000},async()=>fixture(async url=>{
  const port=32513,base=`http://127.0.0.1:${port}`
  const child=spawn(process.execPath,['.output/server/index.mjs'],{env:{...process.env,DATABASE_URL:url,NITRO_PORT:String(port),NITRO_HOST:'127.0.0.1',NODE_ENV:'production',NUXT_PUBLIC_APP_URL:base,NUXT_SESSION_PASSWORD:'setup-integration-secret-at-least-32-characters',APP_ENCRYPTION_KEY:'0123456789abcdef'.repeat(4)},stdio:['ignore','pipe','pipe']})
  let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d)
  try{
    let ready=false
    for(let i=0;i<100;i++){
      try{if((await fetch(base+'/api/health',{signal:AbortSignal.timeout(100)})).ok){ready=true;break}}catch{}
      await pause(50)
    }
    assert.ok(ready,log)
    const responses=await Promise.all(['setup-race-a','setup-race-b'].map(username=>fetch(base+'/api/auth/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username,password:'strong-test-password'}),signal:AbortSignal.timeout(5000)})))
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,400])
    const client=new pg.Client({connectionString:url});await client.connect()
    try{
      const result=(await client.query('SELECT count(*)::int AS n,count(*) FILTER(WHERE platform_admin)::int AS admins FROM users')).rows[0]
      assert.deepEqual(result,{n:1,admins:1})
      assert.equal((await client.query('SELECT count(*)::int AS n FROM workspace_members')).rows[0].n,1)
    }finally{await client.end()}
  }finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('close',resolve))}
}))
test('production startup refuses the public default session password',{timeout:15000},async()=>fixture(async url=>{
  const child=spawn(process.execPath,['.output/server/index.mjs'],{env:{...process.env,DATABASE_URL:url,NITRO_PORT:'32514',NITRO_HOST:'127.0.0.1',NODE_ENV:'production',NUXT_SESSION_PASSWORD:'change-this-session-password-at-least-32-chars-long'},stdio:['ignore','pipe','pipe']})
  let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d)
  const code=await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(5000).then(()=>{child.kill('SIGTERM');return 'timeout'})])
  assert.notEqual(code,'timeout',log);assert.notEqual(code,0);assert.match(log,/NUXT_SESSION_PASSWORD/)
}))
test('failed security backfill gates HTTP and starts no outbound monitor checks',{timeout:15000},async()=>fixture(async url=>{
  const http=await import('node:http');let hits=0
  const probe=http.createServer((_req,res)=>{hits++;res.end('should never run')})
  await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r))
  const client=new pg.Client({connectionString:url});await client.connect()
  try{
    const owner=(await client.query("INSERT INTO users(username,password) VALUES('bootstrap-fixture','x') RETURNING id")).rows[0].id
    const workspace=(await client.query("INSERT INTO workspaces(name,personal_user_id) VALUES('bootstrap',$1) RETURNING id",[owner])).rows[0].id
    const environment=(await client.query("INSERT INTO environments(workspace_id,name) VALUES($1,'default') RETURNING id",[workspace])).rows[0].id
    await client.query("INSERT INTO monitors(name,user_id,workspace_id,environment_id,type,active,url,request_secrets) VALUES('bootstrap',$1,$2,$3,'http',true,NULL,'enc:v1:invalid')",[owner,workspace,environment])
  }finally{await client.end()}
  const child=spawn(process.execPath,['.output/server/index.mjs'],{env:{...process.env,DATABASE_URL:url,NITRO_PORT:'32514',NITRO_HOST:'127.0.0.1',NODE_ENV:'production',NUXT_PUBLIC_APP_URL:'http://127.0.0.1:32514',NUXT_SESSION_PASSWORD:'setup-integration-secret-at-least-32-characters',APP_ENCRYPTION_KEY:'0123456789abcdef'.repeat(4)},stdio:['ignore','pipe','pipe']})
  let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d)
  try{
    let status=0
    for(let i=0;i<80;i++){try{status=(await fetch('http://127.0.0.1:32514/api/health',{signal:AbortSignal.timeout(100)})).status;if(status)break}catch{}await pause(25)}
    assert.equal(status,503,log);await pause(250);assert.equal(hits,0)
    assert.doesNotMatch(log,/Starting monitor \d|Initializing background jobs with/)
  }finally{child.kill('SIGTERM');await new Promise(r=>child.once('close',r));probe.closeAllConnections();await new Promise<void>(r=>probe.close(()=>r()))}
}))
test('failed resource envelope backfill gates HTTP and starts no outbound monitor checks',{timeout:15000},async()=>fixture(async url=>{
  const http=await import('node:http');let hits=0
  const probe=http.createServer((_req,res)=>{hits++;res.end('should never run')})
  await new Promise<void>(r=>probe.listen(0,'127.0.0.1',r))
  const client=new pg.Client({connectionString:url});await client.connect()
  try{
    const owner=(await client.query("INSERT INTO users(username,password) VALUES('bootstrap-fixture','x') RETURNING id")).rows[0].id
    const workspace=(await client.query("INSERT INTO workspaces(name,personal_user_id) VALUES('bootstrap',$1) RETURNING id",[owner])).rows[0].id
    const environment=(await client.query("INSERT INTO environments(workspace_id,name) VALUES($1,'default') RETURNING id",[workspace])).rows[0].id
    await client.query("INSERT INTO monitors(name,user_id,workspace_id,environment_id,type,active,url) VALUES('bootstrap',$1,$2,$3,'http',true,$4)",[owner,workspace,environment,`http://127.0.0.1:${(probe.address() as any).port}/`])
    await client.query("INSERT INTO notifications(name,user_id,workspace_id,type,config,resource_secrets) VALUES('broken',$1,$2,'webhook','{}','enc:v1:invalid')",[owner,workspace])
  }finally{await client.end()}
  const child=spawn(process.execPath,['.output/server/index.mjs'],{env:{...process.env,DATABASE_URL:url,NITRO_PORT:'32514',NITRO_HOST:'127.0.0.1',NODE_ENV:'production',NUXT_PUBLIC_APP_URL:'http://127.0.0.1:32514',NUXT_SESSION_PASSWORD:'setup-integration-secret-at-least-32-characters',APP_ENCRYPTION_KEY:'0123456789abcdef'.repeat(4)},stdio:['ignore','pipe','pipe']})
  let log='';child.stdout.on('data',d=>log+=d);child.stderr.on('data',d=>log+=d)
  try{
    let status=0
    for(let i=0;i<80;i++){try{status=(await fetch('http://127.0.0.1:32514/api/health',{signal:AbortSignal.timeout(100)})).status;if(status)break}catch{}await pause(25)}
    assert.equal(status,503,log);await pause(250);assert.equal(hits,0)
    assert.doesNotMatch(log,/Starting monitor \d|Initializing background jobs with/)
  }finally{child.kill('SIGTERM');await new Promise(r=>child.once('close',r));probe.closeAllConnections();await new Promise<void>(r=>probe.close(()=>r()))}
}))
