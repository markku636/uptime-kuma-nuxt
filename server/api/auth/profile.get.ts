import {prisma} from '../../utils/prisma'
export default defineEventHandler(async event=>{
 const session=await requireRequestSession(event)
 if(event.context.authMethod!=='session')throw createError({statusCode:401,message:'Session required'})
 const user=await prisma.user.findUnique({where:{id:session.user.id},select:{id:true,username:true,timezone:true,createdAt:true}})
 if(!user)throw createError({statusCode:404,message:'User not found'})
 return {ok:true,...user}
})
