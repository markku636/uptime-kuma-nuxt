import { requirePlatformAdmin } from '../../utils/request-session'

export default defineEventHandler(async (event) => {
  await requirePlatformAdmin(event)
  const [hash, prefix] = await Promise.all([
    prisma.setting.findUnique({ where: { key: 'globalApiKeyHash' }, select: { value: true } }),
    prisma.setting.findUnique({ where: { key: 'globalApiKeyPrefix' }, select: { value: true } }),
  ])
  return { configured: !!hash?.value, prefix: prefix?.value || null }
})
