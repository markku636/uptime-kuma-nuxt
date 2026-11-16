# Uptime Kuma Nuxt

基於 [Uptime Kuma](https://github.com/louislam/uptime-kuma) 設計理念，使用 **Nuxt.js 4** 重新開發的現代化監控系統。

![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?style=flat-square&logo=nuxt.js)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vue.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?style=flat-square&logo=prisma)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker)

---

## ✨ 功能特色

### 🖥️ 監控類型
- **HTTP(s)** - 網站監控、關鍵字檢測、JSON 查詢
- **TCP Port** - 端口連接測試
- **Ping** - ICMP 網路監控
- **DNS** - DNS 解析監控
- **Push** - 被動推送監控
- **Docker** - 容器健康檢查
- **gRPC** - gRPC 服務監控
- **Database** - PostgreSQL、MySQL、MSSQL、MongoDB、Redis 連線監控
- **MQTT** - 消息佇列監控
- **Kafka** - Kafka 叢集監控
- **RabbitMQ** - RabbitMQ 監控
- **Game Server** - 遊戲伺服器監控 (透過 GameDig)

### 🔔 通知渠道
- Email (SMTP)
- Webhook
- Discord
- Slack
- Telegram
- Microsoft Teams
- 更多...

### 📊 功能亮點
- 📈 多語言支援 (70+ 語言)
- 🎨 深色/淺色主題
- 🔐 雙因素驗證 (2FA)
- 📱 響應式設計
- 📄 公開狀態頁面
- 🔧 維護排程管理
- 🏷️ 標籤分組管理
- 🗂️ 工作區與群組（可巢狀）
- 🔑 API Key 管理
- 🌐 Proxy 代理支援
- 🖥️ Remote Browser 支援

### 🗂️ 工作區與群組

監控項目以兩層方式整理：**工作區 → 群組（可再包含子群組）→ 監控項目**。

- **管理位置**：設定 → 工作區與群組。可新增、編輯、刪除、調整工作區順序，並以拖曳、「移動到」選單或勾選後批次移動監控項目。
- **快捷操作**：儀表板與監控列表上方可切換工作區（選擇會被記住）；群組列可直接新增監控、編輯、整組暫停／恢復；新增／編輯監控的表單可選擇或即時建立工作區與群組。
- **規則**
  - 加入群組的監控（含子群組）一律歸屬於該群組所在的工作區；群組換工作區時，成員會一起移動。
  - 群組狀態由成員彙整：任一成員離線即離線、有成員等待中即等待中、全部正常才正常；暫停與維護中的成員不列入。成員狀態改變時，群組會在數秒內更新。
  - 刪除工作區或群組**不會刪除**其中的監控項目：刪除工作區後成員變為未指定工作區，刪除群組後成員往上移一層。
- **API**：`/api/v1/workspaces`、`/api/v1/groups`（含 `/{id}/pause`、`/{id}/resume`）、`POST /api/v1/workspaces/reorder`、`POST /api/v1/monitors/organize`，詳見 `/api-docs`。
- **備份**：匯出檔包含工作區；還原時會重建群組結構、標籤、通知、狀態頁與維護的關聯。

---

## 📁 專案結構

