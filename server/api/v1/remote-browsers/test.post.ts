// server/api/v1/remote-browsers/test.post.ts
import { defineEventHandler, readBody } from 'h3'

interface TestRemoteBrowserBody {
  url: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<TestRemoteBrowserBody>(event)

  if (!body.url) {
    throw createError({
      statusCode: 400,
      message: 'URL is required'
    })
  }

  try {
    // Validate URL format
    const browserUrl = new URL(body.url)
    
    // Try to connect to the Chrome DevTools Protocol endpoint
    // Remote browsers typically expose WebSocket endpoints for CDP
    const wsEndpoint = `${browserUrl.origin}/json/version`
    
    const response = await fetch(wsEndpoint, {
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      throw new Error(`Browser returned status ${response.status}`)
    }

    const data = await response.json()
    
    return {
      success: true,
      message: 'Connection successful',
      data: {
        browser: data.Browser || 'Unknown',
        protocolVersion: data['Protocol-Version'] || 'Unknown',
        webSocketDebuggerUrl: data.webSocketDebuggerUrl
      }
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Connection failed: ${error.message}`
    }
  }
})
