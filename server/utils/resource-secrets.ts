import { encryptSecret, decryptSecret } from './variables'
export const resourceDefinitions = {
  notification: { table:'notifications', fields:['config'], empty:{config:{}} },
  proxy: { table:'proxies', fields:['host','username','password'], empty:{host:'',username:null,password:null} },
  dockerHost: { table:'docker_hosts', fields:['connectionUrl','dockerDaemon'], empty:{connectionUrl:null,dockerDaemon:null} },
  remoteBrowser: { table:'remote_browsers', fields:['url'], empty:{url:''} },
} as const
export type SecretResource=keyof typeof resourceDefinitions
const context=(kind:SecretResource,row:any)=>`resource:v1:${kind}:${row.workspaceId}:${row.id}`
const configured=(value:unknown)=>value!==null&&value!==undefined&&value!==''&&(typeof value!=='object'||Object.keys(value as object).length>0)
export function hydrateResource(kind:SecretResource,row:any){
  if(!row.resourceSecrets)return {...row}
  const values=JSON.parse(decryptSecret(row.resourceSecrets,context(kind,row)))
  if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(key=>!resourceDefinitions[kind].fields.includes(key as never)))throw new Error('Invalid resource envelope')
  return {...row,...values}
}
export function applyResourceUpdates(kind:SecretResource,row:any,input:any){
  const hydrated=hydrateResource(kind,row),{clearSecrets=[],...updates}=input
  for(const key of clearSecrets)hydrated[key]=(resourceDefinitions[kind].empty as any)[key]
  return {...hydrated,...updates,resourceSecrets:null}
}
export function sealResource(kind:SecretResource,row:any){
  const hydrated=hydrateResource(kind,row),values:Record<string,unknown>={}
  for(const key of resourceDefinitions[kind].fields)if(hydrated[key]!==undefined&&hydrated[key]!==null)values[key]=hydrated[key]
  return {...resourceDefinitions[kind].empty,resourceSecrets:encryptSecret(JSON.stringify(values),context(kind,row))}
}
export function resourceDTO(kind:SecretResource,row:any){
  const hydrated=hydrateResource(kind,row),fields=kind==='notification'?['name','type','active','isDefault']:kind==='proxy'?['protocol','port','auth','active','isDefault']:kind==='dockerHost'?['name','dockerType','active']:['name','active']
  return {id:row.id,workspaceId:row.workspaceId,...Object.fromEntries(fields.map(key=>[key,row[key]])),...(row.createdAt?{createdAt:row.createdAt}:{}),configured:Object.fromEntries(resourceDefinitions[kind].fields.map(key=>[key,configured(hydrated[key])]))}
}
export async function reserveResourceId(tx:any,kind:SecretResource):Promise<number>{
  const rows=await tx.$queryRawUnsafe(`SELECT nextval(pg_get_serial_sequence('${resourceDefinitions[kind].table}','id'))::integer AS id`)
  return rows[0].id
}
export async function backfillResourceSecrets(db:any){
  let count=0
  for(const kind of Object.keys(resourceDefinitions) as SecretResource[]){
    const def=resourceDefinitions[kind]
    // Scan bounded pages, including already-sealed rows, so bad envelopes fail readiness.
    let after=0
    for(;;){
      const batch=await db[kind].findMany({where:{id:{gt:after}},orderBy:{id:'asc'},take:100,select:{id:true}})
      if(!batch.length)break
      for(const {id} of batch)await db.$transaction(async(tx:any)=>{
        await tx.$queryRawUnsafe(`SELECT id FROM "${def.table}" WHERE id=$1 FOR UPDATE`,id)
        const row=await tx[kind].findUnique({where:{id}});if(!row)return
        const hydrated=hydrateResource(kind,row)
        const residue=def.fields.some(key=>configured(row[key]))
        if(!row.resourceSecrets||residue){
          // A present plaintext residue is a newer legacy write; overlay it deliberately.
          for(const key of def.fields)if(configured(row[key]))hydrated[key]=row[key]
          await tx[kind].update({where:{id},data:sealResource(kind,{...hydrated,resourceSecrets:null})});count++
        }
      })
      after=batch.at(-1).id
    }
  }
  return count
}