```
nuxtjs/
├── app.vue                 # 應用程式入口
├── nuxt.config.ts          # Nuxt 配置
├── package.json            # 依賴配置
├── prisma/
│   └── schema.prisma       # 資料庫模型定義
├── assets/
│   └── css/                # 全域樣式
├── components/             # Vue 元件
│   ├── auth/               # 認證相關元件
│   ├── dashboard/          # 儀表板元件
│   ├── monitor/            # 監控相關元件
│   ├── notification/       # 通知元件
│   ├── status-page/        # 狀態頁面元件
│   ├── maintenance/        # 維護管理元件
│   └── ...
├── composables/            # Vue Composables
│   ├── useAuth.ts          # 認證邏輯
│   ├── useMonitors.ts      # 監控邏輯
│   ├── useSocket.ts        # WebSocket 連接
│   └── ...
├── layouts/                # 頁面布局
│   ├── default.vue         # 預設布局
│   ├── auth.vue            # 認證頁面布局
│   └── public.vue          # 公開頁面布局
├── locales/                # 國際化語言檔
├── middleware/             # 路由中介層
├── pages/                  # 頁面路由
│   ├── index.vue           # 首頁
│   ├── login.vue           # 登入頁
│   ├── setup.vue           # 設定頁
│   ├── dashboard/          # 儀表板頁面
│   ├── monitors/           # 監控管理頁面
│   ├── status-pages/       # 狀態頁面管理
│   ├── maintenance/        # 維護管理
│   └── settings/           # 設定頁面
├── plugins/                # Nuxt 插件
├── server/                 # 後端 API
│   ├── api/                # API 路由
│   │   ├── auth/           # 認證 API
│   │   ├── v1/             # RESTful API v1
│   │   │   ├── monitors/   # 監控 CRUD
│   │   │   ├── notifications/ # 通知 CRUD
│   │   │   ├── status-pages/  # 狀態頁面 CRUD
│   │   │   ├── maintenances/  # 維護 CRUD
│   │   │   ├── tags/       # 標籤 CRUD
│   │   │   ├── proxies/    # 代理 CRUD
│   │   │   └── ...
│   │   ├── cluster/        # 叢集管理 API
│   │   ├── health.get.ts   # 健康檢查
│   │   └── metrics.get.ts  # Prometheus 指標
│   ├── jobs/               # 背景任務
│   ├── services/           # 業務邏輯服務
│   └── utils/              # 工具函數
├── stores/                 # Pinia 狀態管理
├── types/                  # TypeScript 類型定義
└── docker-compose*.yaml    # Docker 部署配置
```

---

## 🛠️ 技術棧

| 類別 | 技術 |
|------|------|
| **Frontend** | Nuxt 4, Vue 3.5, Nuxt UI 4, Pinia |
| **Backend** | Nitro (Nuxt Server), Prisma ORM |
| **Database** | PostgreSQL 16 |
| **Real-time** | Socket.IO |
| **Authentication** | nuxt-auth-utils, bcryptjs, otplib (2FA) |
| **i18n** | @nuxtjs/i18n (70+ 語言) |
| **Styling** | Tailwind CSS, @nuxt/ui |
| **Container** | Docker, Docker Compose |
| **Load Balancer** | OpenResty (Nginx + Lua) |

---

## 🚀 快速開始

### 環境需求

- Node.js 20+
- PostgreSQL 16+
- npm / pnpm / yarn

### 本地開發

1. **安裝依賴**

```bash
npm install
```

2. **設定環境變數**

建立 `.env` 檔案：

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/uptime_kuma?schema=public
JWT_SECRET=your-secret-key-change-this-in-production
NUXT_SESSION_PASSWORD=your-session-password-at-least-32-chars
```

3. **初始化資料庫**

```bash
npm run db:generate
npm run db:push
```

4. **啟動開發伺服器**

```bash
npm run dev
```

訪問 http://localhost:32400

---

## 🐳 Docker 部署

### 單節點部署

```bash
docker-compose -f docker-compose.single.yml up -d --build
```

### 叢集部署 (推薦用於生產環境)

```bash
# 啟動 3 節點叢集 (預設)
docker-compose -f docker-compose-cluster.yaml up -d --build

# 啟動 5 節點叢集 (擴展模式)
docker-compose -f docker-compose-cluster.yaml --profile extended up -d --build
```

### 叢集架構

```
                    ┌─────────────────┐
                    │   OpenResty     │
                    │  Load Balancer  │
                    │   :32400        │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│     Node 1      │ │     Node 2      │ │     Node 3      │
│   (Primary)     │ │                 │ │                 │
│    :32411       │ │    :32412       │ │    :32413       │
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │   PostgreSQL    │
                    │     :32402      │
                    └─────────────────┘
