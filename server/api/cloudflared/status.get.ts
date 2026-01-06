import { exec, spawn } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// In-memory state for cloudflared process
let cloudflaredProcess: ReturnType<typeof spawn> | null = null
let cloudflaredOutput: string[] = []

export function getCloudflaredProcess() {
  return cloudflaredProcess
}

export function setCloudflaredProcess(proc: ReturnType<typeof spawn> | null) {
  cloudflaredProcess = proc
}

export function getCloudflaredOutput() {
  return cloudflaredOutput
}

export function clearCloudflaredOutput() {
  cloudflaredOutput = []
}

export function appendCloudflaredOutput(line: string) {
  cloudflaredOutput.push(line)
  // Keep only last 100 lines
  if (cloudflaredOutput.length > 100) {
    cloudflaredOutput = cloudflaredOutput.slice(-100)
  }
}

export default defineEventHandler(async (event) => {
  try {
    // Check if cloudflared is installed
    let installed = false
    let message = ''
    
    try {
      // Try to get cloudflared version
      const { stdout } = await execAsync('cloudflared --version')
      installed = stdout.includes('cloudflared')
      message = stdout.trim()
    } catch {
      // cloudflared not found in PATH
      installed = false
    }

    // Check if cloudflared is running
    const running = cloudflaredProcess !== null && !cloudflaredProcess.killed
    
    // Get recent output
    const output = getCloudflaredOutput().join('\n')

    return {
      installed,
      running,
      message: running ? output : message
    }
  } catch (error: any) {
    return {
      installed: false,
      running: false,
      message: error.message
    }
  }
})
