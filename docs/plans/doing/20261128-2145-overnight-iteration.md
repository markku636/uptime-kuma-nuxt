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

R158 🔵 事件 outbox 與派送器 — 程式完成，待部署。
- `StatusPageNotificationOutbox` durable outbox＋`SubscriberOutboxDispatcher`（每 5 秒、批 10 筆、FOR UPDATE SKIP LOCKED、5 次重試；SMTP 未設定直接 dead）。
- 事件建立／更新／resolved 與 auto-incident 的 DOWN／UP 都 enqueue 給已驗證訂閱者；通知失敗不影響事件本身。
- worker runtime 啟動／drain 時一併管理派送器。unit 240/240、typecheck 0。

（後續 R159 做 UI）
