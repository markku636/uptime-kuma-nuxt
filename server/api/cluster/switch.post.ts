// 切換節點
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const targetNode = body?.node
  
  if (!targetNode) {
    throw createError({
      statusCode: 400,
      statusMessage: "Missing 'node' field in request body"
    })
  }
  
  // 如果不是 auto，驗證節點是否存在於資料庫
  if (targetNode !== 'auto') {
    const node = await prisma.node.findUnique({
      where: { nodeId: targetNode }
    })
    
    if (!node) {
      throw createError({
        statusCode: 400,
        statusMessage: `Node '${targetNode}' not found`
      })
    }
  }
  
  // 設定 Cookie
  if (targetNode === 'auto') {
    // 清除 Cookie
    deleteCookie(event, 'selected_node')
  } else {
    // 設定選擇的節點 (7天有效)
    setCookie(event, 'selected_node', targetNode, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
      httpOnly: false // 讓前端也能讀取
    })
  }
  
  return {
    success: true,
    node: targetNode,
    message: targetNode === 'auto' ? 'Switched to auto mode' : `Switched to ${targetNode}`
  }
})
