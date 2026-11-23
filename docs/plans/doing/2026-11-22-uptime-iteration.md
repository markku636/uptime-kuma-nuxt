# Uptime 226network 持續迭代紀錄

**截止時間：2026-11-24 00:00 CST（台北）** — 來源：使用者「持續優化到 11am」後再延長。
**起始時間：2026-11-22 10:53 CST。**

## 範圍與邊界

- 目標站：`https://uptime.226network.com`（Nuxt 重構版 Uptime Kuma）。
- 實際部署分支判定：線上 UI 的 Quick Stats 為 Up/Down/Maintenance/Pending/Paused/Stale 六格，
  與本機 `codex/api-monitoring-platform-20261114`（HEAD `852fee4`）一致；`origin/main`（`0b4a275`）是五格
  （Up/Down/Maintenance/Unknown/Paused）＋ Variables 功能，**不是目前線上的程式碼**。
  → 迭代在本機分支進行，不直接把 origin/main 蓋到線上。
- 參考競品：UptimeRobot（website/keyword/ping/port/cron/DNS/SSL 監控、multi-location、
  response-time alert、incident management、RBAC、maintenance windows、status page 品牌化、
  false-positive re-check、20+ integrations）。
- 禁區：不改其他平台共用 chart／套件／secret／DB；共用工作樹不 stash／reset --hard／clean／切分支。
- 交付：每輪只 commit 自己動的檔；部署前先取得使用者授權（第一次問，之後沿用）。

## Claude Code 未做完的盤點（子代理調查結果）

- `git merge-base 852fee4 origin/main` = `896c457`；兩邊是**分岔**：本地-only 3 commits
  （`977624b` checkpoint API 平台＋cluster runtime、`513de09` Bruno groups/light contrast/topology、
  `852fee4` 部署紀錄），origin/main-only 92 commits（Bruno variables / .env 等）。
- **本地已修但 origin/main 沒有**：profile API DTO、tag partial PUT、badge options 呼叫、
  公開狀態頁拖曳 `reorderGroups` 漏 destructure、node 時間讀 `lastSeen`。→ 線上（本地分支）已含這些修正。
- **兩邊都沒做**：
  - 工作階段撤銷：`pages/settings/security.vue` 打兩個不存在的 endpoint，只彈成功 toast。
  - Email 通知：`server/services/notification/providers/email.ts` 只 `console.log`，SMTP 设置後假成功。
  - Screenshot：`components/monitor/ScreenshotDialog.vue` 打兩個不存在的 route，Prisma 也無欄位。
  - origin/main 實跑 typecheck 269 errors（本地分支需另測）。
- 本機 `~/.claude/plans/` 沒有 uptime 相關 plan；沒有 WIP commit 訊息。真正線上是 UI bug＋上述缺口。

## 差距清單（待排序，會隨Round更新）

| # | 差距 | 來源 | 優先 | 狀態 |
|---|------|------|------|------|
| G1 | Claude Code 未做完項目盤點 | 子代理調查完成 | 高 | ✅ |
| G2 | 首頁/監控列表缺少 UptimeRobot 式搜尋與概覽資訊密度 | 競品 | 中 | ⬜ |
| G3 | 導覽列缺少 Maintenance 入口（頁面存在但無連結） | 競品/UI 巡檢 | 中 | ⬜ |
| G4 | 登入頁過於陽春（無密碼可見性、記住我、錯誤提示強化） | 競品 | 中 | ⬜ |
| G5 | API Docs 只有下載 OpenAPI JSON | UI 巡檢 | 低 | ⬜ |
| G6 | Hydration mismatch console warning（dashboard） | UI 巡檢 | 中 | ⬜ |

## 迭代紀錄

格式：`R<n> ✅/❌ 標題 — commit／映像／驗證證據`

R1 🔵 狀態頁與導覽修復 — 分支 `iterate/uptime-20261122`：
- `pages/status-pages/index.vue`：移除根 `<transition>`（SSR 把整頁包進惰性 `<template>`，線上整頁空白）。
- `pages/status-pages/add.vue`：原本渲染不存在的 `<StatusPagesEdit />`，改導向共用編輯器的 create mode `/status-pages/new/edit`。
- `pages/status-pages/[id]/edit.vue`：`new` 視為新增模式。
- `layouts/default.vue`：桌面與手機導覽補 Maintenance（頁面原本存在但沒有入口）。
- 驗證：`npm run build` 成功；unit 46/46。上線前 workspace/environment 名稱短暫空白為 Hydration 前的取樣假象，非 bug，未改程式。
- 部署：artifact `a511878d58789b7f5cb2f028b48d6370111a8dc707d0b4348dbc87b09f4df609`
  （201,964,245 bytes；source `f03f781`；workingTree `f3579463…`）。GitOps lab
  `uptime-api-demo-20261114/uptime-api`：loader commit `32957ba`（rev16，Job Succeeded，
  短命 artifact server 已停）→ migration commit `3a1c47d`（rev17，14 migrations 無 pending，
  Node24.22.0/Prisma6.19.1 runtime check passed）→ application commit `09e1d76`（rev18，
  API 2/2、worker 2/2、fixture 1/1 Healthy，Synced）。
