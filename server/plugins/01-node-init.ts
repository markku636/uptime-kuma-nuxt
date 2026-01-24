// server/plugins/01-node-init.ts
// 節點初始化插件 - 在資料庫初始化後立即運行

import { initializeNode, updateNodeHeartbeat } from '../utils/node-initializer'

let heartbeatInterval: NodeJS.Timeout | null = null

export default defineNitroPlugin(async (nitroApp) => {
  console.log('[Node Init] Starting node initialization...')
  
  try {
    // 初始化節點 - 根據環境變數註冊到資料庫
    await initializeNode()
    
    // 設定心跳定時器 (每 30 秒更新一次)
    heartbeatInterval = setInterval(() => {
      updateNodeHeartbeat().catch((err) => {
        console.error('[Node Init] Heartbeat update failed:', err.message)
      })
    }, 30000)
    
    console.log('[Node Init] Node initialization completed')
  } catch (error: any) {
    console.error('[Node Init] Failed to initialize node:', error.message)
    // 不要讓節點初始化失敗阻止整個應用啟動
  }

  // 關閉時清理
  nitroApp.hooks.hook('close', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval)
      heartbeatInterval = null
    }
    console.log('[Node Init] Node heartbeat stopped')
  })
})
