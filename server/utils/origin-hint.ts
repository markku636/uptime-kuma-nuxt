import {createHmac} from 'node:crypto'
/** A scheduling hint, never an authorization decision or a recoverable destination. */
export function originHint(origin:string){
 const key=process.env.APP_ENCRYPTION_KEY
 if(!key||!/^[a-f0-9]{64}$/i.test(key))throw Error('Origin hint key unavailable')
 return createHmac('sha256',Buffer.from(key,'hex')).update('monitor-origin-v1\0'+origin).digest('hex')
}