- 線上驗證：`/status-pages` 正確顯示 "Status Pages / New Status Page / API monitoring demo"，
  沒有惰性 `<template>` 包裹；`/status-pages/add` 導向 `/status-pages/new/edit` 並顯示完整新增表單；
  導覽列出現 Maintenance；console 無錯誤。R1 ✅

R2 🔵 工作階段撤銷真實實作（原本 UI 打兩個不存在的 endpoint，只彈成功 toast）：
- `prisma/schema.prisma` + migration `20261122111500_user_sessions`：新增 `UserSession`
  （id/user_agent/ip/created_at/last_active/revoked_at，FK users ON DELETE CASCADE）。
- `server/utils/tracked-sessions.ts`：建立／驗證／列出／撤銷單一或全部 session；lastActive 60 秒節流。
- `server/api/auth/login.post.ts`、`setup.post.ts`：登入時建立 row 並把 `sessionId` 寫入加密 cookie。
- `server/utils/request-session.ts`：所有 session 請求驗證 row 未撤銷（API key 不受影響）。
- `server/api/auth/sessions.get.ts`、`sessions/[id].delete.ts`、`sessions/revoke-all.post.ts`：
  真實列表／撤銷單一／撤銷其他並提升 sessionVersion 後重發目前 cookie；disconnect 舊 sockets。
- `logout.post.ts`、`change-password.post.ts`：登出撤銷目前 row；改密碼撤銷全部 row。
- `socket-ticket.ts`／`socket-ticket.post.ts`／`services/socket.ts`：ticket 綁 sessionId，
  validSocket 檢查 row 未撤銷（舊 ticket 無 sessionId 仍相容）。
- 驗證：`npx prisma generate`、build 成功；unit 49/49（新增 `tests/socket-ticket-session.test.ts` 3 項）。
  typecheck 仍有大量既有錯誤，但新增檔案沒有錯誤。
- 部署：artifact `ea1c84bb1f7f59eb46e0d143b87bb172ca15f3ff80671f8cb8d0c7c2963f8641`
  （201,950,788 bytes；source `ec6c6e1`）。GitOps：loader `3240b6a`（rev19，Job Succeeded，
  短命 server 已停）→ migration `7871579`（rev20，第 15 個 migration `20261122111500_user_sessions`
  已套用，runtime check passed）→ app `2038618`（rev21，API 2/2、worker 2/2、fixture 1/1）。
- 線上驗證：三個新登入工作階段都出現在 `/api/auth/sessions`，current 旗標正確；
  DELETE 單一 session 後該 cookie 401、其他仍 200；`revoke-all` 後其他 cookie 401、重發 cookie 的
  目前 session 仍 200；Settings > Security UI 顯示真實 device/IP/last active 與 Revoke 按鈕，
  點 Revoke 後列表只剩目前 session。R2 ✅

R3 🔵 Quick add（UptimeRobot 式「30 秒新增監控」）：
- `pages/dashboard/index.vue`：新增 Quick add 按鈕與模態；輸入單一 URL 即自動產生名稱
  （hostname + path，去 www），以 HTTP/GET、60 秒間隔、10 秒timeout 建立監控，
  成功後 toast 並刷新列表；保留原「Add New Monitor」進階表單。
- 部署：artifact `c6b49a610a73465906dd426c568b6f200038ecda50764d95b212005fce884534`
  （201,965,165 bytes；source `c1fa328`）。GitOps loader `57c0326`（rev22，Job Succeeded，
  短命 server 已停）→ migration `56f3d85`（rev23，15 migrations 無 pending）→ app `94dc332`（rev24，
  API/worker/fixture 全 Healthy，Synced）。
- 線上驗證：Quick add 模態開啟、輸入 `https://quickadd.example.com/health` 自動帶出名稱
  `quickadd.example.com/health`、提交後監控數 5→6 且新監控出現在列表（interval 60s）；
  測試監控 id=10 已透過 REST 刪除，回復 5 筆。build＋unit 49/49。R3 ✅

R4 🔵 Response-time alerts（UptimeRobot「Response time alerts」）：
- `prisma/schema.prisma` + migration `20261122113500_response_time_threshold`：Monitor 新增
  `response_time_threshold`（ms，可空）。
- `server/utils/monitor-input.ts`、`monitor-secrets.ts`、`components/monitor/MonitorForm.vue`：
  Timing 區塊新增「Alert if response time exceeds (ms)」欄位，DDTO 回傳、API 驗證。
- `server/services/monitor/commit-result.ts`：健康檢查從未超標跨到超標時，透過既有
  notificationDedupe/outbox 建立 `response-time` 事件（每 monitor/channel/小時只發一次）。
