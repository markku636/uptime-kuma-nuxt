const active=new Set<number>();let count=0
export async function withBrunoCapacity<T>(userId:number,callback:()=>Promise<T>):Promise<T>{
  if(active.has(userId)||count>=2)throw createError({statusCode:429,message:'Another Bruno import is in progress; retry shortly'})
  active.add(userId);count++
  try{return await callback()}finally{active.delete(userId);count--}
}
