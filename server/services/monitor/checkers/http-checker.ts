// server/services/monitor/checkers/http-checker.ts
import axios from 'axios'
import type { CheckResult } from '../checker'
import { getTLSInfo, type TLSInfo } from './tls-checker'

export interface HttpCheckResult extends CheckResult {
  tlsInfo?: TLSInfo | null
}

export async function checkHttp(monitor: any, startTime: number): Promise<HttpCheckResult> {
  const https = await import('https')
  
  let tlsInfo: TLSInfo | null = null
  
  // Get TLS info for HTTPS URLs
  if (monitor.url && monitor.url.startsWith('https://')) {
    try {
      tlsInfo = await getTLSInfo(monitor.url, (monitor.timeout || 48) * 1000)
    } catch (e) {
      console.error('Failed to get TLS info:', e)
    }
  }
  
  const config: any = {
    method: monitor.method || 'GET',
    url: monitor.url,
    timeout: (monitor.timeout || 48) * 1000,
    headers: monitor.headers || {},
    validateStatus: () => true, // Accept all status codes
  }

  if (monitor.body) {
    config.data = monitor.body
  }

  if (monitor.ignoreTls) {
    config.httpsAgent = new https.Agent({ rejectUnauthorized: false })
  }

  // Basic auth
  if (monitor.authMethod === 'basic' && monitor.basicAuthUser) {
    config.auth = {
      username: monitor.basicAuthUser,
      password: monitor.basicAuthPass || ''
    }
  }

  // NTLM auth
  if (monitor.authMethod === 'ntlm' && monitor.basicAuthUser) {
    const httpntlm = await import('httpntlm')
    // Handle NTLM differently
  }

  // OAuth / Bearer token
  if (monitor.authMethod === 'oauth2-cc' && monitor.oauth2TokenURL) {
    const tokenResponse = await axios.post(monitor.oauth2TokenURL, {
      grant_type: 'client_credentials',
      client_id: monitor.oauth2ClientId,
      client_secret: monitor.oauth2ClientSecret,
      scope: monitor.oauth2Scope
    })
    config.headers['Authorization'] = `Bearer ${tokenResponse.data.access_token}`
  }

  const response = await axios(config)
  const ping = Date.now() - startTime

  // Check if response is successful
  let isUp = response.status >= 200 && response.status < 400

  // Check for specific status codes if defined
  if (monitor.acceptedStatuscodes && monitor.acceptedStatuscodes.length > 0) {
    isUp = monitor.acceptedStatuscodes.includes(response.status.toString())
  }

  // Keyword check
  if (monitor.keyword && isUp) {
    const bodyText = typeof response.data === 'string' 
      ? response.data 
      : JSON.stringify(response.data)
    
    const found = bodyText.includes(monitor.keyword)
    
    if (monitor.invertKeyword) {
      isUp = found ? false : true
    } else {
      isUp = found
    }

    if (!isUp) {
      return {
        status: 0,
        ping,
        msg: monitor.invertKeyword ? 'Keyword found (inverted)' : 'Keyword not found'
      }
    }
  }

  // Upside down mode
  if (monitor.upsideDown) {
    isUp = !isUp
  }

  return {
    status: isUp ? 1 : 0,
    ping,
    msg: `HTTP ${response.status} - ${response.statusText}`,
    tlsInfo
  }
}

export async function checkKeyword(monitor: any, startTime: number): Promise<HttpCheckResult> {
  // Keyword monitoring is essentially HTTP with required keyword
  if (!monitor.keyword) {
    return {
      status: 0,
      ping: 0,
      msg: 'Keyword is required for keyword monitoring'
    }
  }
  return await checkHttp(monitor, startTime)
}
