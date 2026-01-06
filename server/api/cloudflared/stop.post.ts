import { getCloudflaredProcess, setCloudflaredProcess, appendCloudflaredOutput } from './status.get'
import prisma from '~/server/utils/prisma'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { password } = body

  // Get cloudflared process
  const proc = getCloudflaredProcess()
  if (!proc || proc.killed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'cloudflared is not running'
    })
  }

  // Verify password if authentication is enabled
  try {
    const settings = await prisma.setting.findFirst({
      where: { key: 'disableAuth' }
    })
    
    const authDisabled = settings?.value === 'true'
    
    if (authDisabled) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot stop cloudflared when authentication is disabled'
      })
    }

    // Verify password
    if (password) {
      const user = await prisma.user.findFirst()
      if (user) {
        const valid = await bcrypt.compare(password, user.password)
        if (!valid) {
          throw createError({
            statusCode: 401,
            statusMessage: 'Invalid password'
          })
        }
      }
    } else {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password is required'
      })
    }
  } catch (error: any) {
    if (error.statusCode) throw error
    // If settings table doesn't exist, allow stopping
  }

  try {
    // Kill the process
    proc.kill('SIGTERM')
    
    // Wait for process to terminate
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Force kill if still running
    if (!proc.killed) {
      proc.kill('SIGKILL')
    }

    appendCloudflaredOutput('cloudflared stopped by user')
    setCloudflaredProcess(null)

    return {
      ok: true,
      message: 'cloudflared stopped'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to stop cloudflared'
    })
  }
})
