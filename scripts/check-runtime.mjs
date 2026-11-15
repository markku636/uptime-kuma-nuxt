import {PrismaClient,Prisma} from '@prisma/client'
const db=new PrismaClient()
try{await db.$queryRaw`SELECT 1 AS connected`;console.info(JSON.stringify({runtimeCheck:'passed',node:process.version,platform:process.platform,arch:process.arch,prisma:Prisma.prismaVersion.client,engine:Prisma.prismaVersion.engine}))}finally{await db.$disconnect()}
