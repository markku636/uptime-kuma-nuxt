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
