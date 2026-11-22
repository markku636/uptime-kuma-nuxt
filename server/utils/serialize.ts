/** Public/list DTOs must never spread credential-bearing Prisma records. */
export function monitorSummary(monitor: any) {
  return {
    id: monitor.id, workspaceId: monitor.workspaceId, environmentId: monitor.environmentId, name: monitor.name, description: monitor.description, type: monitor.type,
    active: monitor.active, scheduleSupported:['http','keyword','json-query','bruno'].includes(monitor.type),runtimeStatus:monitor.type==='push'?'push':!monitor.active?'paused':['http','keyword','json-query','bruno'].includes(monitor.type)?'scheduled':'unsupported', interval: monitor.interval, retryInterval: monitor.retryInterval,
    timeout: monitor.timeout, maxretries: monitor.maxretries, weight: monitor.weight,
    createdAt: monitor.createdAt, parent: monitor.parent, groupId: monitor.groupId ?? null, tags: monitor.tags || [],
    heartbeats: (monitor.heartbeats || []).map(heartbeatSummary),
  }
}

export function heartbeatSummary(heartbeat: any) {
  return { id: String(heartbeat.id), monitorId: heartbeat.monitorId, status: heartbeat.status,
    time: heartbeat.time, ping: heartbeat.ping, important: heartbeat.important,
    duration: heartbeat.duration, checkCode: heartbeat.checkCode, assertionResults: heartbeat.assertionResults, msg: heartbeat.status === 1 ? 'Up' : heartbeat.status === 3 ? 'Under maintenance' : heartbeat.status === 2 ? 'Pending' : 'Check failed' }
}
