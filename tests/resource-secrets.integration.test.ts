import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {prisma,request,data,user,workspace,cleanup,type Identity,type Scope} from './helpers/http'
import {hydrateResource,sealResource,backfillResourceSecrets,type SecretResource} from '../server/utils/resource-secrets'
process.env.APP_ENCRYPTION_KEY='0123456789abcdef'.repeat(4)
let owner:Identity,viewer:Identity,editor:Identity,a:Scope,b:Scope,origin:string,hits=0,server:http.Server,readKey:string
const sentinel='RESOURCE_PRIVATE_SENTINEL'
const definitions:[SecretResource,string,any][]=[]
const saved=new Map<string,any>()
const unwrap=(response:any)=>response.data??response
before(async()=>{
  server=http.createServer(async(req,res)=>{hits++;for await(const _ of req){};if(req.url?.startsWith('/failure')){res.writeHead(500);res.end(sentinel);return}res.setHeader('content-type','application/json');res.end(JSON.stringify({Browser:'Chrome',webSocketDebuggerUrl:'ws://private/'+sentinel}))})
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${(server.address() as any).port}`
  owner=await user('resource-owner');viewer=await user('resource-viewer');editor=await user('resource-editor');a=await workspace(owner,'Resource A');b=await workspace(owner,'Resource B')
  for(const [identity,role]of [[viewer,'viewer'],[editor,'editor']] as const)await data(await request(`/api/v1/workspaces/${a.workspaceId}/members`,'POST',owner,a,{username:identity.username,role}))
  readKey=(await data(await request('/api/v1/api-keys','POST',owner,a,{name:'resource-read',scope:'read'}))).key
  definitions.push(['notification','notifications',{name:'Private webhook',type:'webhook',config:{url:origin+'/notify?token='+sentinel,headers:{Authorization:sentinel}}}],['proxy','proxies',{protocol:'http',host:'https://user:'+sentinel+'@localhost',port:8080,auth:true,username:sentinel,password:sentinel}],['dockerHost','docker-hosts',{name:'Private docker',dockerType:'tcp',connectionUrl:origin+'/?token='+sentinel}],['remoteBrowser','remote-browsers',{name:'Private browser',url:origin+'/?token='+sentinel}])
})
after(async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));await cleanup([owner,viewer,editor],[a,b])})
test('four resources seal before insertion and whitelist every role, read key and mutation response',async()=>{
  for(const [kind,path,input]of definitions){
    const response=await data(await request('/api/v1/'+path,'POST',owner,a,input)),row=unwrap(response);saved.set(kind,row)
    assert.ok(!JSON.stringify(response).includes(sentinel));assert.ok(!JSON.stringify(response).includes('enc:v1:'))
    const db=await (prisma as any)[kind].findUnique({where:{id:row.id}})
    assert.ok(db.resourceSecrets);assert.ok(!JSON.stringify(db).includes(sentinel));assert.ok(JSON.stringify(hydrateResource(kind,db)).includes(sentinel))
    for(const identity of [owner,viewer,editor]){
      const list=await data(await request('/api/v1/'+path,'GET',identity,a));assert.ok(!JSON.stringify(list).includes(sentinel));assert.ok(!JSON.stringify(list).includes('enc:v1:'))
    }
    const list=await data(await request('/api/v1/'+path,'GET',undefined,a,undefined,{authorization:'Bearer '+readKey}));assert.ok(!JSON.stringify(list).includes(sentinel))
    const change=kind==='proxy'?{port:8081}:{name:'Renamed private resource'}
    for(const identity of [viewer]){
      assert.equal((await request(`/api/v1/${path}/${row.id}`,'PUT',identity,a,change)).status,403)
      assert.equal((await request(`/api/v1/${path}/${row.id}`,'DELETE',identity,a)).status,403)
      assert.equal((await request(`/api/v1/${path}`,'POST',identity,a,input)).status,403)
      if(kind!=='proxy')assert.equal((await request(`/api/v1/${path}/test`,'POST',identity,a,{id:row.id})).status,403)
    }
    assert.equal((await request(`/api/v1/${path}/${row.id}`,'PUT',undefined,a,change,{authorization:'Bearer '+readKey})).status,403)
    assert.equal((await request(`/api/v1/${path}/${row.id}`,'PUT',owner,b,change)).status,404)
    if(kind!=='proxy')assert.equal((await request(`/api/v1/${path}/test`,'POST',owner,b,{id:row.id})).status,404)
    const updated=await data(await request(`/api/v1/${path}/${row.id}`,'PUT',editor,a,change));assert.ok(!JSON.stringify(updated).includes(sentinel))
    assert.ok(JSON.stringify(hydrateResource(kind,await (prisma as any)[kind].findUnique({where:{id:row.id}}))).includes(sentinel))
  }
})
test('test-by-id hydrates secrets, returns bounded safe classifications and refuses fake SMTP success',async()=>{
  for(const kind of ['notification','dockerHost','remoteBrowser']){
    const row=saved.get(kind),path=definitions.find(x=>x[0]===kind)![1],before=hits
    const response=await data(await request('/api/v1/'+path+'/test','POST',editor,a,{id:row.id}))
    assert.equal(response.code,'CONNECTION_OK');assert.equal(hits,before+1);assert.ok(!JSON.stringify(response).includes(sentinel));assert.equal(response.data,undefined)
  }
  const notification=saved.get('notification')
  const failure=await data(await request('/api/v1/notifications/test','POST',owner,a,{id:notification.id,overrides:{config:{url:origin+'/failure?token='+sentinel}}}))
  assert.equal(failure.code,'CONNECTION_FAILED');assert.ok(!JSON.stringify(failure).includes(sentinel))
  assert.equal((await request('/api/v1/notifications','POST',owner,a,{name:'SMTP placeholder',type:'email',config:{smtpPassword:sentinel}})).status,400)
  // A legacy provider remains visible/editable as metadata, but cannot report successful delivery.
  const old=await prisma.notification.create({data:{name:'Legacy SMTP',type:'email',config:{smtpPassword:sentinel},workspaceId:a.workspaceId,userId:owner.id}})
  const fake=await data(await request('/api/v1/notifications/test','POST',owner,a,{id:old.id}));assert.equal(fake.code,'UNSUPPORTED_PROVIDER')
  await prisma.notification.delete({where:{id:old.id}})
})
test('shared clear/replace semantics, provider changes and concurrent rename preserve newest credentials',async()=>{
  const browser=saved.get('remoteBrowser'),endpoint='/api/v1/remote-browsers/'+browser.id
  await data(await request(endpoint,'PUT',owner,a,{clearSecrets:['url']}))
  assert.equal(hydrateResource('remoteBrowser',await prisma.remoteBrowser.findUniqueOrThrow({where:{id:browser.id}})).url,'')
  const url=origin+'/?token=REPLACEMENT'
  await data(await request(endpoint,'PUT',owner,a,{clearSecrets:['url'],url}))
  const result=await data(await request('/api/v1/remote-browsers/test','POST',owner,a,{id:browser.id,overrides:{clearSecrets:['url'],url}}));assert.equal(result.code,'CONNECTION_OK')
  await Promise.all([request(endpoint,'PUT',owner,a,{url:origin+'/?token=LATEST'}).then(r=>data(r)),request(endpoint,'PUT',editor,a,{name:'Concurrent rename'}).then(r=>data(r))])
  const row=hydrateResource('remoteBrowser',await prisma.remoteBrowser.findUniqueOrThrow({where:{id:browser.id}}));assert.equal(row.url,origin+'/?token=LATEST');assert.equal(row.name,'Concurrent rename')
  const notification=saved.get('notification')
  assert.equal((await request('/api/v1/notifications/'+notification.id,'PUT',owner,a,{type:'discord'})).status,400)
  await data(await request('/api/v1/notifications/'+notification.id,'PUT',owner,a,{type:'discord',config:{webhookUrl:origin+'/discord'}}))
  const value=hydrateResource('notification',await prisma.notification.findUniqueOrThrow({where:{id:notification.id}}));assert.deepEqual(value.config,{webhookUrl:origin+'/discord'})
})
test('backfill is idempotent, removes sealed residues and fails closed on wrong key or AAD',async()=>{
  // Isolated scope contains no active monitors or channels; startup readiness is tested separately.
  const raw=await prisma.remoteBrowser.create({data:{name:'Legacy',url:origin+'/?token='+sentinel,workspaceId:b.workspaceId,userId:owner.id}})
  const db:any={remoteBrowser:prisma.remoteBrowser,proxy:prisma.proxy,dockerHost:prisma.dockerHost,notification:prisma.notification,$transaction:prisma.$transaction.bind(prisma)}
  const previous=process.env.APP_ENCRYPTION_KEY
  try{
    delete process.env.APP_ENCRYPTION_KEY;await assert.rejects(backfillResourceSecrets(db),/APP_ENCRYPTION_KEY/)
    assert.equal((await prisma.remoteBrowser.findUniqueOrThrow({where:{id:raw.id}})).url,origin+'/?token='+sentinel)
    process.env.APP_ENCRYPTION_KEY=previous
    await backfillResourceSecrets(db);assert.equal(await backfillResourceSecrets(db),0)
    await prisma.remoteBrowser.update({where:{id:raw.id},data:{url:origin+'/?token=RESIDUE'}})
    assert.equal(await backfillResourceSecrets(db),1)
    let row=await prisma.remoteBrowser.findUniqueOrThrow({where:{id:raw.id}});assert.equal(row.url,'');assert.equal(hydrateResource('remoteBrowser',row).url,origin+'/?token=RESIDUE')
    const ciphertext=row.resourceSecrets!
    await prisma.remoteBrowser.update({where:{id:raw.id},data:{resourceSecrets:sealResource('remoteBrowser',{id:raw.id+1,workspaceId:b.workspaceId,url:'x'}).resourceSecrets}})
    await assert.rejects(backfillResourceSecrets(db))
    await prisma.remoteBrowser.update({where:{id:raw.id},data:{resourceSecrets:ciphertext}})
  }finally{process.env.APP_ENCRYPTION_KEY=previous;await prisma.remoteBrowser.delete({where:{id:raw.id}})}
})
