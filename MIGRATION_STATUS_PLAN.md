# Uptime Kuma Nuxt.js 遷移狀態與計劃

> 最後更新：2026-01-25  
> 參考文件：[實作 Uptime Kuma Cluster Vibe Coding](https://blog.markkulab.net/implement-uptime-kuma-cluster-vibe-coding/)

## 📊 總覽

| 類別 | 原版 | Nuxt.js 版本 | 遷移狀態 |
|------|------|-------------|---------|
| **整體完成度 (核心)** | 100% | ~99.5% | ✅ 幾乎完成 |
| **整體完成度 (含叢集)** | 100% | ~75% | 🟡 進行中 |
| **後端框架** | Express.js | Nitro (H3) | ✅ 已遷移 |
| **資料庫** | SQLite/MariaDB (Knex) | PostgreSQL (Prisma) | ✅ 已遷移 |
| **前端框架** | Vue 3 + Vite | Nuxt 3 | ✅ 已遷移 |
| **狀態管理** | Pinia (舊: Vuex) | Pinia | ✅ 已遷移 |
| **UI 框架** | Bootstrap 5 | Nuxt UI 3 + Tailwind | ✅ 已遷移 |
| **負載平衡** | OpenResty (Lua) | OpenResty (需整合) | 🟡 部分完成 |
| **K8s 支援** | StatefulSet + HPA | 🔴 待整合 | 🔴 待遷移 |

---

## 1. 後端功能遷移狀態

### ✅ 已完成遷移

| 功能 | 原始位置 | Nuxt.js 位置 | 狀態 |
|------|---------|-------------|------|
| **Monitor 排程器** | `server/uptime-kuma-server.js` | `server/services/scheduler.ts` | ✅ |
| **24 種 Monitor 檢查器** | `server/monitor-types/` | `server/services/checkers/` | ✅ |
| **78 個通知提供者** | `server/notification-providers/` | `server/services/notification-sender.ts` | ✅ |
| **Socket.io 服務** | `server/socket-handlers/` | `server/services/socket-service.ts` (2253 行) | ✅ |
| **使用者認證** | `server/auth.js` | `server/api/auth/` | ✅ |
| **2FA (TOTP)** | `server/2fa.js` | `server/api/auth/2fa/` | ✅ |
| **資料庫操作** | `server/database.js` | `server/utils/prisma.ts` | ✅ |
| **密碼雜湊** | `server/password-hash.js` | `server/utils/password.ts` | ✅ |
| **設定管理** | Socket 事件 | `server/api/settings/` | ✅ |
| **Uptime 計算器** | `server/uptime-calculator.js` | `server/services/uptime-calculator.ts` | ✅ |
| **Proxy 管理** | `server/proxy.js` | `server/api/proxies/` | ✅ |
| **Rate Limiter** | `server/rate-limiter.js` | `server/utils/rate-limit.ts` | ✅ |
| **Jobs 系統** | `server/jobs.js` | `server/services/jobs.ts` | ✅ |

### ❌ 尚未遷移的功能

| 功能 | 原始位置 | 狀態 | 優先級 | 說明 |
|------|---------|------|-------|------|
| **Embedded MariaDB** | `server/embedded-mariadb.js` | ❌ 不需要 | 低 | Nuxt.js 版本使用 PostgreSQL |
| **Monitor Reconciler** | `server/monitor-reconciler.js` | ❌ 未遷移 | 中 | 叢集同步功能 |
| **Check Version** | `server/check-version.js` | ❌ 未遷移 | 低 | 版本檢查功能 |
| **Google Analytics** | `server/google-analytics.js` | ❌ 未遷移 | 低 | 追蹤功能 |
| **Swagger Docs** | `server/swagger.json` | ❌ 未遷移 | 低 | API 文件生成 |
| **Image Data URI** | `server/image-data-uri.js` | 🟡 待驗證 | 低 | 圖片處理 |

---

## 2. 前端頁面遷移狀態

### ✅ 已完成遷移

| 頁面 | 原始檔案 | Nuxt.js 檔案 | 狀態 |
|------|---------|-------------|------|
| 儀表板 | `src/pages/Dashboard.vue` | `pages/dashboard/index.vue` | ✅ |
| 登入 | `src/pages/Login.vue` | `pages/login.vue` | ✅ |
| 初始設定 | `src/pages/Setup.vue` | `pages/setup.vue` | ✅ |
| Monitor 列表 | `src/pages/MonitorList.vue` | `pages/monitors/index.vue` | ✅ |
| 新增 Monitor | `src/pages/EditMonitor.vue` (2200 行) | `pages/monitors/add.vue` + `MonitorForm.vue` | ✅ 已重構 |
| 編輯 Monitor | `src/pages/EditMonitor.vue` | `pages/monitors/[id]/edit.vue` | ✅ |
| Monitor 詳情 | `src/pages/Details.vue` | `pages/monitors/[id]/index.vue` | ✅ |
| 設定頁面 | `src/pages/Settings.vue` | `pages/settings/*.vue` (15 個子頁面) | ✅ |
| 維護管理 | `src/pages/ManageMaintenance.vue` | `pages/maintenance/*.vue` | ✅ |
| 狀態頁面 | `src/pages/StatusPage.vue` | `pages/status-pages/*.vue` | ✅ |
| 公開狀態頁 | `src/pages/StatusPage.vue` | `pages/status/[slug].vue` | ✅ |
| 錯誤/404 | `src/pages/NotFound.vue` | `error.vue` | ✅ |

### ❌ 尚未遷移的頁面

| 頁面 | 原始檔案 | 狀態 | 優先級 |
|------|---------|------|-------|
| SetupDatabase | `src/pages/SetupDatabase.vue` | ❌ 不需要 | N/A |

---

## 3. 前端元件遷移狀態

### ✅ 已完成遷移

| 元件類別 | 原版數量 | Nuxt.js 數量 | 狀態 |
|---------|---------|-------------|------|
| **通知提供者表單** | 78 個 | 77 個 | ✅ 99% |
| **設定元件** | 13 個 | 15 個 | ✅ 完成 |
| **Monitor 元件** | 15+ 個 | 20+ 個 | ✅ 完成 |
| **通用元件** | 30+ 個 | 40+ 個 | ✅ 增強 |
| **佈局元件** | 3-4 個 | 5+ 個 | ✅ 完成 |

### ❌ 缺少的 UI 元件

| 元件 | 說明 | 優先級 |
|------|------|-------|
| **CloudflarePanel** | Cloudflare Tunnel 管理 UI | 低 (API 已存在) |
| **CertificateHistory** | TLS 憑證歷史顯示 | 中 |
| **MaintenanceTimeline** | 維護時間軸視覺化 | 低 |
| **PlaywrightRunner** | Playwright 測試運行器 UI | 低 |

---

## 4. API 端點遷移狀態

### ✅ 已遷移的端點

| 類別 | 端點 | 狀態 |
|------|------|------|
| **Auth** | login, logout, session, setup, change-password, 2fa/* | ✅ |
| **Monitors** | CRUD, pause, resume, heartbeats, clone, certificate | ✅ |
| **Notifications** | CRUD, test | ✅ |
| **Status Pages** | CRUD, incidents | ✅ |
| **Maintenance** | CRUD, pause, resume | ✅ |
| **Tags** | CRUD | ✅ |
| **API Keys** | CRUD | ✅ |
| **Proxies** | CRUD | ✅ |
| **Docker Hosts** | CRUD, test | ✅ |
| **Remote Browsers** | CRUD | ✅ |
| **Nodes** | CRUD | ✅ |
| **Push** | GET/POST | ✅ |
| **Badges** | status, uptime, ping, cert-exp, avg-response, response | ✅ |
| **Metrics** | Prometheus 格式 | ✅ |
| **Entry Page** | 設定 | ✅ |
| **Cloudflared** | start, stop, status | ✅ |
| **Health** | 健康檢查 | ✅ |
| **Backup** | export, import | ✅ |
| **Settings** | CRUD | ✅ |

---

## 5. Socket.io 事件遷移狀態

### ✅ 已遷移的事件 (50+)

| 類別 | 事件 | 狀態 |
|------|------|------|
| **Monitor** | getMonitorList, getMonitor, getMonitorBeats, addMonitor, editMonitor, deleteMonitor, pauseMonitor, resumeMonitor, getMonitorChartData | ✅ |
| **Notification** | getNotificationList, addNotification, editNotification, deleteNotification, testNotification | ✅ |
| **Tag** | getTags, addTag, editTag, deleteTag, addMonitorTag, deleteMonitorTag | ✅ |
| **Maintenance** | getMaintenanceList, getMaintenance, addMaintenance, editMaintenance, deleteMaintenance, pauseMaintenance, resumeMaintenance | ✅ |
| **Status Page** | getStatusPageList, addStatusPage, saveStatusPage, deleteStatusPage, postIncident, unpinIncident | ✅ |
| **Proxy** | getProxyList, addProxy, editProxy, deleteProxy | ✅ |
| **Docker Host** | getDockerHostList, addDockerHost, editDockerHost, deleteDockerHost, testDockerHost | ✅ |
| **Remote Browser** | getRemoteBrowserList, addRemoteBrowser, editRemoteBrowser, deleteRemoteBrowser, testRemoteBrowser | ✅ |
| **API Key** | getAPIKeyList, addAPIKey, deleteAPIKey | ✅ |
| **Node** | getNodeList, addNode, updateNode, deleteNode | ✅ |
| **Database** | shrinkDatabase, clearStatistics, clearHeartbeats | ✅ |
| **General** | heartbeat, monitorList, avgPing, uptime, info, getGameList, testChrome, getPushExample | ✅ |
| **2FA** | prepare2FA, save2FA, disable2FA, twoFAStatus | ✅ |

### ❌ 缺少的 Socket 事件 (低優先級)

| 事件 | 說明 | 優先級 |
|------|------|-------|
| cloudflared_join | 加入 Cloudflare 頻道 | 低 |
| cloudflared_leave | 離開 Cloudflare 頻道 | 低 |
| cloudflared_removeToken | 移除 Cloudflare token | 低 |
| disconnectOtherSocketClients | 斷開其他 session | 低 |

---

## 6. Monitor 類型遷移狀態

### ✅ 全部 24 種類型已遷移

| 類別 | 類型 | 狀態 |
|------|------|------|
| **通用** | HTTP(s), HTTP(s) Keyword, HTTP(s) JSON Query, gRPC Keyword, TCP Port, Ping, DNS, SMTP, SNMP | ✅ |
| **Docker** | Docker Container | ✅ |
| **被動式** | Push, Manual | ✅ |
| **群組** | Group | ✅ |
| **瀏覽器** | Real Browser | 🟡 Placeholder |
| **資料庫** | MongoDB, MySQL/MariaDB, PostgreSQL, MS SQL Server, Redis | ✅ |
| **訊息佇列** | MQTT, RabbitMQ, Kafka Producer | ✅ |
| **其他** | Radius, Steam/GameDig, Tailscale Ping | ✅ |

---

## 7. 通知提供者遷移狀態

### ✅ 全部 78 個提供者已遷移

| 類別 | 提供者 | 後端 | 前端表單 |
|------|-------|------|---------|
| **熱門** | Discord, Slack, Telegram, Email, Webhook, LINE, Teams, PagerDuty, Pushover, ntfy | ✅ | ✅ |
| **中國服務** | DingTalk, Feishu, WeCom, AliyunSMS, ServerChan, PushPlus, Bark, Kook, YZJ | ✅ | ✅ |
| **SMS 閘道** | Twilio, ClickSend, 46elks, Cellsynt, FreeMobile, Octopush, PromoSMS, SerwerSMS, SevenIO, SMSManager, SMSPartner, SMSPlanet, SMSC, SMSEagle | ✅ | ✅ |
| **聊天** | Matrix, Mattermost, RocketChat, GoogleChat, Pumble, Stackfield, ZohoCliq | ✅ | ✅ |
| **推送服務** | Gotify, Apprise, Pushy, PushDeer, LunaSea, TechulusPush, WPush, SpugPush | ✅ | ✅ |
| **事件管理** | Opsgenie, GrafanaOncall, Splunk, Squadcast, SIGNL4, GoAlert, PagerTree, FlashDuty, HeiiOnCall, AlertNow, Keep | ✅ | ✅ |
| **其他** | Signal, HomeAssistant, Gorush, Bitrix24, Alerta, SendGrid, Notifery, OneChat, Onesender, OneBot, Nostr, Threema, WAHA, Whapi, CallMeBot, GtxMessaging, LineNotify, Pushbullet | ✅ | ✅ |

---

## 8. Composables 遷移狀態 (原 Mixins)

| 原版 Mixin | Nuxt.js Composable | 狀態 |
|-----------|-------------------|------|
| `src/mixins/socket.js` (890 行) | 已拆分為多個 composables | ✅ 重構 |
| | `useSocket.ts` - 核心連接 | ✅ |
| | `useMonitors.ts` - Monitor 狀態 | ✅ |
| | `useNotifications.ts` - 通知狀態 | ✅ |
| | `useSettings.ts` - 設定狀態 | ✅ |
| | `useTags.ts` - 標籤狀態 | ✅ |
| | `useMaintenances.ts` - 維護狀態 | ✅ |
| | `useStatusPages.ts` - 狀態頁面 | ✅ |
| `src/mixins/theme.js` | `useColorMode()` (Nuxt UI 內建) | ✅ |
| `src/languages/lang.js` | `useI18n()` (@nuxtjs/i18n) | ✅ |
| `src/mixins/datetime.js` | `useDateFormat()` | ✅ |
| `src/mixins/mobile.js` | CSS Responsive + `useDevice()` | ✅ |
| N/A (新增) | `useAuth.ts` - 認證狀態 | ✅ |
| N/A (新增) | `useUptime.ts` - Uptime 計算 | ✅ |
| N/A (新增) | `useKeyboardShortcuts.ts` - 快捷鍵 | ✅ |

---

## 📋 待辦事項計劃

### 🔴 Critical - 嚴重缺失 (立即修復)

| # | 項目 | 說明 | 預估時間 | 來源 |
|---|------|------|---------|------|
| 1 | **Maintenance 排程器** | 維護時間視窗需使用 Cron 自動執行，目前只有 CRUD | 2-3 天 | 深度分析 |
| 2 | **SNMP Monitor 實作** | 列在清單但 `network-checker.ts` 沒有實作 | 1-2 天 | 深度分析 |
| 3 | **Important Heartbeat List** | 狀態變更歷史 (重要事件) 完全缺失 | 1 天 | 深度分析 |
| 4 | **Certificate Expiry Notifications** | 證書到期通知 `checkCertExpiryNotifications()` 缺失 | 1 天 | 深度分析 |
| 5 | **testNotification 實作** | 目前只回傳 placeholder，需實際發送測試 | 1 天 | 深度分析 |

### 🔴 高優先級 - 叢集核心功能

| # | 項目 | 說明 | 預估時間 | 來源文件 |
|---|------|------|---------|---------|
| 6 | **節點健康檢查服務** | 定期檢查節點狀態 (30秒間隔)，更新 online/offline | 3-5 天 | `lua/health_check.lua` |
| 7 | **Monitor 分配邏輯** | 根據 `assigned_node` / `node_id` 決定執行節點 | 2-3 天 | `lua/monitor_router.lua` |
| 8 | **Monitor 重新分配** | 節點離線時自動遷移 Monitor 到其他節點 | 2 天 | `CLUSTER_SETUP_SYNC_PLAN.md` |
| 9 | **叢集感知 Setup** | 只有 Primary Node 顯示 Setup 頁面 | 1 天 | `CLUSTER_SETUP_SYNC_PLAN.md` |
| 10 | **K8s 環境偵測** | 自動偵測 Docker Compose / K8s 環境 | 1 天 | `K8S_CLUSTER_DEPLOYMENT_PLAN.md` |

### 🟠 高優先級 - 功能修復

| # | 項目 | 說明 | 預估時間 |
|---|------|------|---------|
| 11 | **API Key Enable/Disable** | 新增 `disableAPIKey`, `enableAPIKey` socket 事件 | 0.5 天 |
| 12 | **Settings Socket Events** | 新增 `getSettings`, `setSettings` 即時同步 | 0.5 天 |
| 13 | **testDockerHost 實作** | 實際測試 Docker 連線，回傳容器數量 | 0.5 天 |
| 14 | **Monitor Type List Event** | 發送 Monitor 類型 Condition 支援資訊 | 0.5 天 |
| 15 | **UptimeCalculator 驗證** | 確認 24h/30d Uptime 統計正確 | 1 天 |
| 16 | **Info Event 補齊欄位** | 補齊 `latestVersion`, `isContainer`, `serverTimezone` | 0.5 天 |

### 🟡 中優先級 - 叢集進階功能

| # | 項目 | 說明 | 預估時間 | 來源文件 |
|---|------|------|---------|---------|
| 17 | **動態節點發現** | K8s Headless Service DNS 查詢 Pod | 2 天 | `lua/dynamic_upstream.lua` |
| 18 | **手動切換節點** | API 允許手動將 Monitor 切換到指定節點 | 1 天 | `MANUAL_NODE_SWITCHING_PLAN.md` |
| 19 | **全局流量強制路由** | 管理員強制所有流量到指定節點 | 1-2 天 | `MANUAL_NODE_SWITCHING_PLAN.md` |
| 20 | **固定節點路由 (Cookie)** | 開發者透過 Cookie 固定到特定節點調試 | 1 天 | `FIXED_NODE_ROUTING_PLAN.md` |
| 21 | **K8s 縮容自動移除** | Pod 終止時從 DB 移除節點記錄 | 1 天 | `K8S_NODE_REMOVAL_PLAN.md` |
| 22 | **Real Browser Monitor** | 整合 Playwright 進行真實瀏覽器監控 | 2-3 天 | - |
| 23 | **Certificate History** | 顯示 TLS 憑證變更歷史 | 1 天 | - |
| 24 | **Public Status 分頁** | 狀態頁面 Monitor 分頁 + Tab 切換 | 2 天 | `PUBLIC_STATUS_PAGINATION_PLAN.md` |
| 25 | **CertificateInfo UI 元件** | TLS 證書詳情顯示元件 | 1 天 | 深度分析 |

### 🟡 中優先級 - 功能補齊

| # | 項目 | 說明 | 預估時間 |
|---|------|------|---------|
| 26 | **Cloudflared Socket Events** | 補齊所有 cloudflared 相關 socket 事件 | 1 天 |
| 27 | **Check Version 服務** | 定期檢查 GitHub releases 新版本 | 0.5 天 |
| 28 | **Image Data URI Handler** | Status Page logo 上傳、截圖處理 | 1 天 |
| 29 | **ActionSelect 元件** | Docker 容器/Remote Browser 選擇器 | 0.5 天 |
| 30 | **Maintenance Model 方法** | `run()`, `stop()`, `isUnderMaintenance()` 等 | 包含在 #1 |

### 🟢 低優先級

| # | 項目 | 說明 | 預估時間 |
|---|------|------|---------|
| 31 | Cloudflare Panel UI | Cloudflare Tunnel 完整管理界面 | 1-2 天 |
| 32 | Maintenance Timeline | 視覺化維護時間軸 | 1 天 |
| 33 | Version Check UI | 顯示新版本通知 | 0.5 天 |
| 34 | Swagger/OpenAPI 文件 | 自動生成 API 文件 | 1 天 |
| 35 | Google Analytics 整合 | 追蹤功能 | 0.5 天 |
| 36 | disconnectOtherSocketClients | 斷開其他 session 功能 | 0.5 天 |
| 37 | 截圖 URL 服務 | `/screenshots/:token.png` 端點 | 0.5 天 |
| 38 | Tailscale 容器偵測 | 在容器中隱藏 Tailscale 選項 | 0.5 天 |

---

## 🆕 2026-01-24 深度分析發現

### 嚴重缺失詳細說明

#### 1. Maintenance 排程器 (Critical)
```javascript
// 原版使用 croner 實作 Cron 排程
// server/model/maintenance.js
async run(server) {
  if (this.strategy === "cron") {
    this.beanMeta.job = new Cron(this.cron, { timezone: this.timezone }, async () => {
      // 自動開始/結束維護
    })
  }
}
```
**Nuxt 版:** 只有 CRUD API，沒有排程執行邏輯

#### 2. Important Heartbeat (狀態變更歷史)
```javascript
// 原版 socket 事件
socket.on("getImportantHeartbeatListPaged", async (monitorId, offset, count, callback) => {
  // 取得狀態變更歷史
})
```
**Nuxt 版:** 完全沒有此功能

#### 3. SNMP Monitor
```javascript
// 原版使用 net-snmp 庫
// server/monitor-types/snmp.js
const snmp = require("net-snmp")
// 完整的 SNMP v1/v2c/v3 支援
```
**Nuxt 版:** `network-checker.ts` 沒有 SNMP 實作

#### 4. testNotification Placeholder
```typescript
// Nuxt socket.ts - 只是 placeholder
async testNotification(socket, notification, callback) {
  callback({ ok: true, msg: 'Test notification sent successfully (placeholder)' })
}
```
**需要:** 實際調用 `notification-sender.ts` 發送測試通知

---

## 🏗️ 叢集架構遷移計劃

### 架構圖

```
                    ┌─────────────────────────────────┐
                    │     OpenResty (負載平衡器)        │
                    │  ┌─────────────────────────────┐ │
                    │  │    Lua 模組                 │ │
                    │  │  - config.lua              │ │
                    │  │  - health_check.lua        │ │
                    │  │  - monitor_router.lua      │ │
                    │  │  - dynamic_upstream.lua    │ │
                    │  └─────────────────────────────┘ │
                    └───────────────┬─────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          │                         │                         │
          ▼                         ▼                         ▼
   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐
   │   Node 1    │           │   Node 2    │           │   Node N    │
   │ (Primary)   │           │             │           │             │
   │ Nuxt Server │           │ Nuxt Server │           │ Nuxt Server │
   └─────────────┘           └─────────────┘           └─────────────┘
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    │
                              ┌─────▼─────┐
                              │ PostgreSQL │
                              │ (共享資料庫) │
                              └───────────┘
```

### OpenResty Lua → Nuxt.js TypeScript 對照

| Lua 模組 | 功能 | Nuxt.js 對應 | 狀態 |
|---------|------|-------------|------|
| `lua/config.lua` | 集中配置、環境偵測 | `server/utils/cluster-config.ts` | 🔴 待建立 |
| `lua/db.lua` | MariaDB 連接池 | `server/utils/prisma.ts` | ✅ 已有 (PostgreSQL) |
| `lua/logger.lua` | 統一日誌 | 使用 `consola` | ✅ 已有 |
| `lua/health_check.lua` | 節點健康檢查 | `server/services/node-health-checker.ts` | 🔴 待建立 |
| `lua/monitor_router.lua` | 路由決策邏輯 | `server/services/monitor-distributor.ts` | 🔴 待建立 |
| `lua/dynamic_upstream.lua` | 動態節點發現 | `server/services/dynamic-node-discovery.ts` | 🔴 待建立 |
| `lua/middleware.lua` | 請求中介層 | `server/middleware/` | ✅ 已有 |

### 待建立的 TypeScript 服務

```typescript
// 1. server/utils/cluster-config.ts
interface ClusterConfig {
  environment: 'kubernetes' | 'docker-compose' | 'standalone'
  nodeId: string
  isPrimary: boolean
  nodeCount: number
  monitorLimitPerNode: number
  healthCheckInterval: number  // 預設 30 秒
  offlineThreshold: number     // 預設 90 秒
}

// 2. server/services/node-health-checker.ts
interface NodeHealthChecker {
  startHealthCheck(): void
  checkNodeHealth(nodeId: string): Promise<boolean>
  updateNodeStatus(nodeId: string, status: 'online' | 'offline'): Promise<void>
  redistributeMonitors(failedNodeId: string): Promise<void>
  revertMonitors(nodeId: string): Promise<void>
}

// 3. server/services/monitor-distributor.ts
interface MonitorDistributor {
  getNodeForMonitor(monitorId: number): Promise<string>
  assignNodeToMonitor(monitorId: number): Promise<string>
  getMonitorCountByNode(nodeId: string): Promise<number>
  rebalanceMonitors(): Promise<void>
  switchMonitorNode(monitorId: number, targetNode: string): Promise<void>
}

// 4. server/services/dynamic-node-discovery.ts
interface DynamicNodeDiscovery {
  discoverOnlineNodes(): Promise<Node[]>
  resolveK8sHeadlessService(): Promise<string[]>
  getPrimaryNode(): Promise<Node | null>
  selectNodeRoundRobin(): Promise<Node>
}
```

---

## 🗓️ 開發時程表 (4 週)

### Week 1：叢集基礎架構

| 天數 | 任務 | 產出檔案 |
|------|------|---------|
| Day 1-2 | 叢集配置模組 + 環境偵測 | `server/utils/cluster-config.ts` |
| Day 3-4 | 節點健康檢查服務 | `server/services/node-health-checker.ts` |
| Day 5 | 整合到 Nuxt Plugin | `server/plugins/04-node-health.ts` |

### Week 2：Monitor 分配 & 重新分配

| 天數 | 任務 | 產出檔案 |
|------|------|---------|
| Day 1-2 | Monitor 分配服務 | `server/services/monitor-distributor.ts` |
| Day 3 | 整合到 Scheduler | 修改 `server/services/scheduler.ts` |
| Day 4-5 | 節點離線重新分配邏輯 | 修改 `node-health-checker.ts` |

### Week 3：K8s 整合 & 進階功能

| 天數 | 任務 | 產出檔案 |
|------|------|---------|
| Day 1-2 | 動態節點發現 (K8s DNS) | `server/services/dynamic-node-discovery.ts` |
| Day 3 | K8s 縮容自動移除 (SIGTERM) | 修改 Node 模組 |
| Day 4 | 手動切換節點 API | `server/api/monitors/[id]/switch-node.post.ts` |
| Day 5 | 全局強制路由 API | `server/api/lb/force-route.post.ts` |

### Week 4：前端 & 測試

| 天數 | 任務 | 產出檔案 |
|------|------|---------|
| Day 1-2 | 叢集管理 UI 增強 | 更新 `pages/settings/nodes.vue` |
| Day 3 | Public Status 分頁功能 | 更新 `pages/status/[slug].vue` |
| Day 4-5 | 整合測試 & 文件 | 測試檔案、README |

---

## 📊 叢集功能對照表

### 節點管理

| 功能 | OpenResty (原版) | Nuxt.js | 狀態 |
|------|-----------------|---------|------|
| 節點 CRUD | 透過 DB 操作 | `pages/settings/nodes.vue` + API | ✅ 已實現 |
| 節點狀態顯示 | `health_check.lua` 更新 | UI 顯示 online/offline | ✅ 已實現 |
| 主節點設定 | `is_primary` 欄位 | UI 支援設定 | ✅ 已實現 |
| 節點健康檢查 | Lua 定期 HTTP 檢查 | TypeScript 服務 | 🔴 待開發 |
| Monitor 分配邏輯 | `monitor_router.lua` | TypeScript 服務 | 🔴 待開發 |
| Monitor 重新分配 | 離線時自動分配 | TypeScript 服務 | 🔴 待開發 |
| 動態節點發現 | K8s DNS 查詢 | TypeScript 服務 | 🔴 待開發 |

### 叢集同步

| 功能 | 說明 | 狀態 |
|------|------|------|
| Setup 單一入口 | 只有 Primary Node 顯示 Setup | 🔴 待開發 |
| 從節點等待訊息 | Secondary 顯示等待畫面 | 🔴 待開發 |
| 狀態即時同步 | Socket 廣播節點狀態變更 | ✅ 已有基礎 |

### 路由控制

| 功能 | 說明 | API 端點 | 狀態 |
|------|------|---------|------|
| 固定節點 Cookie | 開發者調試用 | `GET /lb/fixed-node/:node` | 🔴 待開發 |
| 全局強制路由 | 管理員強制流量 | `POST /api/lb/force-route-to/:node` | 🔴 待開發 |
| 恢復負載平衡 | 恢復 LTM 模式 | `POST /api/lb/restore-ltm` | 🔴 待開發 |
| 查看路由模式 | 確認當前模式 | `GET /api/lb/routing-mode` | 🔴 待開發 |
| 單一 Monitor 切換 | 手動切換節點 | `POST /api/monitors/:id/switch-node` | 🔴 待開發 |

### K8s 整合

| 功能 | 說明 | 狀態 |
|------|------|------|
| 環境偵測 | 自動偵測 K8s / Docker Compose | 🔴 待開發 |
| StatefulSet 支援 | 穩定的 Pod 名稱 | 🔴 待開發 |
| HPA 擴縮容 | 自動擴縮節點 | 🔴 待開發 |
| SIGTERM 處理 | Pod 終止時清理 | 🔴 待開發 |
| Headless Service DNS | 動態發現 Pod | 🔴 待開發 |

---

## 🚀 Nuxt.js 版本的增強功能

相較於原版，Nuxt.js 版本有以下改進：

1. **TypeScript** - 全面型別安全
2. **15 個設定頁面** - 新增 `profile.vue`、`nodes.vue` 等頁面
3. **10 個 Composables** - 比單一 890 行 mixin 更好的程式碼組織
4. **Prisma ORM** - 比 RedBeanNode 更好的型別安全和關聯
5. **SSR 支援** - 公開狀態頁面更好的 SEO
6. **現代 UI** - Nuxt UI 3 + Tailwind vs Bootstrap 5
7. **檔案路由** - 自動路由生成
8. **增強的 Monitor Schema** - 40+ 欄位支援 JSON

---

## 📈 總結

| 類別 | 完成度 | 說明 |
|------|--------|------|
| **核心監控功能** | ~92% | 發現嚴重缺失需修復 |
| **叢集功能** | ~40% | 節點 CRUD 已完成，健康檢查/分配邏輯待開發 |
| **K8s 整合** | ~10% | 架構設計完成，實作待開發 |
| **總體** | ~70% | 需修復嚴重缺失 + 叢集功能開發 |

### 🔴 嚴重缺失 (需立即修復)

| 項目 | 影響 | 預估時間 |
|------|------|---------|
| **Maintenance 排程器** | 維護時間視窗不會自動執行 | 2-3 天 |
| **SNMP Monitor** | SNMP 監控完全不可用 | 1-2 天 |
| **Important Heartbeat** | 狀態變更歷史不顯示 | 1 天 |
| **testNotification** | 測試通知不會真正發送 | 1 天 |
| **Certificate Expiry** | 證書到期不會通知 | 1 天 |

### 核心功能 ⚠️ 需修復

- ⚠️ 24 種監控類型 (**SNMP 缺實作**)
- ✅ 全部 78 種通知提供者
- ✅ 全部 15 個設定頁面
- ⚠️ 維護排程 (**排程器缺失**)
- ⚠️ 狀態頁面 (**Important Events 缺失**)
- ✅ 2FA / API Key / Badge / RSS / Metrics
- ✅ Rate Limiter / Cloudflared API
- ✅ 節點 CRUD (UI + API)

### 叢集功能 🔴 待開發

- 🔴 節點健康檢查服務
- 🔴 Monitor 分配 / 重新分配邏輯
- 🔴 叢集感知 Setup (Primary Only)
- 🔴 K8s 環境偵測 / HPA 支援
- 🔴 手動切換節點 / 全局強制路由
- 🔴 動態節點發現 (K8s DNS)

### 下一步行動

1. 🔴 **Week 0 (緊急)**: 修復 5 個嚴重缺失
   - Maintenance 排程器
   - SNMP Monitor
   - Important Heartbeat
   - testNotification
   - Certificate Expiry
2. 🟠 **Week 1**: 修復高優先缺失 (6 項)
3. 🟡 **Week 2-3**: 實作叢集配置 + 節點健康檢查
4. 🟡 **Week 4-5**: 實作 Monitor 分配 + K8s 整合

---

## 📚 相關文件

| 文件 | 說明 |
|------|------|
| `CLUSTER_DEPLOYMENT_GUIDE.md` | OpenResty 叢集部署指南 |
| `CLUSTER_SETUP_SYNC_PLAN.md` | 叢集 Setup 同步問題解決 |
| `K8S_CLUSTER_DEPLOYMENT_PLAN.md` | K8s 部署計劃 |
| `K8S_NODE_REMOVAL_PLAN.md` | K8s 縮容自動移除計劃 |
| `NGINX_CLUSTER_LB_PLAN.md` | Nginx 負載均衡配置 |
| `FIXED_NODE_ROUTING_PLAN.md` | 固定節點路由計劃 |
| `MANUAL_NODE_SWITCHING_PLAN.md` | 手動切換節點計劃 |
| `PUBLIC_STATUS_PAGINATION_PLAN.md` | 狀態頁分頁計劃 |
| `FEATURE_COMPARISON_PLAN.md` | 功能比較詳細計劃 |

---

*文件更新日期：2026-01-24*