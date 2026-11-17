// server/services/monitor/checker.ts
import {
  checkHttp,
  checkKeyword,
  checkJsonQuery,
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
  checkRealBrowser,
} from './checkers'
import { prisma } from '../../utils/prisma'
import { aggregateGroupStatus } from '../workspace/tree'
import { applyVariables, maskSecrets, usesVariables } from '../variables/resolve'
import { variablesForMonitor } from '../variables/service'

export interface CheckResult {
  status: number // 0: DOWN, 1: UP, 2: PENDING, 3: MAINTENANCE
  ping: number
  msg: string
}

export async function checkMonitor(monitor: any): Promise<CheckResult> {
  const startTime = Date.now()

  // {{name}} placeholders take their values from the user's variables now,
  // so editing a variable changes every monitor that uses it
  let secrets: string[] = []
  if (usesVariables(monitor)) {
    try {
      const resolved = await variablesForMonitor(monitor.userId, monitor.workspaceId ?? null)
      const filled = applyVariables(monitor, resolved.vars)
      if (filled.missing.length) {
        return { status: 0, ping: 0, msg: `Unknown variable${filled.missing.length > 1 ? 's' : ''}: ${filled.missing.join(', ')}` }
      }
      monitor = filled.monitor
      secrets = resolved.secrets
    } catch (error: any) {
      return { status: 0, ping: 0, msg: `Variables: ${error?.message || 'could not be filled in'}` }
    }
  }
  // Checkers may echo URLs, hosts or expected values: never show a secret
  if (secrets.length) {
    const result = await runChecker(monitor, startTime)
    return { ...result, msg: maskSecrets(result.msg ?? '', secrets) }
  }
  return runChecker(monitor, startTime)
}

async function runChecker(monitor: any, startTime: number): Promise<CheckResult> {

  try {
    switch (monitor.type) {
      case 'http':
        return await checkHttp(monitor, startTime)
      
      case 'keyword':
        return await checkKeyword(monitor, startTime)
      
      case 'json-query':
        return await checkJsonQuery(monitor, startTime)
      
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
      
      default:
        throw new Error(`Unknown monitor type: ${monitor.type}`)
    }
  } catch (error: any) {
    return {
      status: 0,
      ping: Date.now() - startTime,
      msg: error.message || 'Check failed'
    }
  }
}

async function checkGroup(monitor: any): Promise<CheckResult> {
  // A group has no target of its own: its status is derived from the latest
  // heartbeat of each member (see aggregateGroupStatus for the rules)
  const members = await prisma.monitor.findMany({
    where: { parent: monitor.id },
    select: {
      active: true,
      heartbeats: { take: 1, orderBy: { time: 'desc' }, select: { status: true } }
    }
  })

  const { status, msg } = aggregateGroupStatus(
    members.map(m => ({ active: m.active, status: m.heartbeats[0]?.status ?? null }))
  )

  return { status, ping: 0, msg }
}
