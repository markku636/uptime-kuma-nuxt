// H3 1 caches raw bytes with this symbol; bounded reads are shared with readBody/multipart.
const rawBody = Symbol.for('h3RawBody')
let bufferedBytes = 0, activeRequests = 0
const TOTAL_BUDGET = 64 * 1024 * 1024
export default defineEventHandler(async event => {
  const path = getRequestURL(event).pathname
  if (!path.startsWith('/api/') || !['POST','PUT','PATCH','DELETE'].includes(event.method)) return
  const req = event.node.req as typeof event.node.req & Record<symbol, Buffer>
  const maximum = /^\/api\/v1\/(bruno\/|backup\/import|settings\/import)/.test(path) ? 24 * 1024 * 1024 : 3 * 1024 * 1024
  const declared = Number(getHeader(event, 'content-length') || 0)
  const fail = (statusCode:number,message:string) => {
    setResponseHeader(event,'connection','close')
    event.node.res.once('finish',()=>req.destroy())
    return createError({statusCode,message})
  }
  if (declared > maximum) throw fail(413,'Request body exceeds size limit')
  if (!declared && !getHeader(event,'transfer-encoding')) return
  if (activeRequests >= 16) throw fail(503,'Too many request bodies in progress')
  activeRequests++
  let size=0,released=false
  const release=()=>{if(!released){released=true;bufferedBytes-=size;activeRequests--}}
  event.node.res.once('finish',release);event.node.res.once('close',release)
  const chunks:Buffer[]=[]
  try {
    await new Promise<void>((resolve,reject)=>{
      let settled=false
      const timer=setTimeout(()=>finish(fail(408,'Request body timeout')),15000);timer.unref()
      const finish=(error?:Error)=>{
        if(settled)return;settled=true
        clearTimeout(timer);req.off('data',data);req.off('end',end);req.off('error',errorHandler);req.off('aborted',aborted)
        if(error){req.pause();reject(error)}else resolve()
      }
      const data=(value:Buffer)=>{
        const chunk=Buffer.isBuffer(value)?value:Buffer.from(value)
        if(size+chunk.length>maximum){finish(fail(413,'Request body exceeds size limit'));return}
        if(bufferedBytes+chunk.length>TOTAL_BUDGET){finish(fail(503,'Request body buffer capacity exceeded'));return}
        size+=chunk.length;bufferedBytes+=chunk.length;chunks.push(chunk)
      }
      const end=()=>finish(),errorHandler=()=>finish(fail(400,'Incomplete request body')),aborted=()=>finish(fail(400,'Incomplete request body'))
      req.on('data',data);req.once('end',end);req.once('error',errorHandler);req.once('aborted',aborted)
    })
    req[rawBody]=Buffer.concat(chunks,size)
  } catch(error) { release();throw error }
})
