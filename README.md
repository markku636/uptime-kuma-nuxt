# SealWatch Nuxt

基於 [SealWatch](https://github.com/louislam/uptime-kuma) 設計理念，使用 **Nuxt.js 4** 重新開發的現代化監控系統。

![Nuxt](https://img.shields.io/badge/Nuxt-4.x-00DC82?style=flat-square&logo=nuxt.js)
![Vue](https://img.shields.io/badge/Vue-3.5-4FC08D?style=flat-square&logo=vue.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql)
![Prisma](https://img.shields.io/badge/Prisma-6.x-2D3748?style=flat-square&logo=prisma)
![Docker](https://img.shields.io/badge/Dockerfile-provided-2496ED?style=flat-square&logo=docker)

---

## ✨ 功能特色

### 🖥️ 監控與 API 能力

- HTTP(s)、關鍵字與安全 JSON 查詢；支援 status/header/body/JSON/response-time 宣告式回應斷言與試跑。
- Push 回報與漏報偵測（超過間隔兩倍、至少 60 秒沒回報就轉為 DOWN 並發通知）；
  workspace／environment 隔離、API key 權限、加密且不可回讀的 request／環境 secrets。
- Bruno `.bru` 宣告式子集 preview／原子 paused import／placeholder export；monitor 編輯頁提供 **Bruno 風格 UI 編輯器**（Params/Body/Headers/Auth/Vars/Script/Assert/Tests/Docs/Settings 十分頁、Raw 切換、Bulk Edit、`{{變數}}` 自動完成、頁內環境變數編輯、Send 回應面板）。JavaScript scripts/tests **保留但永不執行**；未支援 auth 與格式會明確拒絕，見 [相容矩陣](docs/BRUNO_COMPATIBILITY.md)。
- **Website audit（網站健檢）**：dashboard 一鍵對 URL 做 bounded 巡檢——HTTP 狀態／重新導向、
  TLS 憑證（有效期／信任／SAN）、DNS、六項 security headers、頁面 metadata、同站連結與混合內容，
  另可指定預期關鍵字；輸出 0–100 分／A–F 等級與逐項結果。走 `POST /api/v1/site-audit`，
  強制 deny private/metadata 目的地，不寫歷史、不發通知。對話框的「Schedule (hourly)」可建立
  `site-audit` monitor，分數進心跳、低於門檻發 DOWN 通知，最近 20 份去敏感報告可在監控詳情頁查看／下載。
- **Browser flows（合成瀏覽器流程）**：`/browser-flows` 提供宣告式步驟編輯器
  （goto／click／fill／waitFor／assertVisible／assertText／assertValue）、Test draft、Save、Test now、
  間隔（預設每小時）；worker 以 Playwright headless Chromium 順序執行、逐步計時與失敗原因，不執行任意 JS。
  排程失敗會在監控詳情頁留一張截圖與逐步 trace。
  artifact 已內建 Chromium 與 bookworm 系統函式庫（`PLAYWRIGHT_BROWSERS_PATH`／`LD_LIBRARY_PATH`）。
- **Bruno multi-API tests**：Bruno collection 可宣告式建立測試流程（suite），跨步驟以
  `res.body.token` 等白名單萃取變數帶到下一步，手動執行後在站內看逐步報告並下載 JSON／CSV；
  不執行 Bruno script/tests、不進 availability／通知，見 [Bruno 相容矩陣](docs/BRUNO_COMPATIBILITY.md)。
- PostgreSQL lease/fencing、多 API／worker、Kubernetes 多節點部署設定。

舊 TCP、Ping、DNS、Docker、gRPC、database、MQTT、Kafka、RabbitMQ、GameDig 等配置可保留，但目前分散 worker 沒有對應 bounded adapter，會顯示 unsupported；不要視為已可排程。HTTP proxy、NTLM/mTLS 同樣未支援，不會悄悄改成直接連線。

2026-11-22 迭代新增：
- **Quick add**：首頁輸入單一 URL 即以 HTTP/GET、60 秒間隔建立監控；進階表單仍保留完整選項。
- **24 小時可用率**：首頁卡片與列表顯示近期 uptime%（無 24h 觀測值時回退顯示 30d 並標明期間），
  透過 `/api/v1/monitors/uptime-batch` 以 workspace/environment 範圍批量查詢。
- **Response-time alerts**：監控 Timing 可設「Alert if response time exceeds (ms)」。
  健康檢查從未超標跨到超標時，經既有 durable outbox 發出通知，每個監控/通道每小時最多一次；
  90 天以上的 dedupe key 由 cleanup 定期移除。
- **可撤銷工作階段**：登入會建立伺服器端 session record；Settings > Security 可列出裝置/IP/最後活動、
  撤銷單一或撤銷其他所有工作階段（後者同時提升 sessionVersion 並重發目前 cookie）；
  改密碼與登出會撤銷對應 record，WebSocket ticket 亦綁定 session record。

### 🔔 通知渠道

Webhook、Discord、Slack、Telegram、LINE 與 email 透過 bounded transport 與 durable outbox 發送。
Email 僅能走操作者設定的 SMTP relay（`SMTP_HOST`／`SMTP_PORT`／`SMTP_FROM`，選擇性
`SMTP_USER`／`SMTP_PASS`）；收件者寫在通知資源內，SMTP host/憑證不接受使用者輸入以避免 SSRF。
未設定 relay 時 email 通知會標記為 `UNSUPPORTED_PROVIDER` 而不重試。其他提供者仍明確 unsupported。
通知送出後本機 ACK 前故障仍可能重送，不承諾外部 exactly-once。

### 📊 功能亮點
- 📈 多語言支援 (70+ 語言)
- 🎨 深色/淺色主題
- 🔐 雙因素驗證 (2FA)
- 📱 響應式設計
- 📄 公開狀態頁面
- 🔧 維護排程管理
- 🏷️ 標籤分組管理
- 🔑 API Key 管理
- 🔒 Proxy／Remote Browser 設定有安全憑證管理；不代表本版 HTTP worker 已整合這些 transport

---

近期迭代（2026-11-28）：
- 新增 Website audit 與 Browser flows，兩者都只做 bounded、明確拒絕私網目的地；
  browser-flow 為可排程 monitor（心跳／通知沿用既有機制），Website audit 為按需檢查不落 DB。
- OpenAPI 補 `/v1/site-audit`、`SiteAuditRequest`、`BrowserFlowConfig`，並更新可排程型別說明。
- 既有 Bruno 測試流程（多支 `.bru` 順序執行＋跨步驟變數＋JSON/CSV 報告）上線。

近期迭代（2026-11-22）：
- 首頁／監控列表顯示近期 uptime%（24h，無資料時回退 30d），Quick add 單一 URL 建立 HTTP 監控。
- 通知：response-time 超標提醒、持續 DOWN 的週期性提醒、email 走操作者設定的 SMTP relay。
- 工作階段可逐筆撤銷（撤銷後該 socket 也斷線）；登出不再把其他裝置一起登出。
- 狀態頁：可選密碼保護（防 RSS 繞過）、新增時正確保存 monitor／GA／密碼、公開頁有 SEO meta。
- 監控詳情可匯出最近 10,000 筆心跳為 CSV；心跳欄位若含試算表公式字元會自動转义。
- Debug Info 顯示真實版本／DB version／容器狀態；設定頁的無效欄位已移除或改為真正生效。
- **Reports**：24h／7d／30d／1y 可用性與 SLA 報表，可排序並匯出 CSV。
- 監控詳情 **Check now**：執行中的 monitor 提前下一次檢查；paused monitor 做一次性 bounded 檢查（不寫歷史、不發通知）。
- 狀態頁可切換個別 monitor 是否顯示目標網址；全域 API key（`gk_`）可在 Settings 產生／Rotate／Revoke。
- TLS 到期通知天數的全域設定現在與通知引擎使用同一設定鍵；時區設定套用於通用時間元件與監控詳情。

不支援（畫面已明確標示）：Real Browser screenshot、Ping packet count/size、
Monitor Conditions、自訂網域、舊類型 checker（TCP/Ping/DNS/SNMP 等可保存但不排程）。
多地點探測、SMS/voice 通知不在本部署範圍。

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
| **多節點協調** | PostgreSQL leases／NOTIFY＋bounded resync；API Service／自有 ingress |

---

## 🚀 快速開始

### 環境需求

- Node.js 24（package engines 最低 22.18）
- PostgreSQL 16
- npm 與已提交的 package-lock.json

### 本地開發

1. **安裝依賴**

```bash
npm ci
```

2. **設定環境變數**

由 `.env.example` 建立本機不提交的 `.env`，填入自己的 PostgreSQL URL、隨機 `NUXT_SESSION_PASSWORD`（至少32字元）與 `APP_ENCRYPTION_KEY`（64 hex）。不要沿用公開預設值。保留 encryption key 與 DB 備份，否則密文無法恢復。

3. **以版本化 migration 初始化資料庫**

```bash
npm run db:generate
node --env-file=.env scripts/migrate.mjs
```

既有安裝先備份並停止舊 scheduler；未知／不完整 legacy schema 會拒絕遷移，不能用 `db push` 覆蓋。第一次登入前在私人入口完成 admin setup，再公開服務。

4. **啟動開發伺服器**

```bash
npm run dev
```

訪問 http://localhost:32400

---

## 🐳 Docker 與 Kubernetes 部署

單機使用 Docker Compose V2 的 canonical 配置。先私下設定 `POSTGRES_PASSWORD`、指向 `db:5432/uptime_kuma` 的 `DATABASE_URL`、session/encryption keys；URL中的特殊密碼字元需正確編碼。

```bash
docker compose -f docker-compose.single.yml up -d --build
```

DB健康後執行獨立 migration service，成功才啟動 APP_ROLE=all；入口為 http://localhost:32401。預設不提供帳密。`docker-compose.yml` 與舊 `docker-compose-cluster.yaml` 現在透過 Compose include 導向同一單機配置，**不再啟動3／5個 OpenResty nodes**，也沒有 `--profile extended` 叢集。

Kubernetes 正式多節點使用 immutable application image、外部 PostgreSQL、兩 API＋兩 worker；application Pods 不依賴 shared artifact PVC。詳見 [Kubernetes 操作流程](docs/KUBERNETES_DEPLOYMENT.md)、[實際 manifests](deploy/README.md) 與 [runtime 契約](docs/CLUSTER_RUNTIME.md)。修改／發布本任務部署仍由 root 走 v-terminal GitOps。

本次 lab 只有一個 Ready node。官方 Node base＋SHA artifact 的 demo 可驗多 Pod 協調與重建，不能宣稱跨 node failover；Dockerfile build、built-image runtime、artifact runtime 亦分開記錄。最新結果與未完成項見 [證據索引](docs/validation/EVIDENCE_INDEX.md)。使用者已取消 4000 活躍容量驗證，最終保留5筆 demo。

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
node --env-file=.env scripts/migrate.mjs  # 套用版本化 migrations（先備份）
```

---

## 🔌 API 文件

啟動伺服器後，訪問以下端點：

- **Swagger UI**: `/api-docs`
- **OpenAPI JSON**: `/api/swagger-json`
- **Monitor／maintenance REST 使用說明**: [REST_API.md](docs/REST_API.md)
- **健康檢查**: `/api/health/live`、`/api/health/ready`
- **Prometheus 指標**: `/api/v1/metrics`（workspace/environment scoped）；`/api/metrics`（platform admin）
- **測試重現**: [TESTING.md](docs/TESTING.md)

---

## 🌐 環境變數

| 變數名稱 | 說明 |
|----------|------|
| `DATABASE_URL` | PostgreSQL URL；多節點所有 process 連同一 DB |
| `NUXT_SESSION_PASSWORD` | 隨機 session secret，32+ 字元，所有 API 相同 |
| `APP_ENCRYPTION_KEY` | 隨機64 hex，所有 API／worker相同，需安全備份 |
| `APP_ROLE` | `api`／`worker`／`all`，預設 all；K8s分開兩種 Deployment |
| `NUXT_PUBLIC_APP_URL` | 主要公開 origin |
| `APP_ALLOWED_ORIGINS` | 額外完整 origins，逗號分隔；無 wildcard |
| `WORKER_CONCURRENCY`／`WORKER_PER_ORIGIN` | 每 process 全域／origin並行上限，預設32／8 |
| `HEARTBEAT_RETENTION_ENABLED` | 預設false；先驗聚合／備份再顯式開啟刪除 |

`NODE_ID`／`IS_PRIMARY` 不再分配工作，worker 每次啟動使用新 UUID。完整設定見 [.env.example](.env.example) 與 [CLUSTER_RUNTIME.md](docs/CLUSTER_RUNTIME.md)。

---

## 📝 License

MIT License

---

## 🙏 致謝

- [SealWatch](https://github.com/louislam/uptime-kuma) - 原始專案靈感來源
- [Nuxt](https://nuxt.com) - Vue.js 全端框架
- [Prisma](https://prisma.io) - 現代化 ORM
- [Nuxt UI](https://ui.nuxt.com) - UI 元件庫 
