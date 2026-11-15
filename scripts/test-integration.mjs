import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import net from 'node:net'
import pg from 'pg'
import {readdirSync,mkdirSync,createWriteStream} from 'node:fs'
const adminURL=process.env.TEST_PG_ADMIN_URL||'postgresql://postgres@127.0.0.1:55464/postgres'
const parsed=new URL(adminURL)
if(!['127.0.0.1','localhost','::1'].includes(parsed.hostname)||!['postgres','template1'].includes(parsed.pathname.slice(1)))throw Error('Integration harness requires a loopback PostgreSQL admin database')
const owned='uptime_test_'+Date.now()+'_'+randomBytes(4).toString('hex'),admin=new pg.Client({connectionString:adminURL}),children=new Set()
mkdirSync('.data/validation-logs',{recursive:true});const log=createWriteStream('.data/validation-logs/integration-harness-server.log',{flags:'w'})
const pause=ms=>new Promise(r=>setTimeout(r,ms))
async function run(args,env,stdio='inherit'){const child=spawn(process.execPath,args,{env,stdio});children.add(child);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});children.delete(child);if(code!==0)throw Error('Harness subprocess failed with status '+code)}
let app,created=false
try{
 await admin.connect();await admin.query(`CREATE DATABASE "${owned}"`);created=true
 const database=new URL(adminURL);database.pathname='/'+owned;database.searchParams.set('connection_limit','6')
 const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));const base='http://127.0.0.1:'+port
 const env={...process.env,DATABASE_URL:database.toString(),TEST_PG_ADMIN_URL:adminURL,TEST_BASE_URL:base,APP_ENCRYPTION_KEY:randomBytes(32).toString('hex'),NUXT_SESSION_PASSWORD:randomBytes(32).toString('base64url'),NUXT_PUBLIC_APP_URL:base,APP_ALLOWED_ORIGINS:base,APP_ROLE:'all',LOGIN_RATE_LIMIT:'1000',API_RATE_LIMIT:'20000',TEST_INCLUDE_SCALE:process.argv.includes('--include-scale')?'true':'false',NITRO_HOST:'127.0.0.1',NITRO_PORT:String(port),HOST:'127.0.0.1',PORT:String(port)}
 await run(['scripts/migrate.mjs'],env)
 app=spawn(process.execPath,['.output/server/index.mjs'],{env,stdio:['ignore','pipe','pipe']});children.add(app);app.stdout.pipe(log,{end:false});app.stderr.pipe(log,{end:false})
 let ready=false;for(let n=0;n<150;n++){if(app.exitCode!==null)throw Error('Integration app exited; inspect harness server log');try{if((await fetch(base+'/api/health/ready',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break}}catch{}await pause(100)}if(!ready)throw Error('Integration app readiness timeout')
 const includeScale=process.argv.includes('--include-scale'),requested=process.argv.slice(2).filter(value=>!value.startsWith('--')),files=requested.length?requested:readdirSync('tests').filter(name=>name.endsWith('.integration.test.ts')&&(includeScale||name!=='read-paths.integration.test.ts')).sort().map(name=>'tests/'+name)
 const args=['--import','tsx','--test','--test-concurrency=1',...(!includeScale?['--test-name-pattern','^(?!4000 distinct paths).*$']:[]),...files]
 console.info('Isolated integration database created; test files='+files.length+'; scale regression='+includeScale)
 await run(args,env)
 console.info('Integration tests passed')
}catch(error){console.error(error.message);process.exitCode=1}
finally{
 if(app&&app.exitCode===null){app.kill('SIGTERM');await Promise.race([new Promise(r=>app.once('exit',r)),pause(20000)]);if(app.exitCode===null){app.kill('SIGKILL');await new Promise(r=>app.once('exit',r))}}
 for(const child of children)if(child.exitCode===null)child.kill('SIGKILL')
 if(created){try{await admin.query(`DROP DATABASE "${owned}" WITH (FORCE)`);console.info('Owned integration database dropped')}catch{console.error('Owned integration database cleanup failed: '+owned);process.exitCode=1}}
 await admin.end().catch(()=>{});log.end()
}
