// 取得當前節點資訊
export default defineEventHandler(async (event) => {
  return {
    nodeId: process.env.NODE_ID || 'unknown',
    nodeName: process.env.NODE_NAME || 'Unknown Node',
    timestamp: Date.now()
  }
})
