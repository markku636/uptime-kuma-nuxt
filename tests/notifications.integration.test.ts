import {test} from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import {prisma,request,data,user,workspace,cleanup,type Identity,type Scope} from './helpers/http'
test('default and linked notifications stay within workspace and omit request/error secrets',{timeout:15000},async()=>{
  const sentinel='NOTIFICATION_SECRET_SENTINEL',events:{path:string,body:string}[]=[]
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk
    if(req.url?.startsWith('/notify/')){events.push({path:req.url,body});res.end('accepted');return}
    res.writeHead(500,{'content-type':'text/plain'});res.end(sentinel)
  })
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
  const origin=`http://127.0.0.1:${(server.address() as any).port}`
  let owner:Identity|undefined,a:Scope|undefined,b:Scope|undefined,monitorId:number|undefined
  try{
    owner=await user('notification-owner');a=await workspace(owner,'Notification A');b=await workspace(owner,'Notification B')
    const channels=[]
    for(const [scope,label]of [[a,'a'],[b,'b']] as const){const response=await data(await request('/api/v1/notifications','POST',owner,scope,{name:'Default '+label,type:'webhook',active:true,isDefault:true,config:{url:origin+'/notify/'+label}}));channels.push(response.data)}
    const monitor=await data(await request('/api/v1/monitors','POST',owner,a,{name:'Scoped failure',type:'http',url:origin+'/check?token='+sentinel,active:false}))
    monitorId=monitor.data.id
    await prisma.heartbeat.create({data:{monitorId,status:1,msg:'Up',ping:1}})
    // A legacy/corrupt relation must not bypass scope filtering at delivery time.
    await prisma.monitorNotification.create({data:{monitorId,notificationId:channels[1].id}})
    await data(await request(`/api/v1/monitors/${monitorId}`,'PUT',owner,a,{active:true}))
    await prisma.monitor.update({where:{id:monitorId},data:{nextCheckAt:new Date(Date.now()-100)}})
    for(let i=0;i<100&&!events.length;i++)await new Promise(r=>setTimeout(r,30))
    assert.equal(events.length,1);assert.equal(events[0]!.path,'/notify/a')
    assert.ok(!events[0]!.body.includes(sentinel));assert.ok(!events[0]!.body.includes('/check'));assert.ok(!events[0]!.body.includes('token='))
    assert.equal(JSON.parse(events[0]!.body).status,'down')
  }finally{
    if(owner&&a&&monitorId)await request(`/api/v1/monitors/${monitorId}/pause`,'POST',owner,a)
    server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))
    if(owner&&a&&b)await cleanup([owner],[a,b])
  }
})

test('notification test endpoint can emit an UP or DOWN probe event',{timeout:15000},async()=>{
  const events:string[]=[]
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk
    events.push(body);res.end('accepted')
  })
  await new Promise<void>(r=>server.listen(0,'127.0.0.1',r))
  const origin=`http://127.0.0.1:${(server.address() as any).port}`
  let owner:Identity|undefined,a:Scope|undefined
  try{
    owner=await user('notification-probe-owner');a=await workspace(owner,'Notification probe')
    const channel=await data(await request('/api/v1/notifications','POST',owner,a,{name:'Probe channel',type:'webhook',active:true,isDefault:false,config:{url:origin+'/notify'}}))
    const id=channel.data.id
    const bad=await request('/api/v1/notifications/test','POST',owner,a,{notificationId:id,eventStatus:'sideways'})
    assert.equal(bad.status,400)

    const up=await data(await request('/api/v1/notifications/test','POST',owner,a,{notificationId:id,eventStatus:'up'}))
    assert.equal(up.success,true)
    const down=await data(await request('/api/v1/notifications/test','POST',owner,a,{notificationId:id,eventStatus:'down'}))
    assert.equal(down.success,true)
    for(let i=0;i<100&&events.length<2;i++)await new Promise(r=>setTimeout(r,30))
    assert.equal(events.length,2)
    const bodies=events.map(e=>JSON.parse(e))
    assert.equal(bodies[0]!.status,'up')
    assert.equal(bodies[1]!.status,'down')
    assert.match(bodies[1]!.title,/DOWN/)
  }finally{
    server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()))
    if(owner&&a)await cleanup([owner],[a])
  }
})
