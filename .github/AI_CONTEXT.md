# AI Context - Uptime Kuma Nuxt

> 此文件專為 AI 工具（如 GitHub Copilot、ChatGPT）設計，提供專案快速理解脈絡。

## 專案定位

**Uptime Kuma Nuxt** 是使用 **Nuxt.js 4** 重構的 Uptime Kuma 監控系統，支援高可用多節點集群架構。

### 技術特點

| 項目 | 技術 |
|:---|:---|
| 框架 | Nuxt.js 4 (Vue 3) |
| 資料庫 | PostgreSQL (Prisma ORM) |
| 狀態管理 | Pinia |
| 負載均衡 | OpenResty (Nginx + Lua) |
| UI 元件 | Nuxt UI 4 |
| 國際化 | @nuxtjs/i18n |
| 容器化 | Docker Compose |

---

## 技術架構

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Request                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              OpenResty (Nginx + Lua)                        │
│         負載均衡 / 節點切換 / 健康檢查                       │
└─────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Node 1     │    │   Node 2     │    │   Node 3     │
│ (Nuxt.js 4)  │    │ (Nuxt.js 4)  │    │ (Nuxt.js 4)  │
│   :3001      │    │   :3002      │    │   :3003      │
└──────────────┘    └──────────────┘    └──────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │   (共用資料庫)  │
                    └─────────────────┘
```

---

## 關鍵程式碼位置

### 伺服器端 API

| 路徑 | 說明 |
|:---|:---|
| `server/api/` | Nuxt Server API 端點 |
| `server/api/v1/` | RESTful API v1 |
| `server/api/auth/` | 認證相關 API |
| `server/api/cluster/` | 集群管理 API |
| `server/api/status-page/` | 狀態頁面 API |
| `server/services/` | 業務邏輯服務 |
| `server/services/monitor/` | 監控服務 |
| `server/services/notification/` | 通知服務 |
| `server/jobs/` | 背景排程任務 |
| `server/middleware/` | 伺服器中介軟體 |

### 前端

| 路徑 | 說明 |
|:---|:---|
| `pages/` | 頁面路由 |
| `components/` | Vue 組件 |
| `components/monitor/` | 監控相關組件 |
| `components/dashboard/` | 儀表板組件 |
| `components/status-page/` | 狀態頁面組件 |
| `stores/` | Pinia 狀態管理 |
| `composables/` | Vue Composables |
| `layouts/` | 頁面佈局 |

### 負載平衡 (OpenResty)

| 路徑 | 說明 |
|:---|:---|
| `nginx/nginx.conf` | Nginx 主配置 |
| `nginx/nginx-cluster.conf` | 集群配置 |
| `nginx/lua/` | Lua 腳本 |

### 資料庫

| 路徑 | 說明 |
|:---|:---|
| `prisma/schema.prisma` | Prisma Schema 定義 |
| `prisma/seed.ts` | 資料庫種子資料 |
| `prisma/init.sql` | 初始化 SQL |

### 部署

| 路徑 | 說明 |
|:---|:---|
| `docker-compose.yml` | Docker 集群部署 |
| `docker-compose.single.yml` | 單節點部署 |
| `docker-compose-cluster.yaml` | 多節點集群部署 |
| `Dockerfile` | 主 Dockerfile |

---

## 環境變數速查

| 變數 | 說明 |
|:---|:---|
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `JWT_SECRET` | JWT 密鑰 |
| `NUXT_PUBLIC_APP_URL` | 公開 URL |
| `NUXT_SESSION_PASSWORD` | Session 密碼 |
| `NODE_ID` | 節點 ID（集群模式）|
| `IS_PRIMARY` | 是否為主節點 |

---

## API 端點概覽

### 集群 API

```
GET  /api/cluster/nodes          # 取得所有節點狀態
GET  /api/cluster/current        # 取得當前節點
POST /api/cluster/switch         # 切換節點
```

### RESTful API

```
GET    /api/v1/monitors          # 列出監控
POST   /api/v1/monitors          # 建立監控
GET    /api/v1/monitors/:id      # 取得監控
PUT    /api/v1/monitors/:id      # 更新監控
DELETE /api/v1/monitors/:id      # 刪除監控
GET    /api/v1/notifications     # 通知列表
GET    /api/v1/status-pages      # 狀態頁面列表
GET    /api/health               # 健康檢查
```

---

## 常見開發模式

### 新增 API 端點
1. 在 `server/api/v1/` 建立新檔案
2. 使用 `defineEventHandler` 定義處理器
3. 範例：`server/api/v1/my-endpoint.get.ts`

### 新增服務
1. 在 `server/services/` 建立新服務
2. 使用現有服務模式

### 新增組件
1. 在 `components/` 建立組件
2. 使用 Nuxt UI 元件庫

### 資料庫變更
1. 修改 `prisma/schema.prisma`
2. 執行 `npm run db:push` 同步

---

## 相關文件

| 文件 | 說明 |
|:---|:---|
| `README.md` | 專案說明 |
| `MIGRATION_CHECKLIST.md` | 遷移檢查清單 |
| `NUXT_CLUSTER_DEPLOYMENT_PLAN.md` | 集群部署計畫 |
| `.github/instructions.md` | 快速上手指南 |
