// check-db.js - 檢查資料庫表格
import { PrismaClient } from '@prisma/client'

async function main() {
  const prisma = new PrismaClient()
  
  try {
    // 查詢所有表格
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `
    
    console.log('資料庫中的表格:')
    tables.forEach(t => console.log(`  - ${t.table_name}`))
    
    // 嘗試查詢 status_pages
    console.log('\n嘗試查詢 status_pages 表...')
    try {
      const statusPages = await prisma.statusPage.findMany()
      console.log(`找到 ${statusPages.length} 個 status pages`)
    } catch (e) {
      console.error('查詢 status_pages 失敗:', e.message)
    }
    
  } catch (error) {
    console.error('錯誤:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
