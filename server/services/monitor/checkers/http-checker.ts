// server/services/monitor/checkers/http-checker.ts
import type { CheckResult } from '../checker'
import { getTLSInfo, type TLSInfo } from './tls-checker'
import { isStatusAccepted } from '../status-codes'
import { bodyText, sendMonitorRequest } from './http-request'

export interface HttpCheckResult extends CheckResult {
  tlsInfo?: TLSInfo | null
}

/** Shorten a keyword for messages */
function quote(keyword: string): string {
  return keyword.length > 50 ? `"${keyword.slice(0, 47)}..."` : `"${keyword}"`
}

export async function checkHttp(monitor: any, startTime: number): Promise<HttpCheckResult> {
  let tlsInfo: TLSInfo | null = null

  // Certificate details for HTTPS URLs (expiry notifications use them)
  if (monitor.url && monitor.url.startsWith('https://')) {
    try {
      tlsInfo = await getTLSInfo(monitor.url, (monitor.timeout || 48) * 1000)
    } catch (e) {
      console.error('Failed to get TLS info:', e)
    }
  }

  const response = await sendMonitorRequest(monitor)
  const ping = Date.now() - startTime

  // Accepted codes support ranges ("200-299"); default is 2xx/3xx
  let isUp = isStatusAccepted(response.status, monitor.acceptedStatuscodes)
  let msg = `HTTP ${response.status} - ${response.statusText}`

  if (monitor.keyword && isUp) {
    const found = bodyText(response.data).includes(monitor.keyword)
    isUp = monitor.invertKeyword ? !found : found
    if (!isUp) {
      msg = monitor.invertKeyword
        ? `Keyword ${quote(monitor.keyword)} found, but should be absent`
        : `Keyword ${quote(monitor.keyword)} not found`
    } else {
      msg += monitor.invertKeyword ? `, keyword ${quote(monitor.keyword)} absent` : `, keyword ${quote(monitor.keyword)} found`
    }
  }

  // Upside down mode flips the outcome, keyword checks included
  if (monitor.upsideDown) isUp = !isUp

  return { status: isUp ? 1 : 0, ping, msg, tlsInfo }
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