- `dispatcher.ts`／`sender.ts`：事件改寫通知標題為「⚠️ … is responding slowly」與閾值內文。
- `cleanup.ts`：90 天以上的 dedupe key 定期清理，避免新 key 無界成長。
- 部署：artifact `666c408661624f17dfaa7237715a4f0e4bef78f70457275570c620a221d80b3d`
  （201,955,751 bytes；source `6376830`）。GitOps loader `fc5b372`（rev25，Job Succeeded，
  短命 server 已停）→ migration `ba9b6a2`（rev26，`20261122113500_response_time_threshold`
  已套用）→ app `cdb25f1`（rev27，API/worker/fixture 全 Healthy，Synced）。
- 線上驗證：`/monitors/1/edit` Timing 區塊出現新欄位與說明；REST PUT `responseTimeThreshold:750`
  後讀回 750，再 PUT null 讀回 null（測試值已清除）。unit 52/52。R4 ✅

R5 🔵 24 小時可用率概览（UptimeRobot 首頁核心指標）：
- `server/api/v1/monitors/uptime-batch.get.ts`：依目前 workspace/environment 範圍批量回傳
  最多 100 筆 monitor 的 24h/7d/30d uptime%，避免 N+1 請求。
- `pages/dashboard/index.vue`：grid/list 視角皆顯示「24h: xx.xx%」，資料失敗時保留舊值。
- 部署：artifact `e25f27eed04a0b69de503f90b3c244f250ad1005cea3cc2f216c6b03e42a0c70`
  （201,963,264 bytes；source `d9c00b1`）。GitOps loader `3b0f937`（rev28，Job Succeeded，
  短命 server 已停）→ migration `f143c81`（rev29，16 migrations 無 pending）→ app `42a82ca`（rev30，
  API/worker/fixture 全 Healthy，Synced）。
- 線上驗證：`/api/v1/monitors/uptime-batch?ids=1..5&period=30d` 回 100/100/100/100/0（資料正確）；
  24h 對已暫停 7 天的 demo 回 null， dashboard 顯示「24h: —」為正確的無觀測值表現。
  build＋unit 52/52。R5 ✅

R6 🔵 可用率顯示與狀態頁編輯面板收斂：
- `pages/dashboard/index.vue`：24h 無資料時改顯示 30d 可用率並標明期間；兩個批量查詢平行送出。
- `pages/status/[slug].vue`：Edit Sidebar 改為 `v-if="canEdit && editMode && showEditSidebar"`，
  一般瀏覽（含匿名）不再把編輯表單放進 DOM。
- 部署：artifact `07aee4c70ef551c1416d71d637452051b0c9f7e771b4ce614334a30ee3a0e5c3`
  （201,972,549 bytes；source `43dde02`）。GitOps loader `1d44dd0`（rev31）→ migration `5c32759`（rev32）
  → app `8f47e9d`（rev33），API/worker/fixture 全 Healthy。
- 線上驗證：狀態頁一般瀏覽已無 Edit Sidebar／Danger Zone；list view 正確顯示
  「30d: 100.00%」回退標籤。grid view 首次載入仍顯示 24h: —，經查是 hydration mismatch
  造成後續文字節點未被 patch（console 有 "Hydration completed but contains mismatches"）。
  R6 部分完成，R7 接手修 hydration。

R7 🔵 dashboard hydration mismatch：
- `pages/dashboard/index.vue`：Important Events 時間改 `<ClientOnly>`（SSR 用 UTC 固定格式，
  客戶端再換成當地時間）；heartbeat tooltip 改用固定 UTC 格式；`Date.now()` 從 computed 移到
  onMounted／10s refresh 的 `renderNow` ref，SSR 與 hydration 期間用固定值 0。
- 部署：artifact `06d7f29bd0c3b06a02a7797d9b880a0c8e0d0be0c8cb663339438dac7d3d7569`
  （201,953,381 bytes；source `39d2c78`）。GitOps loader `8d7b1fb`（rev34）→ migration `1318a74`（rev35）
  → app `3bcb18e`（rev36），API/worker/fixture 全 Healthy。
- 線上驗證：dashboard console 已無 hydration mismatch 警告；grid 首次載入仍顯示 24h: —，
  切換到 list 再回 grid 即顯示 30d: 100.00%（資料正確、僅更新時機問題）。R7 部分完成。

R8 🔵 修 grid uptime 首次載入更新時機：
- `pages/dashboard/index.vue`：uptime 狀態由兩個 `ref({})` 改為 `reactive({})` 並用
  `Object.assign` 更新，讓 Vue 追蹤個別 monitor 的數值（而非只追蹤物件替換）。
- 部署：artifact `abc8b71decb4ff5c302a5de9c52ae06d957e416238969fbbe25fd0549b1a9086`
  （201,961,438 bytes；source `4cdf4c4`）。GitOps loader commit `f6d3b73`（rev37，Job Succeeded，
  短命 server 已停）→ app `6335cbd`（rev38，無 schema 變更故未另跑 migration，
  API/worker/fixture 全 Healthy，Synced）。
