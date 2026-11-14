import { getRequestSession } from '../utils/request-session'

export default defineEventHandler(async (event) => {
  if (getRequestURL(event).pathname.startsWith('/api/v1/')
    && (getHeader(event, 'x-api-key') || getHeader(event, 'authorization'))) {
    await getRequestSession(event)
  }
})
