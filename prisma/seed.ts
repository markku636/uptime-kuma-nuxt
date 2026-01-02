// prisma/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Check if admin user exists
  const existingUser = await prisma.user.findFirst({
    where: { username: 'admin' }
  })

  if (!existingUser) {
    // Create default admin user
    const hashedPassword = await bcrypt.hash('admin123', 10)
    
    await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword
      }
    })
    
    console.log('Created default admin user (admin / admin123)')
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

  // Create sample notification (Discord webhook placeholder)
  const existingNotification = await prisma.notification.findFirst({
    where: { name: 'Sample Discord' }
  })

  if (!existingNotification) {
    await prisma.notification.create({
      data: {
        name: 'Sample Discord',
        type: 'discord',
        config: JSON.stringify({
          webhookUrl: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_URL',
          username: 'Uptime Kuma'
        }),
        isDefault: false,
        active: false,
        userId: (await prisma.user.findFirst())?.id || 1
      }
    })
    
    console.log('Created sample notification')
  }

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