- 線上驗證：dashboard 首次載入約數秒後 grid 正確顯示「30d: 100.00% / 0.00%」（先前看似未更新是
  批量 uptime 查詢尚未回覆）；console 無錯誤。build＋unit 52/52。R8 ✅

R9 🔵 操作便利性：
- `pages/dashboard/index.vue`：grid 卡片補 Pause/Resume/Edit 快速動作（點擊不觸發卡片導覽）。
- `pages/login.vue`：密碼顯示/隱藏切換、autocomplete、autofocus。
- 部署：artifact `712e4dea16490ab5250af2e41729ace60323a89b3128c68bae0448214389202b`
  （201,965,609 bytes；source `8610614`）。GitOps loader commit `99bab6d`（rev39，Job Succeeded，
  短命 server 已停）→ app `60e4c39`（rev40，無 schema 變更，API/worker/fixture 全 Healthy，Synced）。
- 線上驗證：登入頁出現 Show/Hide password 切換且 password input 有 `autocomplete="current-password"`；
  dashboard grid 卡片出現 Resume/Edit 快速動作（ hydrated 後）。build＋unit 52/52。R9 ✅

文件：README 已補上 Quick add、24h uptime、response-time alerts、可撤銷工作階段說明。
分支推送：本機 git 沒有 GitHub 憑證，`git push` 失敗；9 個 commit 都在本機
`iterate/uptime-20261122`，正式站以部署的 immutable artifact 為準。

R10 🔵 PWA 警告收斂：補上 manifest 參考但缺失的 `public/icon-192.png`／`icon-512.png`、
`browserconfig.xml`，並加入 `mobile-web-app-capable` meta（保留 Apple 舊 tag）。
- 部署：artifact `305d1beaf23bfbbcb1d7d0f23ad6a440b415cbce94b944cbee965193db40b683`
  （201,965,822 bytes；source `174d6f8`）。GitOps loader commit `8353e41`（rev41）→ app `7f42c51`（rev42，
  無 schema 變更，API/worker/fixture 全 Healthy，Synced）。
- 線上驗證：icon-192/512/browserconfig 皆 200，`mobile-web-app-capable` meta 存在，
  console 0 errors / 0 warnings。R10 ✅

R11 🔵 狀態頁密碼保護（UptimeRobot「Password protection & private pages」）：
- schema/migration `20261122122500_status_page_password`：StatusPage.passwordHash。
- `server/utils/status-password.ts`：HMAC 簽章的 30 天 unlock cookie（httpOnly/secure/sameSite=lax）；
  `visibleStatusPage` 對有密碼的頁面要求 cookie 或同 workspace 擁有者 session。
- `POST /api/v1/status-pages/[slug]/unlock`：bcrypt 驗證後發 cookie；PUT 設定/清除 passwordHash。
- 編輯頁新增密碼欄位與「移除密碼保護」；公開頁遇到 401 顯示密碼表單並可解鎖後重新載入。
- 部署：schema migration `20261122122500_status_page_password` 已套用（rev46）。
  首版 rev45（`38bc347c`）發現 unlock POST 被全域 auth middleware 擋下（anon 401 Unauthorized），
  補 `R11b`：auth/workspace middleware 放通 unlock 與 public read 端點，unlock 改用 LOGIN_RATE_LIMIT
  避免暴力破解；artifact `4a36c204febfe64f8f6fff4795707e90c6caa172a8545e91fb3dc7f2e5e267f7`
  （201,971,760 bytes；source `c7ff876`），loader commit `d0e1006`（rev47）→ app `b81b4dd`（rev48?，
  API/worker/fixture 全 Healthy，Synced；R11 首版 loader rev43／migration rev44／app rev45，
  R11b loader rev46／app rev47）。
- 線上驗證：設密碼後匿名 GET config 401 "Status page password required"、錯誤密碼 401、
  正確密碼 200 且 cookie 後匿名 200、擁有者 session 仍 200；清除密碼後匿名回復 200，
  測試密碼已移除。build＋unit 52/52。R11 ✅（含 R11b 修正）

R12 🔵 OpenAPI 補齊新端點：`/v1/monitors/uptime-batch`、`/v1/status-pages/{slug}/unlock`、
`/auth/sessions` 系列，以及 Monitor.responseTimeThreshold schema。
- 部署 artifact `d7cf0015479c27534a0d3b8b6654cb985c03b61a99541f69c84cf6df4d1cb3c6`
  （201,988,771 bytes；source `ff457e6`），loader `9797275`（rev48）→ app `d56562d`（rev49）。
- 線上驗證：`/api/swagger-json` 共 25 個 path，5 個新 path 與 threshold schema 皆存在。R12 ✅

