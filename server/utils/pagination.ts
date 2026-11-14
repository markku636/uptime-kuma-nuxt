import {createHmac,timingSafeEqual} from 'node:crypto'
/** Cursor authenticates both the position and its complete query/scope binding. */
export function encodeCursor(binding:unknown,position:unknown,secret:string){
  const payload=Buffer.from(JSON.stringify({v:1,binding,position})).toString('base64url')
  return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url')
}
export function decodeCursor<T>(cursor:string,binding:unknown,secret:string):T{
  try{
    if(cursor.length>2048)throw Error()
    const [payload,signature,extra]=cursor.split('.');if(!payload||!signature||extra)throw Error()
    const actual=Buffer.from(signature,'base64url'),expected=createHmac('sha256',secret).update(payload).digest()
    if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error()
    const parsed=JSON.parse(Buffer.from(payload,'base64url').toString())
    if(parsed.v!==1||JSON.stringify(parsed.binding)!==JSON.stringify(binding))throw Error()
    return parsed.position as T
  }catch{throw new Error('INVALID_CURSOR')}
}
