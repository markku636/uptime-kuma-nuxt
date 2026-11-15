import {z} from 'zod'
import {prisma} from '../../utils/prisma'
const schema=z.object({timezone:z.string().min(1).max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value}).format();return true}catch{return false}},'Invalid timezone')}).strict()
export default defineEventHandler(async event=>{
 const session=await requireRequestSession(event)
 if(event.context.authMethod!=='session')throw createError({statusCode:401,message:'Session required'})
 if(!(getHeader(event,'content-type')||'').toLowerCase().startsWith('application/json'))throw createError({statusCode:415,message:'Profile accepts JSON timezone updates only'})
 const parsed=schema.safeParse(await readBody(event));if(!parsed.success)throw createError({statusCode:400,message:'Provide a valid timezone only'})
 const user=await prisma.user.update({where:{id:session.user.id},data:{timezone:parsed.data.timezone},select:{id:true,username:true,timezone:true,createdAt:true}})
 return {ok:true,...user}
})