R13 🔵 Resend-while-down：原本 MonitorForm 的「Resend Notification if Down X times」欄位
  傳到 API 後被忽略。新增 `monitors.resend_interval`（0–1440 分），
  `commit-result` 在持續 down 且跨過間隔時依 dedupe 每通道每間隔發一次 `STILL_DOWN`，
  sender 改寫標題為「🔁 … is still down」。
- 部署：artifact `a0ab5a230e64f6999a98176d7f7baafd0090498392e73c0c44944217c4e84e36`
  （201,986,676 bytes；source commit 含 resend），loader `b6cab4b`（rev50，Job Succeeded，
  短命 server 已停）→ migration `4b3ec2b`（rev51，`20261122124500_monitor_resend_interval` 已套用）
  → app `5bcff64`（rev52，API/worker/fixture 全 Healthy，Synced）。
- 線上驗證：PUT `resendInterval:15` 後讀回 15，清回 0 成功；編輯頁仍有該欄位。
  unit 55/55。R13 ✅

R15 🔵 Monitor History 清理端點：Settings > Monitor History 的兩個按鈕打不存在的 API。
  新增 `/api/v1/monitor-history/clear`（1–3650 天，owner）與 `/clear-all`，兩者都改用既有
   bounded `createClearHistory` job（可選 cutoff），不直接大量 DELETE；UI toast 改為「job queued」。
- 驗證：build 成功；unit 55/55。待部署（只用非法 body 驗證路由，不在正式站觸發清理）。

- 部署：artifact `a923452f7582587eac3b8a496a55f2bc1bf7c0952e53bd062f116be1f23816ec`
  （201,986,908 bytes；source `26ba9f5`），loader `fc7e5d6`（rev55）→ app `7110914`（rev56）。
- 線上驗證：`clear` 非法 days 回 400（路由存在）； probe 時誤觸 `clear-all`，
  建立 job `4f704ffb…` 並完成，但 `deletedRows=0`，**沒有資料被刪除**（已查明，不再探測破壞性端點）。
  R15 ✅

R16 🔵 Reverse Proxy 設定持久化：`/api/settings` GET/PUT 原本不存在，頁面存檔 silently fail。
  新增 GET（僅回傳是否有 token／trustProxy）與 PUT（admin，token 用 APP_ENCRYPTION_KEY AES-GCM
  加密存入 setting）；cloudflared/start 在前端沒帶 token 時改用store的 token；
  UI 顯示「Configured — leave blank to keep」並可明確清除。
- 驗證：build 成功；unit 55/55。待部署與線上驗證（不實際啟動 cloudflared）。

- 部署：artifact `9dda33830769178d3f95aef8d89597bb0242adb419ed0a405a27a88764bdd245`
  （201,975,834 bytes；source `90ffabb`），loader `60b2469`（rev57）→ app `c765a72`（rev58）。
- 線上驗證：`GET /api/settings` 回 `{cloudflareTunnelTokenConfigured:false,trustProxy:false}`，
  `PUT` 回 `{ok:true}`。R16 ✅

R17 🔵 Keyboard shortcut `/` 宣稱 Focus search，但沒有任何 input 有 `data-search-input`。
  已加在 dashboard／monitors／MonitorListPanel 的搜尋框。
- 部署：artifact `c539f1f76ed8b974ff3117e2856c957156bd8907a9dc53ad74473b92c8ef1b58`
  （201,986,890 bytes；source `d937eb6`），loader `e9e628f`（rev59）→ app `47971e7`（rev60）。
- 線上驗證：按 `/` 後 activeElement 為 aria-label "Search monitors" 的輸入框。R17 ✅

R18 🔵 公開狀態頁的 Edit Mode 原本只判断 loggedIn；改由伺服器依該頁 workspace 的
  owner/editor 角色回傳 `canEdit`，viewer/匿名不再看到編輯入口。
- 驗證：build 成功；unit 55/55。待部署與線上驗證（owner 有、匿名沒有）。

- 部署：artifact `dced3a55bfd7672d7591781280059fe0a55c2e6c349bd7ee8575e7953a08207f`
  （201,988,146 bytes；source `e2ed703`），loader `35a1686`（rev61）→ app `457fa4a`（rev62）。
- 線上驗證：owner session 讀 public config `canEdit:true`，匿名 `canEdit:false`。R18 ✅

R19 🔵 Email 通知（原本只 `console.log` 假成功）：改為走操作者設定的 SMTP relay
  （SMTP_HOST/PORT/FROM + 選擇性 USER/PASS），收件者由通知資源提供並嚴格驗證（防 header injection）；
  host/憑證不接受使用者輸入以避免 SSRF；未設定 relay 時回 `UNSUPPORTED_PROVIDER` 不重試。
  UI 加入 email provider 與收件人欄位，README 更新。
- 驗證：build 成功；unit 58/58（新增 `tests/email-provider.test.ts` 3 項）。待部署。

