# Uptime 226network 持續迭代紀錄

**截止時間：2026-11-22 20:00 CST（台北）** — 來源：使用者「持續優化迭代這系統到晚上8pm」。
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
- 待部署：artifact／GitOps／線上驗證完成後補上。
