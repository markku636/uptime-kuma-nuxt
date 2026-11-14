import pg from 'pg'
/** Own the transport deadline: pg query_timeout alone can leave its socket/query alive. */
export class BoundedPgClient extends pg.Client {
  constructor(config?:pg.ClientConfig){super(config);this.on('error',()=>{})}
  query(...input:any[]):any {
    let timer:NodeJS.Timeout|undefined
    const clear=()=>clearTimeout(timer)
    const callback=typeof input.at(-1)==='function'?input.at(-1):null
    if(callback)input[input.length-1]=(...args:any[])=>{clear();callback(...args)}
    timer=setTimeout(()=>{
      const error=Object.assign(new Error('Database control query deadline exceeded'),{code:'CONTROL_QUERY_TIMEOUT'})
      // Destroying the owned stream settles the real pending query and removes this
      // connection from pg's pool. It is never reused with an unknown protocol state.
      ;(this as any).connection.stream.destroy(error)
    },3000);timer.unref()
    try{
      const result=(super.query as any)(...input)
      if(result&&typeof result.then==='function')return result.finally(clear)
      if(result?.once){result.once('end',clear);result.once('error',clear)}
      return result
    }catch(error){clear();throw error}
  }
}
/** pg's connect/acquire timeout errors lack a code; classify only its exact known messages. */
function connectionError(error:any){
  if(error&&!error.code&&['Connection terminated due to connection timeout','timeout exceeded when trying to connect','Connection terminated unexpectedly'].includes(error.message))error.code='CONTROL_CONNECT_TIMEOUT'
  return error
}
export class BoundedPgPool extends pg.Pool {
  connect(...input:any[]):any {
    if(typeof input[0]==='function'){
      const callback=input[0];return super.connect((error,client,release)=>callback(error?connectionError(error):undefined,client,release))
    }
    return super.connect().catch(error=>{throw connectionError(error)})
  }
}