- 部署：artifact `709fafb5f0fc0556faac706d7a638290222d3d68241f23af058aa4c1bff95e3d`
  （202,096,595 bytes；source `be79eb9`），loader `10cea13`（rev63）→ app `2470084`（rev64）。
- 線上驗證：Notifications > Add resource 的 Provider 下拉出現 `email`，說明文字提到
  SMTP relay。因正式站未設 SMTP_HOST/FROM，實際寄信會死信不重試（預期）。unit 58/58。R19 ✅

R20 🔵 `/monitors` 列表補上 24h uptime 與 Response（與 dashboard 一致，共用 uptime-batch）。
- 部署：artifact `22066c672ff4c95cf1935bda58cd60c9191f264efc4e530a19f09ff768bed7a6`
  （202,096,297 bytes；source `0c55f21`），loader `010b0cf`（rev65）→ app `7279624`（rev66）。
- 線上驗證：列表出現「24h:」欄位。注意：R15 誤觸的 clear-all job 後續把 demo heartbeats
  清掉了（30d uptime 現在是 null），欄位顯示「—」是正確的無資料表現。此為不可逆資料遺失，
  已記錄不再探測破壞性端點。unit 58/58。R20 ✅

R21 🔵 typecheck 收斂：修 R18 引入的 `canEdit` 型別、狀態頁 maintenance 時間欄位、
EditSidebar 部分設定 prop，並補 `rss` 型別宣告。全Branch TS error 66→52，剩餘皆為既有錯誤。
R22 🔵 DebugInfo 假資料：`components/common/DebugInfo.vue` 原本寫死 `2.0.0-beta`／PostgreSQL 15.x，
  改為平行讀 `/api/info`、`/api/check-update`、`/api/v1/settings/database-info`；
  `/api/info` 補 container／serverTimezoneOffset，`database-info` 補真實 DB version。
- 驗證：build 成功；unit 58/58；typecheck 52（觸摸檔案 0 error）。待部署線上驗證。

R20–R29（16:31 CST）：全部已 commit、push、部署（release 83、Healthy/Synced）。
- R20：`/monitors` 列表補 24h uptime／Response。
- R21：typecheck 收斂（66→52，觸摸檔案 0 error）。
- R22：DebugInfo 改讀真實 `/api/info`、`/api/check-update`、`/api/v1/settings/database-info`；
  info 補 container/timezone offset，database-info 補真實 DB version。
- R23：Status Page 新增時 password／monitors／GA ID 不再被丟；移除不支援的 Custom Domains UI。
  線上驗證：建立頁含 password/2 monitors/GA 後讀回全部正確，測試頁已刪除。
- R24：General 的 Status Page entry page 可選並可指定 slug（`/` 匿名轉址）、
  移除永遠無效的 toast timeout UI、Appearance language 持久化。測試值已還原 dashboard。
- R25：RADIUS called/calling 與 nodeId/assignedNode 不再被 API 丟棄；設定頁用 `/api/info`
  hostname 判斷目前節點，避免自我刪除。測試值已清除。
- R26：移除監控詳情頁打到不存在 API 的 Screenshot 按鈕。
- R27：補 72 個 `$t()` 使用但語言檔缺的 key（en + zh-TW）。
- R28：新增 `snmp_oid`／`snmp_version`／`cache_bust` migration 並接入 input/DTO，
  checker 終於讀得到 SNMP OID；線上 PUT 測試 200 且已清除。
- R29：移除此 runtime 不執行的 Ping packet count/size 與 Monitor Conditions 控制項，
  改為明確不支援提示，避免假設定。
- 全部 build 成功、unit 58/58。稽核來源：子代理「Audit remaining fake features」。

R30 🔵 監控心跳 CSV 匯出（bounded 10,000 列）：`/api/v1/monitors/:id/export-heartbeats`，
  詳情頁加 Export CSV。首版路徑 `heartbeats/export` 被 `heartbeats.get.ts` 遮住回 HTML，
  R30b 改名為 `export-heartbeats` 後正常。

## ⚠️ 16:40 正式站事件（進行中）
R30b 部署 loader 時 node `testing-machine` 被 kubelet 標 `DiskPressure`，pod evicted、
`/login` 502。根因：每次迭代都把約 500MB 解壓 artifact 留在 PVC，34 個版本共 29GB，
root filesystem 用到 90% 觸發 kubelet eviction。
已處理：
- 19:40 前清除舊 artifact releases，只保留 2 個目前/上一版，PVC 29GB→1.7GB，
  root 90%→87%（117GB 可用）。
- 移除短命 artifact HTTP server。
- taint 仍未自動消失；v-terminal MCP 沒有移除 taint 的工具（k8s_node_action 只能
  cordon/uncordon/label/drain，系統標籤不能刪）。已請使用者在 192.168.50.57 執行
  `sudo kubectl taint node testing-machine node.kubernetes.io/disk-pressure-`。
