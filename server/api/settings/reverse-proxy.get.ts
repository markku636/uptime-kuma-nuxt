// server/api/settings/reverse-proxy.get.ts
import { prisma } from '~/server/utils/prisma'
import { envTrustsProxy } from '~/server/services/auth/client-ip'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const rows = await prisma.setting.findMany({ where: { key: { in: ['trustProxy', 'cloudflareTunnelToken'] } } })
  const get = (key: string) => rows.find(r => r.key === key)?.value
  return {
    trustProxy: get('trustProxy') === 'true',
    // TRUST_PROXY=true in the environment trusts the proxy whatever is saved
    trustProxyFromEnv: envTrustsProxy(),
    cloudflareTunnelToken: get('cloudflareTunnelToken') ?? '',
  }
})
