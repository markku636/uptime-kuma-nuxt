// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  const username=process.env.SEED_ADMIN_USERNAME||'admin'
  const existingUser=await prisma.user.findUnique({where:{username}})
  if(!existingUser){
    const password=process.env.SEED_ADMIN_PASSWORD
    if(!password||password.length<12)throw new Error('Set SEED_ADMIN_PASSWORD to at least 12 characters for initial seeding')
    await prisma.$transaction(async tx=>{
      const user=await tx.user.create({data:{username,password:await bcrypt.hash(password,12),platformAdmin:true}})
      await tx.workspace.create({data:{name:`${username}'s workspace`,members:{create:{userId:user.id,role:'owner'}},environments:{create:{name:'default'}}}})
    })
    console.log('Created initial administrator and workspace')
  }

  // Create default settings
  const defaultSettings = [
    { key: 'primaryBaseURL', value: '' },
    { key: 'steamAPIKey', value: '' },
    { key: 'tlsExpiryNotifyDays', value: '7,14,21' },
    { key: 'entryPage', value: 'dashboard' },
    { key: 'searchEngineIndex', value: 'false' },
    { key: 'checkUpdate', value: 'true' },
    { key: 'checkBeta', value: 'false' },
    { key: 'keepDataPeriodDays', value: '180' },
    { key: 'serverTimezone', value: 'UTC' }
  ]

  for (const setting of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {}
    })
  }

  console.log('Created default settings')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
