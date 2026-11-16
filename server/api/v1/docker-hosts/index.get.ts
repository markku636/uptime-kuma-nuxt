import { prisma } from '~/server/utils/prisma'



export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  
  const dockerHosts = await prisma.dockerHost.findMany({
    where: {
      userId: session.user.id
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return dockerHosts
})
