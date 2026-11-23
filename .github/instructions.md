# Instructions

快速上手 SealWatch Nuxt 專案指南。

---

## 1. 安裝步驟

### 前置需求
- Docker Desktop（最新版）
- Node.js 18+
- PowerShell 5.1+

### Docker 集群模式（推薦）
```powershell
# 進入專案目錄
cd nuxtjs

# 啟動完整集群（含 PostgreSQL + OpenResty）
docker compose up -d --build

# 確認容器狀態
docker ps
```

### 單機開發模式
```powershell
# 安裝依賴
npm install

# 生成 Prisma Client
npm run db:generate

# 同步資料庫結構
npm run db:push

# 啟動開發伺服器
npm run dev
```

---

## 2. 使用方式

### 存取服務
| 服務 | 網址 |
|:---|:---|
| Web UI | http://localhost:32400 |
| 開發模式 | http://localhost:32400 |
| API 健康檢查 | http://localhost:32400/api/health |

### 常用指令
```powershell
# 查看集群狀態
docker compose ps

# 查看日誌
docker compose logs -f

# 停止集群
docker compose down

# 重建並啟動
docker compose up -d --build

# Prisma 資料庫操作
npm run db:push      # 同步 schema 到資料庫
npm run db:generate  # 生成 Prisma Client
```

### API 測試
使用 VS Code 開啟 `api-test.http`，搭配 REST Client 擴充套件測試 API。

---

## 3. 注意事項

- ⚠️ 首次啟動需等待 PostgreSQL 初始化完成
- ⚠️ 修改 `prisma/schema.prisma` 後需執行 `npm run db:push`
- ⚠️ Port 32400 需未被佔用
- ✅ 可透過 `api-test.http` 驗證 API 是否正常運作
- ✅ 詳細文件請參考 `README.md`
