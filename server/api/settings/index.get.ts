import { requireRequestSession } from '../../utils/request-session'

export default defineEventHandler(async (event) => {
  await requireRequestSession(event)
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['cloudflareTunnelToken', 'trustProxy'] } },
    select: { key: true, value: true },
  })
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]))
  return {
    cloudflareTunnelTokenConfigured: !!values.cloudflareTunnelToken,
    trustProxy: values.trustProxy === 'true',
  }
})
