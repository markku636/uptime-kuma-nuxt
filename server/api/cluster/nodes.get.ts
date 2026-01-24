// 叢集節點列表 API
// 開發模式下模擬節點狀態，生產環境由 OpenResty 代理

interface ClusterNode {
  id: string
  name: string
  host: string
  port: number
  healthy: boolean
  lastCheck: number
  error: string
}

// 節點配置 - 與 docker-compose.yml 對應
const nodes: ClusterNode[] = [
  { id: 'node1', name: 'Node 1', host: 'app1', port: 3000, healthy: false, lastCheck: 0, error: '' },
  { id: 'node2', name: 'Node 2', host: 'app2', port: 3000, healthy: false, lastCheck: 0, error: '' },
  { id: 'node3', name: 'Node 3', host: 'app3', port: 3000, healthy: false, lastCheck: 0, error: '' },
]

// 健康檢查快取
const healthCache = new Map<string, { healthy: boolean; lastCheck: number; error: string }>()

async function checkNodeHealth(node: ClusterNode): Promise<{ healthy: boolean; error: string }> {
  // 開發模式下，只有當前節點是健康的
  const currentNodeId = process.env.NODE_ID || 'dev'
  
  if (process.env.NODE_ENV === 'development' || currentNodeId === 'dev') {
    // 開發模式：模擬當前節點健康
    return { healthy: node.id === 'node1', error: node.id === 'node1' ? '' : 'Development mode - simulated' }
  }
  
  // 生產模式：嘗試連接節點
  try {
    const url = `http://${node.host}:${node.port}/api/health`
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
  const result: ClusterNode[] = []
  const now = Date.now()
  
  for (const node of nodes) {
    const cached = healthCache.get(node.id)
    
    // 快取 10 秒
    if (cached && now - cached.lastCheck < 10000) {
      result.push({
        ...node,
        healthy: cached.healthy,
        lastCheck: cached.lastCheck,
        error: cached.error
      })
    } else {
      // 執行健康檢查
      const health = await checkNodeHealth(node)
      const nodeStatus = {
        healthy: health.healthy,
        lastCheck: now,
        error: health.error
      }
      healthCache.set(node.id, nodeStatus)
      
      result.push({
        ...node,
        ...nodeStatus
      })
    }
  }
  
  return result
})
