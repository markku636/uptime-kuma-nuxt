/** Certificate observation only; validity does not assert that the chain is trusted. */
export interface TLSCache { validTo:string; validFrom:string|null; checkedAt:string; configVersion:number; valid:boolean; issuer:string; subject:string; fingerprint:string; serialNumber:string; subjectAltName:string[]; daysRemaining:number }
function date(value:unknown):Date|null{if(value instanceof Date)return Number.isFinite(value.getTime())?value:null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))return null;const parsed=new Date(value);return Number.isFinite(parsed.getTime())&&parsed.toISOString()===value?parsed:null}
function text(value:unknown,max=256){return typeof value==='string'?value.slice(0,max):''}
export function projectTLSCache(input:unknown,configVersion:number,checkedAt:Date):TLSCache|null{
 if(!input||typeof input!=='object'||Array.isArray(input)||(!Number.isSafeInteger(configVersion)||configVersion<1)||!Number.isFinite(checkedAt.getTime()))return null
 const tls=input as Record<string,unknown>,validTo=date(tls.validTo)
 if(!validTo)return null
 return {validTo:validTo.toISOString(),validFrom:date(tls.validFrom)?.toISOString()??null,checkedAt:checkedAt.toISOString(),configVersion,valid:tls.valid===true,
 issuer:text(tls.issuer),subject:text(tls.subject),fingerprint:text(tls.fingerprint,128),serialNumber:text(tls.serialNumber,128),
 subjectAltName:Array.isArray(tls.subjectAltName)?tls.subjectAltName.filter((name):name is string=>typeof name==='string').slice(0,64).map(name=>name.slice(0,255)):[],daysRemaining:Math.floor((validTo.getTime()-checkedAt.getTime())/86400000)}
}
export function cachedCertificateDays(input:unknown,configVersion:number,interval:number,timeout:number,now=new Date()):number|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null
 const cache=input as Record<string,unknown>,validTo=date(cache.validTo),checkedAt=date(cache.checkedAt)
 if(cache.configVersion!==configVersion||!validTo||!checkedAt||!Number.isFinite(now.getTime()))return null
 const seconds=Math.min(86400,Math.max(300,2*(Number.isFinite(interval)?interval:60)+(Number.isFinite(timeout)?timeout:48)))
 const age=now.getTime()-checkedAt.getTime()
 if(age < -5000||age>seconds*1000)return null
 return Math.floor((validTo.getTime()-now.getTime())/86400000)
}
