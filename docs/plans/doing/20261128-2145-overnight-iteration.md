# SealWatch 持續迭代（直到 2026-11-29 08:00 CST）

**截止時間：2026-11-29 08:00 CST（週日早上 8 點）** — 使用者 2026-11-28 21:45 指示「持續優化到明天早上8am」。起始：2026-11-28 21:45 CST。

## 範圍與邊界

- 目標 repo：`uptime-iter-20261122`（SealWatch），線上 `uptime.markkulab.net`／`uptime.226network.com`，chart `uptime-api-demo-20261114/uptime-api`（lab）。
- 延續 `20261128-1258-site-audit-until-2000.md` 的 R156；本檔從 **R157** 起算。
- 交付：延續既有授權——每輪只 commit 自己改的檔並部署（loader → migration → app，等 Healthy/Synced 再驗兩域）。
- 禁區：不改其他平台共用 chart／secret／DB；共用工作樹不 stash／reset／clean／切分支；artifact 用私用 `ARTIFACT_OUTPUT_DIR=/tmp/opencode/uptime-artifacts` 打包，避免與別條 session 覆寫。
- 參考：Supercheck（CLI `pull/diff/deploy`、AI SRE 調查、requirements traceability）、Checkly（Monitoring as Code、API schema 驗證、Traces、status page 訂閱者）。
- 身份：`system_auth_status` 先前為 personal_key／admin／prod deploy allowed；每輪仍以 v-terminal MCP 寫入。

## 差距清單（按影響排序，隨 Round 更新）

| # | 差距 | 來源 | 狀態 |
| --- | --- | --- | --- |
| B1 | Monitoring as code：monitor／suite／status page 宣告式匯出／預覽 diff／原子匯入 | Checkly CLI/Terraform、Supercheck CLI | ⬜ |
| B2 | 失敗调查證據包：心跳／流程 trace／截圖／憑證／通知紀錄彙整成可分享 JSON | Supercheck AI SRE、Checkly Traces | ⬜ |
| B3 | API 檢查的 JSON Schema 驗證（Bruno 宣告式子集） | Checkly API Monitoring | ⬜ |
| B4 | 狀態頁事件訂閱者與通知（RSS 之外） | Supercheck subscriber notifications | 🔵 R157 |
| B5 | 收尾：OpenAPI／README／完整驗證／文件 | — | ⬜ |

## 迭代紀錄

格式：`R<n> ✅/❌ 標題 — commit／映像／驗證證據`

R157 ✅ 狀態頁訂閱者資料模型與公開 API — commit `cde58ad` 後。
- 參考 Supercheck（subscribers 收 Email／Slack／webhook 的事件與狀態更新）與 Checkly（訪客可訂閱更新）：
  新增 `StatusPageSubscriber`（email／token／verifiedAt，unique(statusPageId,email)）與
  `StatusPageNotificationOutbox`（事件、payload、重試狀態）兩張表＋migration `20261128220000`。
- 公開 API：`POST /api/status/{slug}/subscribers`（每 IP 5 次/分、雙重確認信）、
  `GET .../verify?token=`、`DELETE .../subscribers`（退訂並清待送 outbox）。
  管理 API：`GET`/`DELETE /api/v1/status-pages/{slug}/subscribers`（editor）。
- 信件只走操作者 SMTP relay，收件者／host／base URL 都驗證；無 SMTP 時回 `mail:unavailable` 而非假成功。
- 驗證：typecheck 0、unit 236/236。

- 部署 rev495（migration `20261128220000` 成功）；線上實測訂閱回 `pending/mail:unavailable`（未設 SMTP），後台可列出並刪除，測試資料已清除。

