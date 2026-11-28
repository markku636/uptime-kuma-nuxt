// server/services/monitor/checker.ts
import { hydrateMonitor } from '../../utils/monitor-secrets'
import {
  checkHttp,
  checkKeyword,
  checkJsonQuery,
  checkBruno,
  checkGrpcKeyword,
  checkMongoDB,
  checkMySQL,
  checkPostgres,
  checkSqlServer,
  checkRedis,
  checkDocker,
  checkMqtt,
  checkKafka,
  checkRabbitMQ,
  checkSteam,
  checkGamedig,
  checkTcp,
  checkPing,
  checkDns,
  checkRadius,
  checkTailscalePing,
  checkSnmp,
  checkVisualDiff,
  checkBrowserFlow
} from './checkers'

export interface CheckResult {
  status: number // 0: DOWN, 1: UP, 2: PENDING, 3: MAINTENANCE
  ping: number
  msg: string
  code?: string
  assertionResults?: import('../../../shared/types/assertions').AssertionEvaluation
  // Only ever populated for in-page trials with includeTrialResponse; never for scheduled checks.
  response?: { status: number; headers: Record<string, string>; body: string; elapsed: number; truncated?: boolean }
  // Optional outbox metadata for response-time / resend notifications
  eventType?: string
  threshold?: number
  downMinutes?: number
  // browser-flow 的逐步結果；只有該型別會回傳。
  flowSteps?: Array<{ index: number; action: string; status: 'pass' | 'fail' | 'skip'; elapsedMs: number; detail?: string }>
}

export async function checkMonitor(monitor: any, signal?: AbortSignal): Promise<CheckResult> {
  const startTime = Date.now()

  try {
    monitor=hydrateMonitor(monitor)
    switch (monitor.type) {
      case 'http':
        return await checkHttp(monitor, startTime, signal)
      
      case 'keyword':
        return await checkKeyword(monitor, startTime, signal)
      
      case 'json-query':
        return await checkJsonQuery(monitor, startTime, signal)

      case 'bruno':
        return await checkBruno(monitor, startTime, signal)
      
      case 'grpc-keyword':
        return await checkGrpcKeyword(monitor, startTime)
      
      case 'tcp':
        return await checkTcp(monitor, startTime)
      
      case 'ping':
        return await checkPing(monitor, startTime)
      
      case 'dns':
        return await checkDns(monitor, startTime)
      
      case 'push':
        // Push monitors don't need active checking
        return { status: 2, ping: 0, msg: 'Waiting for push' }
      
      case 'docker':
        return await checkDocker(monitor, startTime)
      
      case 'mongodb':
        return await checkMongoDB(monitor, startTime)
      
      case 'mysql':
        return await checkMySQL(monitor, startTime)
      
      case 'postgres':
        return await checkPostgres(monitor, startTime)
      
      case 'sqlserver':
        return await checkSqlServer(monitor, startTime)
      
      case 'redis':
        return await checkRedis(monitor, startTime)
      
      case 'mqtt':
        return await checkMqtt(monitor, startTime)
      
      case 'kafka':
        return await checkKafka(monitor, startTime)
      
      case 'rabbitmq':
        return await checkRabbitMQ(monitor, startTime)
      
      case 'steam':
        return await checkSteam(monitor, startTime)
      
      case 'gamedig':
        return await checkGamedig(monitor, startTime)
      
      case 'radius':
        return await checkRadius(monitor, startTime)
      
      case 'tailscale-ping':
        return await checkTailscalePing(monitor, startTime)
      
      case 'snmp':
        return await checkSnmp(monitor, startTime)
      
      case 'group':
        // Group monitors aggregate status from children
        return await checkGroup(monitor)
      
      case 'real-browser':
        return await checkRealBrowser(monitor, startTime)

      case 'visual-diff':
        return await checkVisualDiff(monitor, startTime, signal)

      case 'browser-flow':
        return await checkBrowserFlow(monitor, startTime, signal)

      default:
        throw new Error(`Unknown monitor type: ${monitor.type}`)
    }
  } catch (error: any) {
    return {
      status: 0,
      ping: Date.now() - startTime,
      msg: 'Check failed', code: 'CHECK_ERROR'
    }
  }
}

async function checkGroup(monitor: any): Promise<CheckResult> {
  // Group monitors derive their status from child monitors
  // This requires fetching the latest heartbeats of child monitors
  // For now, return pending status - actual implementation depends on DB access
  return {
    status: 2,
    ping: 0,
    msg: 'Group status aggregated from children'
  }
}

async function checkRealBrowser(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    // Real browser monitoring using Playwright
    // This requires a browser instance running via remote browser service
    const { chromium } = await import('playwright')
    
    if (!monitor.url) {
      return {
        status: 0,
        ping: 0,
        msg: 'URL is required for real browser monitoring'
      }
    }

    const browser = await chromium.launch({
      headless: true,
      timeout: (monitor.timeout || 48) * 1000
    })
    
    const context = await browser.newContext()
    const page = await context.newPage()
    
    await page.goto(monitor.url, {
      timeout: (monitor.timeout || 48) * 1000,
      waitUntil: 'networkidle'
    })

    const ping = Date.now() - startTime

    // Check for keyword if specified
    if (monitor.keyword) {
      const content = await page.content()
      const found = content.includes(monitor.keyword)
      
      await browser.close()
      
      if (monitor.invertKeyword ? found : !found) {
        return {
          status: monitor.upsideDown ? 1 : 0,
          ping,
          msg: monitor.invertKeyword ? 'Keyword found (inverted)' : 'Keyword not found'
        }
      }
    }

    await browser.close()

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: 'Page loaded successfully'
    }
  } catch (error: any) {
    return {
      status: monitor.upsideDown ? 1 : 0,
      ping: Date.now() - startTime,
      msg: error.message || 'Real browser check failed'
    }
  }
}
