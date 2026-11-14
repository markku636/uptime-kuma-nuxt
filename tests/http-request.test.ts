import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { gzipSync } from 'node:zlib'
import { executeHttpRequest, closeHttpAgents, isForbiddenAddress, HttpCheckError } from '../server/services/monitor/checkers/http-request'
let server:http.Server, base:string
before(async()=>{
  server=http.createServer((req,res)=>{
    if(req.url==='/slow'){setTimeout(()=>{if(!res.destroyed)res.end('late')},300);return}
    if(req.url==='/drip'){res.writeHead(200);const timer=setInterval(()=>res.write('x'),10);res.once('close',()=>clearInterval(timer));return}
    if(req.url==='/redirect'){res.writeHead(302,{location:'/ok'});res.end();return}
    if(req.url==='/loop'){res.writeHead(302,{location:'/loop'});res.end();return}
    if(req.url==='/metadata'){res.writeHead(302,{location:'http://169.254.169.254/latest/meta-data/'});res.end();return}
    if(req.url==='/large'){res.end('x'.repeat(1_048_577));return}
    if(req.url==='/bomb'){res.writeHead(200,{'content-encoding':'gzip'});res.end(gzipSync('x'.repeat(1_048_577)));return}
    if(req.url==='/gzip'){res.writeHead(200,{'content-encoding':'gzip'});res.end(gzipSync('compressed response'));return}
    if(req.url==='/bad-gzip'){res.writeHead(200,{'content-encoding':'gzip'});res.end('not gzip');return}
    if(req.url==='/auth'){res.end(req.headers.authorization||'missing');return}
    if(req.url==='/token'){res.setHeader('content-type','application/json');res.end('{"access_token":"local-token"}');return}
    res.setHeader('X-Result','ready');res.end('ok')
  })
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${(server.address() as any).port}`
})
after(async()=>{closeHttpAgents();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()))})
async function fails(path:string,code:string,extra:any={}){
  await assert.rejects(executeHttpRequest({url:base+path,timeout:1,...extra}),error=>error instanceof HttpCheckError&&error.code===code)
}
test('bounded executor follows validated redirects, decodes gzip and sends basic/bearer auth',async()=>{
  const response=await executeHttpRequest({url:base+'/redirect',timeout:1,maxRedirects:2})
  assert.equal(response.status,200);assert.equal(response.headers['x-result'],'ready');assert.equal(response.body,'ok')
  assert.equal((await executeHttpRequest({url:base+'/gzip',timeout:1})).body,'compressed response')
  assert.equal((await executeHttpRequest({url:base+'/auth',timeout:1,authMethod:'basic',basicAuthUser:'u',basicAuthPass:'p'})).body,'Basic dTpw')
  assert.equal((await executeHttpRequest({url:base+'/auth',timeout:1,authMethod:'oauth2-cc',authConfig:{tokenUrl:base+'/token',clientId:'id',clientSecret:'secret'}})).body,'Bearer local-token')
})
test('a single deadline aborts slow headers, continuous body, OAuth and external cancellation',async()=>{
  const start=Date.now();await fails('/slow','TIMEOUT',{timeout:0.05});assert.ok(Date.now()-start<250)
  await fails('/drip','TIMEOUT',{timeout:0.05})
  await fails('/ok','TIMEOUT',{timeout:0.05,authMethod:'oauth2-cc',authConfig:{tokenUrl:base+'/slow',clientId:'id',clientSecret:'secret'}})
  const abort=new AbortController();setTimeout(()=>abort.abort(),20)
  await assert.rejects(executeHttpRequest({url:base+'/drip',timeout:1},Date.now(),abort.signal),error=>error instanceof HttpCheckError&&error.code==='TIMEOUT')
})
test('decompressed byte caps, malformed streams, loops, metadata redirects and request limits fail closed',async()=>{
  await fails('/large','RESPONSE_TOO_LARGE');await fails('/bomb','RESPONSE_TOO_LARGE');await fails('/bad-gzip','INVALID_RESPONSE')
  await fails('/loop','REDIRECT_LIMIT',{maxRedirects:2});await fails('/metadata','DESTINATION_DENIED')
  await fails('/ok','REQUEST_TOO_LARGE',{body:'x'.repeat(1_048_577)})
  await fails('/ok','CONFIG_ERROR',{headers:{Host:'metadata.google.internal'}})
  await fails('/ok','CONFIG_ERROR',{headers:{'X-Test':'\r\nInjected:true'}})
  await fails('/ok','REQUEST_TOO_LARGE',{headers:{'X-Large':'x'.repeat(33000)}})
})
test('metadata and address policy normalizes alternate IP representations and permits explicit private monitoring',()=>{
  for(const address of ['169.254.169.254','169.254.170.2','100.100.100.200','0.0.0.0','224.0.0.1','::','fe80::1','ff02::1','::ffff:169.254.169.254','::ffff:a9fe:a9fe','fd00:ec2::254','fd20:ce::254'])assert.equal(isForbiddenAddress(address,true),true,address)
  for(const address of ['127.0.0.1','10.1.2.3','172.16.1.1','192.168.1.1','::1','fd00::1']){assert.equal(isForbiddenAddress(address,true),false,address);assert.equal(isForbiddenAddress(address,false),true,address)}
  assert.equal(isForbiddenAddress('8.8.8.8',false),false)
})
test('cross-origin redirects never retain sensitive non-GET bodies or private headers',async()=>{
  const received:{method:string,body:string,headers:http.IncomingHttpHeaders}[]=[]
  const target=http.createServer(async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;received.push({method:req.method!,body,headers:req.headers});res.end('ok')})
  await new Promise<void>(r=>target.listen(0,'127.0.0.1',r))
  const destination=`http://127.0.0.1:${(target.address() as any).port}`
  const redirect=http.createServer((req,res)=>{res.writeHead(Number(req.url!.slice(1)),{location:destination});res.end()})
  await new Promise<void>(r=>redirect.listen(0,'127.0.0.1',r))
  const origin=`http://127.0.0.1:${(redirect.address() as any).port}`
  try{
    for(const method of ['PUT','PATCH','DELETE'])for(const status of [301,302,307,308])await assert.rejects(executeHttpRequest({url:`${origin}/${status}`,method,body:'SECRET_BODY',timeout:1}),error=>error instanceof HttpCheckError&&error.code==='DESTINATION_DENIED')
    assert.equal(received.length,0)
    await executeHttpRequest({url:origin+'/302',timeout:1,headers:{Authorization:'Bearer SECRET',Cookie:'SECRET','X-Api-Key':'SECRET'}})
    assert.equal(received.length,1)
    for(const key of ['authorization','cookie','x-api-key'])assert.equal(received[0]!.headers[key],undefined)
    await executeHttpRequest({url:origin+'/303',method:'HEAD',timeout:1})
    assert.equal(received[1]!.method,'HEAD')
    await executeHttpRequest({url:origin+'/303',method:'PUT',body:'SECRET_BODY',timeout:1})
    assert.equal(received[2]!.method,'GET');assert.equal(received[2]!.body,'')
  }finally{redirect.closeAllConnections();target.closeAllConnections();await Promise.all([new Promise<void>(r=>redirect.close(()=>r())),new Promise<void>(r=>target.close(()=>r()))])}
})