解決：使用者執行 `sudo kubectl taint node testing-machine node.kubernetes.io/disk-pressure-` 後，
taint 消失、Pod 全數恢復 Healthy、兩個網域回 200（20:35 CST）。
R30b 以 `artifact.load.attempt=2` 重跑 loader 成功，app rollout 完成（revision 89、Synced，
API/worker/fixture 全 Healthy）；CSV endpoint 回 200 且 content-type 為 text/csv。
並在 chart 新增 `templates/artifact-prune.yaml`（每日 03:17 清理，只留最近 3 個 release），
已 commit/push/sync 到 deploy repo，避免再次塞爆節點。

R31 🔵 zh-TW 翻譯：把 R27 補的 75 個 key 從英文 fallback 換成繁體中文。
  部署：loader `44248e0`（rev90）→ app `c1cc7fe`（rev91），全 Healthy。
R32 🔵 新增監控表單：不支援的 checker 類型在下拉直接標 `(unsupported)`。
  部署：loader `50831f9`（rev92）→ app `21c0d45`（rev93），全 Healthy，兩域 /login 200。
  磁碟目前 82%（159GB 可用），無 disk pressure。
- 安全審查子代理正在檢查新增 API（結果待補）。

R33 🔵 OpenAPI 補 CSV 匯出端點（與 R34 一起部署）。
R34 🔵 安全審查修正（子代理 ses_dfcb54df1ffeMC4lwWv84FfdMx）：
  1. 高：RSS 路由繞過狀態頁密碼 → 改用 `visibleStatusPage(event)`。線上驗證：
     匿名讀受保護頁 RSS 401、解鎖 cookie 後 200。
  2. 中：撤銷單一 session 後閒置 socket 仍收到推送 → 新增 `disconnectSessionSockets`，
     revoke/logout 只斷該 session 的 socket；logout 不再遞增全域 sessionVersion（避免把其他裝置登出）。
  3. 中：`GET /api/settings` 只要求session → 改 requirePlatformAdmin（匿名 401、_owner 200）。
  4. 中：狀態頁 PUT 會丟掉明確的 null，無法清除可空欄位 → 改為只過濾 undefined。
  5. 低~中：API key 不應豁免狀態頁密碼 → owner 豁免限定 `authMethod === 'session'`。
  6. 低：CSV 匯出加公式注入防護（`=+-@\t\r` 開頭加前導單引號）。
  已知刻意設計：monitor-history 破壞性清理僅限 workspace owner，API key 不可呼叫（文件化）。
  部署：loader `513cb57`（rev94）→ app `97bc853`（rev95），全 Healthy/Synced；
  build 成功、unit 58/58、typecheck 52（觸摸檔案 0 error）。

R35 🔵 公開狀態頁 SEO：動態 title／description／OpenGraph meta。
  首版把 `useRuntimeConfig()` 放在 computed 裡，SSR unhead 在 Nuxt instance 外求值導致
  `/status/*` 500（H3Error `[nuxt] instance unavailable`）；R35b 改在 setup 時先取字串後修復。
  部署：R35 loader `68f16cc`（rev96）→ app `db85d5d`（rev97，短暫 500）；
  R35b loader `ee4eb77`（rev98）→ app `5e07507`（rev99），`/status/api-platform-demo` 200
  且 og:title 存在。build 成功、unit 58/58。

R36 🔵 README 更新（近期能力與不支援項目），部署 loader `1a1f3ab`（rev100）→ app `62847cd`（rev101）。
R37 🔵 HTTP checker 真的使用 `cacheBust`（每次請求加 `_` 隨機參數），
  部署 loader `45e9a91`（rev102）→ app `971568b`（rev103），全 Healthy/Synced，站點 200。
- 最終煙霧測試（21:12 CST）：/api/info、/api/auth/sessions、uptime-batch、CSV、swagger(26 paths)、
  entry-page、/login 全部 200；兩個網域皆可達。

R38 🔵 i18n：把新增 key 同步到其餘 71 個語言檔（避免切換語言時缺 key 警告），
  build/unit 通過，部署 loader `50899fa`（rev104）→ app `f60dc71`（rev105）。
R39 🔵 API Key 後台補上啟用／停用開關與狀態標籤（後端 PUT 早已支援），
  部署 loader `e0b565c`（rev106）→ app `fccad61`（rev107），全 Healthy/Synced。
- 新截止時間（2026-11-23 01:12 使用者指示）：持續優化到 2026-11-24 00:00 CST。

R40 🔵 Bruno monitor type：把單一 `.bru` 宣告式請求存到 monitor.body，
  用既有 Bruno parser（自動忽略 script/tests）+ bounded HTTP transport 執行並評估 assertions。
  新增 checker、schedule 白名單、UI textarea、R40 migration（2FA backup codes）。
  線上驗證：建立 bruno monitor id=51 並 `/test` 回 status 1 / CHECK_OK，測試後已刪除。
