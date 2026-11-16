import { prisma } from '~/server/utils/prisma'



export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  
  const proxies = await prisma.proxy.findMany({
    where: {
      userId: session.user.id
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return proxies
})
