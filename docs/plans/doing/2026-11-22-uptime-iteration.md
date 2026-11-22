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
- 待部署：artifact／GitOps 完成後補上。