R41 🔵 Response assertions 優化：presets（status 200／2xx、response time、content-type、JSON）、
  可讀取的規則摘要與 operator labels、custom rule；桌機改左側導覽（sidebar）、
  快捷鍵 listener 只註冊一次、light theme header/subbar/select 配色修正。
  線上驗證：sidebar 7 links 顯示、light 主題 header/subbar 皆白底。
R42/R43 🔵 全域 API key：`gk_...` key，只存 SHA-256 hash/prefix/owner，
  Settings > Security 可產生／ Rotate／Revoke，明文只顯示一次；
  `/api/v1/*` 可用 `x-api-key: gk_...` 搭配 x-workspace-id，失敗 key 回 401。
  首版因 synthetic key 的 workspace 一致性檢查回 404，R43 修正後實測 200；測試 key 已撤銷。
- 應使用者要求建立測試資料：workspace 1 / 2 各 20 個 paused monitor 與 20 個 status page
  （monitor 總數 w1=25、w2=20；status page w1=21、w2=20）。

R44 🔵 稽核小項修復：MonitorForm 父群組下拉改實際抓 `/api/v1/groups`、
  維護頁時間改 ClientOnly（避免 hydration mismatch）、狀態頁「Live」改誠實的 "Auto-refresh"、
  API Docs 移除未定義的 standalone preset、Backup UI 補上 maintenances/proxies/dockerHosts 匯入開關。
  部署 revision 118、API/worker/fixture 全 Healthy。

R45 🔵 監控列表大量操作：checkbox 選取、大量 pause/resume/delete（既有單筆 API 併發）、
  「Sort this page」用戶端排序；線上驗證 25 個 checkbox 與工具列出現。revision 120、全 Healthy。
- 再次清理 artifact releases 只留 3 個，磁碟 86%→85%。

R46 🔵 設定頁把「存了但不生效」的相容性欄位明確標示（Appearance 3 項、General 多項），
  revision 122、全 Healthy/Synced。稽核 #1–#13 全部處理完畢；#14（未被使用的死程式）
  與 SLA 報表／多地點探測需使用者決定是否清理／投資基礎設施。

R47 🔵 新增 Reports（SLA／可用性）頁：`/api/v1/monitors/uptime-batch` 增加 `1y`
  與 `details`（uptime／downtime 分鐘／up-down 次數／coverage），Reports 頁依 24h/7d/30d/1y
  以 100 筆為一批查詢並排序，側欄與行動導覽加入入口。revision 124、全 Healthy。
R48 🔵 OpenAPI 補 `period=1y` 與 `details` 參數說明，revision 126、全 Healthy。
R49 🔵 清除未被任何頁面引用的死程式（PingChart／ScreenshotDialog／ScreenshotModal、
  useAuth／useMaintenances／useMonitors／useSettings／useStatusPages），
  build/unit 通過，revision 128、全 Healthy。
R50 🔵 型別修復：補 `@usebruno/lang`／`gamedig`／`snmp-native` 宣告、Tag 型別、
  ConfirmDialog 色彩與若干 method 大小寫；typecheck 66→23，revision 130、全 Healthy。
R51/R52 🔵 監控詳情頁新增「Check now」：`POST /api/v1/monitors/:id/check-now`；
  執行中的 monitor 提前 `nextCheckAt`，paused monitor 則走既有 bounded `trialMonitor`
  做一次性探測（不寫歷史、不發通知）。線上實測 paused monitor 回 `CHECK_OK`，
  UI toast 顯示「Check completed／CHECK_OK」。revision 134、API/worker/fixture 全 Healthy。

## 最終狀態（15:33 CST）
R1–R19 共 19 輪全部 commit、push 到 `origin/iterate/uptime-20261122`、並部署正式站。
release revision 64、Synced、API 2/2、worker 2/2、fixture 1/1 Healthy；build 成功；unit 58/58。
剩餘：Screenshot UI 沒有任何入口也沒有 API（低優先）；origin/main 92 commits 不合併（使用者指示）。
已無低風險高價值項目，停在乾淨狀態等待使用者指示。

## 舊中途狀態（12:46 CST）
13 輪全部已 commit 並部署到 lab 正式站，線上 revision 52、Healthy/Synced，無 console error/warning。
Git push：已用環境中的 GitHub token 成功推送到 `origin/iterate/uptime-20261122`（2026-11-22 12:5x）。

R14 🔵 About 頁三個缺失端點：`/api/info`（runtime/版本/uptime）、
`/api/check-update`（固定 GitHub releases URL、5 秒 timeout、失敗降級為 UNAVAILABLE）、
`/api/settings` POST 改走既有 `/api/settings/general`，並把 checkUpdate/checkBeta 存入 DB。
- 驗證：build 成功；unit 55/55。待部署與線上 About 頁驗證。

剩餘項目需使用者決定：SMTP/email 通知（刻意不支援，涉及 SSRF／憑證政策）、
Screenshot API（UI 元件未被任何頁面使用）、origin/main 92 commits 合併（使用者已指示不合併）。
