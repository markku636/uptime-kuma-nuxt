import http from 'node:http'
const port=Number(process.env.FIXTURE_PORT||32525),host=process.env.FIXTURE_HOST||'127.0.0.1'
const server=http.createServer(async(req,res)=>{for await(const _ of req){};const path=new URL(req.url,'http://fixture').pathname;res.setHeader('content-type','application/json');res.setHeader('x-api-state','ready');if(path==='/fail')res.statusCode=500;const send=()=>res.end(JSON.stringify({ok:res.statusCode===200,health:'ready',version:1,value:19.9}));if(path==='/slow'){const timer=setTimeout(send,200);res.once('close',()=>clearTimeout(timer))}else send()})
server.listen(port,host,()=>console.info(`Local demo fixture listening on ${host}:${port}`));process.once('SIGTERM',()=>{server.closeAllConnections();server.close(()=>process.exit(0))})