```

### 叢集管理 API

| 方法 | 端點 | 說明 |
|------|------|------|
| GET | `/api/cluster/nodes` | 取得所有節點狀態 |
| GET | `/api/cluster/current` | 取得當前節點資訊 |
| POST | `/api/cluster/switch` | 切換節點 |

**切換節點範例：**
```bash
curl -X POST http://localhost:32400/api/cluster/switch \
  -H "Content-Type: application/json" \
  -d '{"node": "node2"}'
```

---

## 📦 可用腳本

```bash
# 開發
npm run dev           # 啟動開發伺服器 (port 32400)

# 建置
npm run build         # 建置生產版本
npm run preview       # 預覽生產版本
npm run generate      # 生成靜態網站

# 資料庫
npm run db:generate   # 生成 Prisma Client
npm run db:push       # 同步資料庫結構

# API
npm run bruno:generate  # 由 server/openapi/spec.ts 重新產生 bruno/ collection
```

---

## 🔌 API 文件

啟動伺服器後，訪問以下端點：

- **Swagger UI**: `/api-docs`
- **OpenAPI JSON**: `/api/swagger-json`
- **健康檢查**: `/api/health`
- **Prometheus 指標**: `/api/metrics`

### API Key

`/api/v1/*` 可用 API Key 取代登入，金鑰以建立者身分執行：

```bash
curl -H "X-API-Key: uk_xxx" http://localhost:32400/api/v1/monitors
```

```bash
curl -H "Authorization: Bearer uk_xxx" http://localhost:32400/api/v1/monitors
```

金鑰無效、停用、過期或擁有者被停用時回傳 401（不會退回使用 Cookie）。

### Bruno

[Bruno](https://www.usebruno.com/) collection 位於 `bruno/`，涵蓋所有 API 端點。

1. Bruno → **Open Collection** → 選擇專案的 `bruno/` 資料夾
2. 選擇 **Local** 環境，擇一驗證（皆為 secret 變數，只存在本機，不會進版控）：
   - 填入 `password` 並執行 **Auth / Login**，Session Cookie 會自動套用到其他請求
   - 或填入 `apiKey`（設定 → API Keys 建立的 `uk_...`），collection 會自動對 `/api/v1/*` 加上 `X-API-Key`
3. API Key 只適用 `/api/v1/*`，且不能管理 API Key 本身（回傳 403）；`/api/auth/*`、`/api/settings/*` 仍需登入
4. 「Create ...」請求會把新建的 id 存入變數（`monitorId`、`tagId`…），同資料夾的查詢／更新／刪除請求會直接使用

```bash
# 只讀冒煙測試（需安裝 Bruno CLI，並以 --env-var password=... 提供密碼）
cd bruno && bru run --env Local --tags smoke
```

也可以把 `/api/swagger-json` 以 **Import Collection → OpenAPI V3** 匯入 Bruno。

`bruno/` 與 OpenAPI 文件都由 `server/openapi/spec.ts` 產生。新增或修改 API 後更新該檔並執行：

```bash
npm run bruno:generate
```

`npm test` 會檢查 `server/api` 下的每個路由都已登錄在 `server/openapi/spec.ts`。

---

## 🌐 環境變數

| 變數名稱 | 說明 | 預設值 |
|----------|------|--------|
| `DATABASE_URL` | PostgreSQL 連接字串 | - |
| `JWT_SECRET` | JWT 簽名密鑰 | - |
| `NUXT_SESSION_PASSWORD` | Session 加密密碼 (32+ 字元) | - |
| `NUXT_PUBLIC_APP_URL` | 應用程式公開 URL | `http://localhost:32400` |
| `NODE_ID` | 節點 ID (叢集模式) | `node1` |
| `NODE_NAME` | 節點名稱 (叢集模式) | `Node 1` |
| `IS_PRIMARY` | 是否為主節點 | `false` |

---

## 📝 License

MIT License

---

## 🙏 致謝

- [Uptime Kuma](https://github.com/louislam/uptime-kuma) - 原始專案靈感來源
- [Nuxt](https://nuxt.com) - Vue.js 全端框架
- [Prisma](https://prisma.io) - 現代化 ORM
- [Nuxt UI](https://ui.nuxt.com) - UI 元件庫 
