import { prisma } from './prisma'
// server/utils/node-initializer.ts
// 節點初始化工具 - 在啟動時根據環境變數自動註冊節點到資料庫




interface NodeConfig {
  nodeId: string
  nodeName: string
  host: string
  isPrimary: boolean
}

/**
 * 取得節點配置
 */
function getNodeConfig(): NodeConfig | null {
  const nodeId = process.env.NODE_ID || process.env.UPTIME_KUMA_NODE_ID
  
  if (!nodeId) {
    return null
  }
  
  const nodeName = process.env.NODE_NAME || process.env.UPTIME_KUMA_NODE_NAME || nodeId
  const host = process.env.NODE_HOST || process.env.UPTIME_KUMA_NODE_HOST || `localhost:3000`
  const isPrimary = process.env.UPTIME_KUMA_PRIMARY === 'true' || nodeId === 'node1'
  
  return {
    nodeId,
    nodeName,
    host,
    isPrimary
  }
}

/**
 * 初始化節點 - 在啟動時調用
 */
export async function initializeNode(): Promise<void> {
  const config = getNodeConfig()
  
  if (!config) {
    console.log('[Node] No NODE_ID set, skipping node initialization')
    return
  }
  
  console.log(`[Node] Initializing node: ${config.nodeId} (${config.nodeName})`)
  
  try {
    // 使用 upsert 來創建或更新節點
    await prisma.node.upsert({
      where: { nodeId: config.nodeId },
      update: {
        nodeName: config.nodeName,
        host: config.host,
        status: 'online',
        lastSeen: new Date(),
        modifiedAt: new Date()
      },
      create: {
        nodeId: config.nodeId,
        nodeName: config.nodeName,
        host: config.host,
        status: 'online',
        isPrimary: config.isPrimary,
        active: true,
        lastSeen: new Date()
      }
    })
    
    // 如果是主節點，確保其他節點不是主節點
    if (config.isPrimary) {
      await prisma.node.updateMany({
        where: {
          nodeId: { not: config.nodeId },
          isPrimary: true
        },
        data: {
          isPrimary: false
        }
      })
      
      // 確保當前節點是主節點
      await prisma.node.update({
        where: { nodeId: config.nodeId },
        data: { isPrimary: true }
      })
    }
    
    console.log(`[Node] Node ${config.nodeId} initialized successfully`)
    console.log(`[Node]   Name: ${config.nodeName}`)
    console.log(`[Node]   Host: ${config.host}`)
    console.log(`[Node]   Primary: ${config.isPrimary}`)
    
  } catch (error: any) {
    console.error(`[Node] Failed to initialize node ${config.nodeId}:`, error.message)
    // 不要讓節點初始化失敗阻止整個應用啟動
  }
}

/**
 * 取得當前節點資訊
 */
export async function getCurrentNode() {
  const nodeId = process.env.NODE_ID || process.env.UPTIME_KUMA_NODE_ID
  
  if (!nodeId) {
    return null
  }
  
  return await prisma.node.findUnique({
    where: { nodeId }
  })
}

/**
 * 更新節點心跳
 */
export async function updateNodeHeartbeat(): Promise<void> {
  const nodeId = process.env.NODE_ID || process.env.UPTIME_KUMA_NODE_ID
  
  if (!nodeId) {
    return
  }
  
  try {
    await prisma.node.update({
      where: { nodeId },
      data: {
        status: 'online',
        lastSeen: new Date()
      }
    })
  } catch (error) {
    // 忽略錯誤
  }
}
