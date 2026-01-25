// 叢集節點列表 API
// 從資料庫查詢節點狀態

import { prisma } from '../../utils/prisma'
import { isClusterMode, getCurrentNodeId, clusterConfig } from '../../utils/cluster-config'

interface ClusterNodeResponse {
  id: string
  name: string
  host: string
  port: number
  healthy: boolean
  lastCheck: number
  error: string
  isPrimary: boolean
  monitorCount: number
}

// 健康檢查快取 (用於即時健康狀態)
const healthCache = new Map<string, { healthy: boolean; lastCheck: number; error: string }>()

async function checkNodeHealthRealtime(host: string, port: number): Promise<{ healthy: boolean; error: string }> {
  try {
    const url = `http://${host}:${port}/api/health`
    const response = await fetch(url, { 
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    
    if (response.ok) {
      return { healthy: true, error: '' }
    }
    return { healthy: false, error: `HTTP ${response.status}` }
  } catch (error: any) {
    return { healthy: false, error: error.message || 'Connection failed' }
  }
}

export default defineEventHandler(async (event) => {
  const now = Date.now()
  const result: ClusterNodeResponse[] = []

  // 查詢所有節點
  const dbNodes = await prisma.node.findMany({
    orderBy: [
      { isPrimary: 'desc' },
      { nodeId: 'asc' }
    ]
  })

  // 如果資料庫沒有節點，返回當前節點作為預設
  if (dbNodes.length === 0) {
    const currentNodeId = getCurrentNodeId()
    return [{
      id: currentNodeId,
      name: currentNodeId,
      host: 'localhost',
      port: clusterConfig.defaultPort,
      healthy: true,
      lastCheck: now,
      error: '',
      isPrimary: true,
      monitorCount: 0
    }]
  }

  // 計算每個節點的監控器數量
  const monitorCounts = await prisma.monitor.groupBy({
    by: ['nodeId'],
    _count: { id: true }
  })
  const monitorCountMap = new Map(
    monitorCounts.map(m => [m.nodeId, m._count.id])
  )

  for (const node of dbNodes) {
    const nodeHost = node.host || node.hostname || 'localhost'
    const nodePort = clusterConfig.defaultPort
    const cacheKey = node.nodeId

    // 使用資料庫中的狀態作為主要來源
    const isOnline = node.status === 'online'
    const lastHeartbeat = node.lastHeartbeat?.getTime() || 0

    // 檢查快取或執行即時健康檢查 (僅在需要時)
    let healthStatus = { healthy: isOnline, error: '' }
    const cached = healthCache.get(cacheKey)

    // 如果節點狀態為 offline 超過 30 秒，嘗試即時檢查
    if (!isOnline && (!cached || now - cached.lastCheck > 30000)) {
      healthStatus = await checkNodeHealthRealtime(nodeHost, nodePort)
      healthCache.set(cacheKey, {
        healthy: healthStatus.healthy,
        lastCheck: now,
        error: healthStatus.error
      })
    } else if (cached) {
      healthStatus = { healthy: cached.healthy, error: cached.error }
    }

    result.push({
      id: node.nodeId,
      name: node.nodeName,
      host: nodeHost,
      port: nodePort,
      healthy: healthStatus.healthy,
      lastCheck: lastHeartbeat || now,
      error: healthStatus.error,
      isPrimary: node.isPrimary,
      monitorCount: monitorCountMap.get(node.nodeId) || 0
    })
  }
  
  return result
})
