import { securityReady } from '../utils/security-bootstrap'

export default defineNitroPlugin(() => {
  const secret = useRuntimeConfig().session.password
  if (process.env.NODE_ENV === 'production' && (!secret || secret.length < 32
    || secret === 'change-this-session-password-at-least-32-chars-long')) {
    throw new Error('Set NUXT_SESSION_PASSWORD to a unique secret of at least 32 characters')
  }
  if (process.env.NODE_ENV === 'production' && !/^[a-fA-F0-9]{64}$/.test(process.env.APP_ENCRYPTION_KEY || '')) {
    throw new Error('Set APP_ENCRYPTION_KEY to 64 hex characters before starting production')
  }
  // Nitro 2 does not await async plugin functions. Keep validation synchronous and
  // gate requests on the explicit bootstrap promise to avoid startup races.
  const ready = securityReady()
  ready.catch(() => console.error('[Security] Database bootstrap failed; requests remain unavailable'))
})