R158 ✅ 事件 outbox 與派送器 — commit `d9d7a85` 後。部署 rev498。
- `StatusPageNotificationOutbox` durable outbox＋`SubscriberOutboxDispatcher`（每 5 秒、批 10 筆、FOR UPDATE SKIP LOCKED、5 次重試；SMTP 未設定直接 dead）。
- 事件建立／更新／resolved 與 auto-incident 的 DOWN／UP 都 enqueue 給已驗證訂閱者；通知失敗不影響事件本身。
- worker runtime 啟動／drain 時一併管理派送器。unit 240/240、typecheck 0。

- 部署 rev498，migration 已套用。
  
R159 ✅ 訂閱 UI 與管理端 — commit `1323f0f` 後。
- 公開狀態頁新增 Email 訂閱表單（雙重確認提示、SMTP 未設定明確告知、確認成功提示）。
- 狀態頁編輯頁新增 Email subscribers 面板（列表／手動 Verify／Remove）；新增
  `POST /api/v1/status-pages/{slug}/subscribers/{id}/verify` 供 SMTP 不可用時維運確認。
- OpenAPI 補 4 個端點。unit 249/249、build 成功；typecheck 我觸摸的檔案 0 error，
  全 repo 仍有另一條 session 正開發 security-scan 的 `NO_FETCHER` 型別錯誤（未碰其檔案）。
- 部署時與另一條 session 的 GitOps values 寫入碰撞（rev501 後被覆寫）；等對方 rev502 Healthy 後
  以其 sha 為舊版重新部署，最終 rev506 Healthy/Synced。公開表單與後台面板皆實測存在。
- R160 ✅：補 `GET /api/v1/status-pages/{slug}/subscribers/outbox` 與後台 Notification log；
  在共用 `HttpFailureCode` 補 `NO_FETCHER`。unit 255/255，部署 rev516，
  實測訂閱→Verify→建立事件→outbox 產生 `incident-created`→清理完成。

R161 ✅失敗调查證據包 — commit `cd3dc5f` 後。部署 rev523，實測 `/api/v1/monitors/65/investigation` 回 50 筆心跳／20 筆通知紀錄與 agentHint。
- `buildInvestigationBundle()` 彙整最近 50 筆心跳、快取 TLS、5 份去敏感健檢報告、
  browser-flow 失敗截圖 metadata（不回 base64，指向既有端點）、20 筆通知投遞狀態，
  並產生 `agentHint` 給 Discord／Hermes agent。API `GET /api/v1/monitors/{id}/investigation`。
- 監控詳情頁「Investigate」按鈕＋對話框＋JSON 下載；OpenAPI 補端點。
- unit 263/263；typecheck 我觸摸的檔案 0 error，另一條 session 的 security-scan-checker
  仍有型別錯誤（未碰其檔案）。

R162 ✅ Monitoring as code（匯出／diff） — commit `636a34f` 後；最終 rev542 Healthy/Synced。
- `GET /api/v1/monitoring/export` 輸出 versioned JSON（URL 去 username/password/query；一般 HTTP body 不匯出，
  browser-flow／site-audit 的宣告式 body 保留）；`POST /api/v1/monitoring/plan` 回 create／update／nochange
  與欄位差異。宣告式 schema 拒絕未知欄位。期間與另一條 session 多次 GitOps 寫入碰撞
  （兩次短暫 502 為其滾動更新），在其 quiescent 視窗重試成功。
  
R163 🔵 Monitoring as code（套用／UI） — 程式完成，待部署。
- `applyDeclarative()` 在同一 transaction 內建立／更新 monitor；預設新建為 paused，
  `activate=true` 才啟用；重複名稱／非法欄位／機密 body 均拒絕。API `POST /api/v1/monitoring/apply`（owner）。
- `/monitoring-as-code` 頁面：下載現況、Preview diff、Apply、Activate 選項；sidebar／桌面／手機 nav 加「As Code」。
- OpenAPI 補 export／plan／apply。unit 274/274、typecheck 0、build 成功。
- unit 266/266；build 成功（第一次與另一條 session 並行 build 撞 cache，重跑通過）。
