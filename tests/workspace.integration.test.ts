import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import type { Socket } from 'socket.io-client'
import { prisma, request, data, user, workspace, connect, cleanup, type Identity, type Scope } from './helpers/http'
let owner: Identity, member: Identity, outsider: Identity, a: Scope, b: Scope, qa: Scope
let ma: any, mb: any, mqa: any, push: any, pageA: any, pageB: any, tagB: number, notificationB: number, proxyB: number, maintenanceB: number
const sockets: Socket[] = []
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
async function create(path: string, scope: Scope, body: unknown) { const result=await data(await request('/api/v1/' + path, 'POST', owner, scope, body)); return {...result.data,...(result.provisioning||{})} }
before(async () => {
  owner = await user('workspace-owner'); member = await user('workspace-member'); outsider = await user('workspace-outsider')
  a = await workspace(owner, 'isolation-a'); b = await workspace(owner, 'isolation-b')
  const env = await data(await request(`/api/v1/workspaces/${a.workspaceId}/environments`, 'POST', owner, a, { name: 'qa' }))
  qa = { workspaceId: a.workspaceId, environmentId: env.data.id }
  ma = await create('monitors', a, { name: 'only-a', type: 'http', url: 'http://127.0.0.1:39999/path?token=PRIVATE-QUERY', headers: { Authorization: 'Bearer PRIVATE-HEADER' }, basicAuthPass: 'PRIVATE-PASSWORD', active: false })
  mb = await create('monitors', b, { name: 'only-b', type: 'http', url: 'http://127.0.0.1:39999', active: false })
  mqa = await create('monitors', qa, { name: 'only-qa', type: 'http', url: 'http://127.0.0.1:39999', active: false })
  push = await create('monitors', a, { name: 'scope-events', type: 'push', active: true })
  tagB = (await create('tags', b, { name: 'tag-b', color: '#333333' })).id
  notificationB = (await create('notifications', b, { name: 'notify-b', type: 'webhook', config: { url: 'http://127.0.0.1:39999' }, active: false })).id
  const proxy = await data(await request('/api/v1/proxies','POST',owner,b,{ protocol:'http', host:'127.0.0.1', port:39999, active:false })); proxyB = proxy.id
  pageA = await create('status-pages', a, { slug: 'public-a-' + ma.id, title: 'public-a', published: true })
  pageB = await create('status-pages', b, { slug: 'private-b-' + mb.id, title: 'private-b', published: false })
  maintenanceB = (await create('maintenances', b, { title: 'maintenance-b', active: false })).id
  await prisma.heartbeat.create({ data: { monitorId: ma.id, status: 1, msg: 'PRIVATE-MSG https://user:password@host?token=secret', ping: 10 } })
  await data(await request(`/api/v1/status-pages/${pageA.slug}`, 'PUT', owner, a, { publicGroupList: [{ id: -1, name: 'public', monitorList: [{ id: ma.id }] }] }))
})
after(async () => { sockets.forEach(s => s.disconnect()); await cleanup([owner,member,outsider],[a,b]) })
test('the same user cannot cross workspace or environment request context', async () => {
  for (const [scope, forbidden] of [[a,mb],[a,mqa],[qa,ma],[b,ma]] as [Scope,any][]) {
    for (const [suffix, method] of [['','GET'],['','PUT'],['','DELETE'],['/clone','POST'],['/pause','POST'],['/resume','POST'],['/heartbeats','GET'],['/uptime','GET'],['/certificate','GET']]) {
      assert.equal((await request(`/api/v1/monitors/${forbidden.id}${suffix}`,method,owner,scope,method==='PUT'?{name:'steal'}:undefined)).status,404,method+suffix)
    }
  }
  const list = await data(await request('/api/v1/monitors','GET',owner,a))
  assert.ok(list.data.every((monitor: any) => [ma.id,push.id].includes(monitor.id)))
})
test('monitor relations reject foreign tag, notification, proxy and parent atomically', async () => {
  const count = await prisma.monitor.count({ where: { workspaceId: a.workspaceId } })
  for (const relation of [{ tags:[tagB] },{ notifications:[notificationB] },{ proxyId:proxyB },{ parent:mb.id }]) {
    const response = await request('/api/v1/monitors','POST',owner,a,{ name:'rejected',type:'http',url:'http://127.0.0.1:39999',active:false,...relation })
    assert.equal(response.status,404,await response.text())
    assert.equal((await request(`/api/v1/monitors/${ma.id}`,'PUT',owner,a,relation)).status,404)
  }
  assert.equal(await prisma.monitor.count({ where: { workspaceId:a.workspaceId } }),count)
})
test('tag, maintenance and status page mutations respect workspace scope', async () => {
  assert.equal((await request(`/api/v1/tags/${tagB}`,'DELETE',owner,a)).status,404)
  for (const [suffix, method] of [['','GET'],['','PUT'],['','DELETE'],['/pause','POST'],['/resume','POST']]) {
    assert.equal((await request(`/api/v1/maintenances/${maintenanceB}${suffix}`,method,owner,a,method==='PUT'?{title:'stolen'}:undefined)).status,404)
  }
  assert.equal((await request(`/api/v1/status-pages/${pageB.slug}`,'DELETE',owner,a)).status,404)
  for (const relation of [{monitorIds:[mb.id]},{statusPageIds:[pageB.id]}]) {
    assert.equal((await request('/api/v1/maintenances','POST',owner,a,{title:'bad-relation',active:false,...relation})).status,404)
  }
  const response = await request(`/api/v1/status-pages/${pageA.slug}`,'PUT',owner,a,{title:'MUST-ROLLBACK',publicGroupList:[{id:-1,name:'bad',monitorList:[{id:mb.id}]}]})
  assert.equal(response.status,404,await response.text())
  assert.equal((await prisma.statusPage.findUniqueOrThrow({where:{id:pageA.id}})).title,'public-a')
})
test('viewer, editor, owner and platform administrator are separate roles', async () => {
  const endpoint = `/api/v1/workspaces/${a.workspaceId}/members`
  await data(await request(endpoint,'POST',owner,a,{username:member.username,role:'viewer'}))
  assert.equal((await request('/api/v1/monitors','GET',member,a)).status,200)
  assert.equal((await request(`/api/v1/monitors/${ma.id}`,'PUT',member,a,{name:'viewer-write'})).status,403)
  assert.equal((await request(endpoint,'GET',member,a)).status,403)
  await data(await request(endpoint,'POST',owner,a,{username:member.username,role:'editor'}))
  assert.equal((await request(`/api/v1/monitors/${ma.id}`,'PUT',member,a,{description:'edited-by-member'})).status,200)
  assert.equal((await request(`/api/v1/workspaces/${a.workspaceId}/environments`,'POST',member,a,{name:'not-owner'})).status,403)
  for (const path of ['/api/cluster/nodes','/api/v1/settings/database-info','/api/v1/nodes']) assert.equal((await request(path,'GET',owner,a)).status,403,path)
  assert.equal((await request('/api/v1/monitors','GET',outsider,a)).status,404)
  assert.equal((await request(`/api/v1/workspaces/${a.workspaceId}/members/${owner.id}`,'DELETE',owner,a)).status,409)
})
test('API keys are bound to workspace, environment and read/write permission', async () => {
  const key = await data(await request('/api/v1/api-keys','POST',owner,a,{name:'read scoped',scope:'read',environmentId:a.environmentId}))
  const auth = {'x-api-key':key.key}
  assert.equal((await request('/api/v1/monitors','GET',undefined,a,undefined,auth)).status,200)
  assert.equal((await request('/api/v1/monitors','POST',undefined,a,{name:'no',type:'push'},auth)).status,403)
  assert.equal((await request('/api/v1/monitors','GET',undefined,b,undefined,auth)).status,404)
  assert.equal((await request('/api/v1/monitors','GET',undefined,qa,undefined,auth)).status,404)
  assert.equal((await request('/api/v1/api-keys','POST',undefined,a,{name:'escalated'},auth)).status,403)
})
test('environment secrets use authenticated encryption and never return their values', async () => {
  const endpoint = `/api/v1/workspaces/${a.workspaceId}/environments/${a.environmentId}`
  const response = await request(endpoint,'PUT',owner,a,{variables:{baseUrl:'http://127.0.0.1:39999'},secrets:{apiToken:'SENTINEL-SECRET-DO-NOT-RETURN'}})
  const text = await response.text(); assert.equal(response.status,200,text); assert.ok(!text.includes('SENTINEL-SECRET'))
  const environment = await prisma.environment.findUniqueOrThrow({where:{id:a.environmentId}})
  assert.ok(!JSON.stringify(environment.secrets).includes('SENTINEL-SECRET'))
  const list = await request(`/api/v1/workspaces/${a.workspaceId}/environments`,'GET',member,a)
  assert.ok(!(await list.text()).includes('SENTINEL-SECRET'))
  assert.equal((await request(endpoint,'PUT',member,a,{secrets:{steal:'no'}})).status,403)
})
test('published status endpoints, aliases and badges do not expose private monitor data', async () => {
  for (const [path, scope] of [[`/api/v1/status-pages/${pageB.slug}/monitors`,undefined],[`/api/v1/status-pages/${pageB.slug}/monitors`,a]] as [string,Scope|undefined][]) {
    assert.equal((await request(path,'GET',scope?owner:undefined,scope)).status,404)
  }
  for (const path of [`/api/v1/status-pages/${pageA.slug}`,`/api/v1/status-pages/${pageA.slug}/monitors`,`/api/v1/status-pages/${pageA.slug}/heartbeat`,`/api/v1/status-page/${pageA.slug}/heartbeat`,`/api/status-page/${pageA.slug}/heartbeat`]) {
    const response = await request(path); const body = await response.text(); assert.equal(response.status,200,body)
    for (const secret of ['PRIVATE-QUERY','PRIVATE-HEADER','PRIVATE-PASSWORD','PRIVATE-MSG','user:password','basicAuthPass','pushToken']) assert.ok(!body.includes(secret),path+secret)
  }
  assert.equal((await request(`/api/v1/status-pages/${pageA.slug}/monitors?no_pagination=true`)).status,401)
  assert.equal((await request(`/api/badge/${mb.id}/status`)).status,404)
  assert.equal((await request(`/api/badge/${ma.id}/status`)).status,200)
  const foreign = await data(await request(`/api/v1/status-pages/${pageA.slug}/heartbeat?monitorIds=${mb.id}`))
  assert.deepEqual(foreign.data.heartbeatList,{})
})
test('backup export excludes secrets; imported foreign relation IDs roll back the batch', async () => {
  const exported = await request('/api/v1/backup/export','GET',owner,a)
  const text = await exported.text(); assert.equal(exported.status,200,text)
  assert.ok(!text.includes('PRIVATE-QUERY')); assert.ok(!text.includes('PRIVATE-HEADER')); assert.ok(!text.includes('PRIVATE-PASSWORD'))
  assert.ok(!text.includes('only-b'))
  const count = await prisma.monitor.count({where:{workspaceId:a.workspaceId}})
  const response = await request('/api/v1/backup/import','POST',owner,a,{data:{version:'1.1',data:{monitors:[{name:'must-rollback',type:'push',tagIds:[tagB]}]}},options:{}})
  assert.equal(response.status,400,await response.text()); assert.equal(await prisma.monitor.count({where:{workspaceId:a.workspaceId}}),count)
})
test('socket delivery isolates two workspaces and two environments for the same user', async () => {
  const sa = await connect(owner,a), sb = await connect(owner,b), sq = await connect(owner,qa); sockets.push(sa,sb,sq)
  let countA=0,countB=0,countQ=0
  sa.on('heartbeat',()=>countA++); sb.on('heartbeat',()=>countB++); sq.on('heartbeat',()=>countQ++)
  sa.emit('subscribe_monitors'); sb.emit('subscribe_monitors'); sq.emit('subscribe_monitors'); await pause(50)
  await data(await request(`/api/push/${push.pushToken}`)); for(let i=0;i<80&&countA===0;i++)await pause(25)
  assert.equal(countA,1); assert.equal(countB,0); assert.equal(countQ,0)
  assert.equal((await sb.timeout(1000).emitWithAck('subscribe_monitor',ma.id)).ok,false)
})
test('removing membership stops idle socket delivery and revokes that member API keys', async () => {
  await data(await request(`/api/v1/workspaces/${a.workspaceId}/members`,'POST',owner,a,{username:member.username,role:'owner'}))
  const key = await data(await request('/api/v1/api-keys','POST',member,a,{name:'revoke-member',scope:'read'}))
  const socket = await connect(member,a); sockets.push(socket); let received=0
  socket.on('heartbeat',()=>received++); socket.emit('subscribe_monitors'); await pause(1100); received=0
  await data(await request(`/api/v1/workspaces/${a.workspaceId}/members/${member.id}`,'DELETE',owner,a))
  await data(await request(`/api/push/${push.pushToken}`)); await pause(1100)
  assert.equal(received,0)
  assert.equal((await request('/api/v1/monitors','GET',member,a)).status,404)
  assert.equal((await request('/api/v1/monitors','GET',undefined,a,undefined,{'x-api-key':key.key})).status,401)
  assert.equal((await request('/api/v1/workspaces','GET',member,a)).status,200,'workspace list must recover from stale selection')
})
