// 健康檢查 API
export default defineEventHandler(async (event) => {
  return {
    status: 'ok',
    nodeId: process.env.NODE_ID || 'unknown',
    nodeName: process.env.NODE_NAME || 'Unknown Node',
    timestamp: Date.now()
  }
})
