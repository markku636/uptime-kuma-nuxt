// 取得當前選擇的節點
export default defineEventHandler(async (event) => {
  const cookie = getCookie(event, 'selected_node')
  
  return {
    node: cookie || 'auto',
    mode: cookie ? 'manual' : 'auto',
    currentNodeId: process.env.NODE_ID || 'dev',
    currentNodeName: process.env.NODE_NAME || 'Development'
  }
})
