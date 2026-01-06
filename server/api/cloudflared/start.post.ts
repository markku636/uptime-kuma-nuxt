import { spawn } from 'child_process'
import { 
  getCloudflaredProcess, 
  setCloudflaredProcess, 
  clearCloudflaredOutput, 
  appendCloudflaredOutput 
} from './status.get'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { token } = body

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token is required'
    })
  }

  // Check if already running
  const existingProcess = getCloudflaredProcess()
  if (existingProcess && !existingProcess.killed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'cloudflared is already running'
    })
  }

  try {
    // Clear previous output
    clearCloudflaredOutput()

    // Start cloudflared with the tunnel token
    const proc = spawn('cloudflared', ['tunnel', '--no-autoupdate', 'run', '--token', token], {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    // Capture output
    proc.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach((line: string) => appendCloudflaredOutput(line))
    })

    proc.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)
      lines.forEach((line: string) => appendCloudflaredOutput(line))
    })

    proc.on('error', (err) => {
      appendCloudflaredOutput(`Error: ${err.message}`)
      setCloudflaredProcess(null)
    })

    proc.on('close', (code) => {
      appendCloudflaredOutput(`Process exited with code ${code}`)
      setCloudflaredProcess(null)
    })

    setCloudflaredProcess(proc)

    // Wait a bit to see if it starts successfully
    await new Promise(resolve => setTimeout(resolve, 2000))

    const currentProcess = getCloudflaredProcess()
    if (!currentProcess || currentProcess.killed) {
      throw createError({
        statusCode: 500,
        statusMessage: 'cloudflared failed to start'
      })
    }

    return {
      ok: true,
      message: 'cloudflared started successfully'
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to start cloudflared'
    })
  }
})
