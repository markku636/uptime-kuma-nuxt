# 主題 Design Token 與維護功能補齊計劃

> 建立日期：2026-11-16
> 參考來源：`D:\project\uptime-kuma`（`src/assets/vars.scss`、`src/assets/app.scss`、`src/pages/EditMaintenance.vue`、`src/pages/ManageMaintenance.vue`、`server/model/maintenance.js`、`server/socket-handlers/maintenance-socket-handler.js`）
> 狀態：僅規劃，尚未修改任何程式碼

本文件分兩部分：**A. 明暗主題與 design token**、**B. 維護（Maintenance）功能補齊**。最後列出需要你決定的事項。

---

## A. 明暗主題與 Design Token

### A1. 現況盤點

| 項目 | 現況 | 問題 |
|---|---|---|
| Token 定義 | `assets/css/main.css` 的 `:root` / `.dark` 共約 20 個變數 | 命名混用 `--uk-*`、`--bg-*`、`--text-*`、`--color-gray-*`，沒有分層 |
| 品牌色 | CSS 為 `#12b06a`，`useAppearanceSettings.ts` 的 green 為 `#5cdd8b`，`app.vue` meta 為 `#10b981`，focus ring 寫死 `rgb(16 185 129)` | 同一個「主色」有 4 個不同值 |
| 狀態色 | danger `#e11d48`、warning `#f59f0b`，與原版 `#dc3545`、`#f8a306` 不同；元件另外直接用 `text-red-*` / `bg-green-*` 等約 400 處 | 狀態色沒有單一來源 |
| 暗色文字 | `--text-muted: #020b05`（暗色模式） | 近乎純黑放在深色背景上，看不見。原版 `$dark-font-color2` 是「主色按鈕上的文字色」，被誤用成 muted |
| 暗色層次 | 頁面 `#0d1117`、卡片 `--bg-secondary: #070a10` | 卡片比頁面更暗，層次顛倒。原版是頁面 `#090c10` → 卡片 `#0d1117` → 標題列 `#161b22` |
| 亮色補丁 | `main.css` 第 79–179 行用 `html:not(.dark) ... !important` 覆寫 Tailwind 的 `text-gray-*`、`bg-gray-800`、`[class*="dark:text-gray-"]` | 用全域覆寫修對比，讓 utility class 的意義失真，之後難以維護 |
| 寫死的顏色 | `.vue` 內約 520 處 hex、1,396 處 `gray/slate` utility、547 處 `dark:` 變體 | 兩套主題靠每個元件各自寫兩次 |
| 未定義的變數 | `--color-primary`、`--color-border`、`--color-text*`、`--color-bg*`、`--color-danger*` 被 5 個元件使用，但只在 `MonitorSelector.vue` 內區域定義 | 其他 4 個元件（`MonitorListItem`、`EditSidebar`、`IncidentEditor`、`LogoUploader`）吃不到值 |
| 寫死亮色的 class | `.btn-outline`、`.btn-secondary`、`.alert-*`、`.badge-*`、`.form-select`、`.table tbody tr:nth-child(even)` | 暗色模式下沒有對應值 |
| Nuxt UI 串接 | `applyPrimaryColor()` 設定 `--color-primary-500/600`；`main.css` 只有 `@import "tailwindcss"`；沒有 `app.config.ts` | 需確認 Nuxt UI v4 實際讀的是 `--ui-primary` 系列，且 CSS 是否需要 `@import "@nuxt/ui"`（**待實作時對照官方文件驗證**） |
| 主題切換 | `app.vue` 手動加減 `dark` class，同時 `colorMode.classSuffix: ''` 已會做同一件事 | 重複；另外 `ThemeOption` 同時有 `system` 與 `auto` |
| 公開狀態頁 | 有自己的 `status-page-dark` / `status-page-light` class，`pages/status/[slug].vue` 內 78 處 hex | 與後台主題是兩套機制 |

寫死顏色最多的檔案（優先遷移）：
`components/status-page/EditSidebar.vue`(108)、`pages/status/[slug].vue`(78)、`pages/status-pages/index.vue`(40)、`pages/maintenance/index.vue`(39)、`components/status-page/IncidentEditor.vue`(32)。
`gray-*` utility 最多：`pages/monitors/[id]/index.vue`(58)、`pages/settings/about.vue`(51)、`pages/maintenance/[id]/index.vue`(36)。

### A2. Token 架構（三層）

```
Primitive（原始色票）      --uk-green-400、--uk-ink-900 …      不直接在元件使用
      ↓
Semantic（語意）           --uk-bg-surface、--uk-text-muted …  元件只用這層
      ↓
Component（元件）          --uk-beat-empty、--uk-sidebar-bg …  只在需要偏離語意層時才加
```

規則：
1. 元件內不出現 hex、不出現 `gray-*` / `red-*` 等色階 utility、不需要寫 `dark:`。
2. 明暗差異只存在於 semantic 層的兩組值。
3. 統一前綴 `--uk-`；舊名（`--bg-primary` 等）保留為別名一個階段後移除。

### A3. Primitive tokens

品牌與狀態（取自原版 `vars.scss`）：

| Token | 值 | 來源 |
|---|---|---|
| `--uk-green-50` | `#e7faec` | `$highlight-white` |
| `--uk-green-300` | `#7ce8a4` | `$highlight` |
| `--uk-green-400` | `#5cdd8b` | `$primary` |
| `--uk-green-600` | `#0f8a53` | 新增，亮色模式文字用 |
| `--uk-red-500` | `#dc3545` | `$danger` |
| `--uk-red-300` | `#f0616d` | 新增，暗色模式文字用 |
| `--uk-amber-500` | `#f8a306` | `$warning` |
| `--uk-amber-700` | `#b76b00` | 沿用現有 alert 文字色 |
| `--uk-blue-600` | `#1747f5` | `$maintenance` |
| `--uk-blue-300` | `#6d8dfa` | 新增，暗色模式文字用 |

中性色：
- 亮色沿用現有 slate 階（`#f8fafc` … `#020617`）。
- 暗色用原版 ink 階：`#070a10`（bg2）、`#090c10`（body）、`#0d1117`（bg）、`#161b22`（header）、`#1d2634`（border）、`#232f3b`（hover/active）、`#535864`（disabled）、`#b1b8c0`（font）。

> 標示「新增」的色值是我提出的起始值，尚未用對比工具驗證，A6 第 1 階段會逐一檢查並微調。

### A4. Semantic tokens

**背景 / 層次**

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--uk-bg-app` | `#f7f9fc` | `#090c10` | 頁面底色 |
| `--uk-bg-surface` | `#ffffff` | `#0d1117` | 卡片、清單、modal |
| `--uk-bg-raised` | `#ffffff` | `#161b22` | 頂欄、表頭、下拉選單 |
| `--uk-bg-sunken` | `#eef2f8` | `#070a10` | 輸入框、code block |
| `--uk-bg-hover` | `rgba(15,23,42,.04)` | `#161b22` | 列 hover |
| `--uk-bg-active` | `#e7faec` | `#232f3b` | 選中的清單項目 |
| `--uk-bg-overlay` | `rgba(15,23,42,.45)` | `rgba(0,0,0,.6)` | modal 遮罩 |

**文字**

| Token | Light | Dark | 用途 |
|---|---|---|---|
| `--uk-text` | `#0f172a` | `#d1d5db` | 主要內文 |
| `--uk-text-secondary` | `#475569` | `#b1b8c0` | 次要、label |
| `--uk-text-muted` | `#64748b` | `#8b949e` | 說明、時間戳 |
| `--uk-text-disabled` | `#94a3b8` | `#535864` | 停用 |
| `--uk-text-on-primary` | `#020b05` | `#020b05` | 主色按鈕上的字（見決策 1） |
| `--uk-text-link` | `#0f8a53` | `#5cdd8b` | 連結 |

**邊框 / 焦點**

| Token | Light | Dark |
|---|---|---|
| `--uk-border` | `#d6deea` | `#1d2634` |
| `--uk-border-strong` | `#cbd5e1` | `#30363d` |
| `--uk-ring` | `color-mix(in srgb, var(--uk-primary) 35%, transparent)` | 同左 |

**品牌與狀態**（每個狀態三個值：實心、文字、淡底）

| Token | Light | Dark |
|---|---|---|
| `--uk-primary` | `#5cdd8b`（可由外觀設定覆寫） | 同左 |
| `--uk-primary-hover` | `#7ce8a4` | `#7ce8a4` |
| `--uk-status-up` / `-fg` | `#5cdd8b` / `#0f8a53` | `#5cdd8b` / `#5cdd8b` |
| `--uk-status-down` / `-fg` | `#dc3545` / `#b02a37` | `#dc3545` / `#f0616d` |
| `--uk-status-pending` / `-fg` | `#f8a306` / `#b76b00` | `#f8a306` / `#f8a306` |
| `--uk-status-maintenance` / `-fg` | `#1747f5` / `#1747f5` | `#1747f5` / `#6d8dfa` |
| `--uk-status-*-subtle` | `color-mix(in srgb, <實心> 12%, transparent)` | `… 18% …` |

`alert-*`、`badge-*`、`btn-danger/warning`、心跳條、圖表、`Status.vue` / `StatusPill.vue` 全部改吃這組。

**非顏色**

| 類別 | Token |
|---|---|
| 圓角 | `--uk-radius-sm: 6px`、`-md: 8px`、`-lg: 12px`、`-pill: 50rem`（原版 `$border-radius`） |
| 陰影 | `--uk-shadow-card`、`--uk-shadow-popover`（亮色用陰影，暗色改為 `0 0 0 1px var(--uk-border)`，因陰影在深底不可見） |
| 動效 | `--uk-ease-in/out/in-out`（照搬原版三條 cubic-bezier）、`--uk-duration-fast: .15s`、`-base: .2s`、`-slow: .3s` |
| 字體 | `--uk-font-sans`、`--uk-font-mono`（`ui-monospace` 那組，目前 `--font-mono` 有被使用但未定義） |
| 層級 | `--uk-z-sidebar / header / dropdown / modal / toast` |

間距與字級沿用 Tailwind 預設，不另外定義。

### A5. Component tokens（僅列需要的）

| Token | Light | Dark | 備註 |
|---|---|---|---|
| `--uk-beat-empty` | `#e2e8f0` | `#30363d` | 無資料的心跳格 |
| `--uk-beat-width / -height / -gap` | `6px / 28px / 2px` | 同左 | 目前 4 個 HeartbeatBar 元件各自定義 |
| `--uk-sidebar-bg` | `var(--uk-bg-surface)` | `var(--uk-bg-surface)` | |
| `--uk-input-bg` | `var(--uk-bg-surface)` | `var(--uk-bg-sunken)` | 亮色輸入框維持白底 |
| `--uk-chart-grid / -axis / -line` | 對應 border / text-muted / primary | 同左 | `PingChart.vue`、`UptimeChart.vue` 目前寫死 |

### A6. 實作階段

| 階段 | 內容 | 主要檔案 | 風險 |
|---|---|---|---|
| **1. 建立 token** | 新增 `assets/css/tokens.css`（三層）；舊變數改成指向新 token 的別名；修正 `--text-muted` 與暗色層次；用對比工具檢查所有 文字×背景 組合（內文 ≥ 4.5:1、大字與圖示 ≥ 3:1）並調整「新增」色值 | `assets/css/tokens.css`、`main.css` | 低。純加法，畫面只有暗色層次與 muted 文字會變 |
| **2. 串接 Tailwind 與 Nuxt UI** | 用 Tailwind v4 `@theme` 把 semantic token 曝露成 utility（`bg-surface`、`text-muted`、`border-default`、`text-status-down`…）；把 Nuxt UI 的 `--ui-*` 變數對應到 `--uk-*`；新增 `app.config.ts` 設定 primary / neutral；修正 `applyPrimaryColor()` 寫入的變數名 | `main.css`、`app.config.ts`、`composables/useAppearanceSettings.ts` | 中。需先對照 Nuxt UI v4 文件確認變數名與 CSS import 方式 |
| **3. 清理主題切換** | 移除 `app.vue` 手動 class 切換；`auto` 併入 `system`；`theme-color` meta 隨明暗切換；首次載入不閃爍 | `app.vue`、`nuxt.config.ts`、`plugins/appearance.client.ts` | 低 |
| **4. 全域 class 改用 token** | `.btn-*`、`.alert-*`、`.badge-*`、`.form-select`、`.table`、`.link`、`.spinner`、focus ring、glow、pulse 動畫 | `main.css` | 低 |
| **5. 元件遷移** | 依寫死顏色數量由多到少，分批把 hex / `gray-*` / `dark:` 換成 semantic utility。建議批次：① layout + common ② dashboard + monitor ③ maintenance + settings ④ status-page 編輯器 ⑤ 公開狀態頁 | 約 60 個 `.vue`（通知 provider 表單多為 Nuxt UI 元件，預期改動少） | 中。量大；每批完成後明暗各看一輪 |
| **6. 移除補丁** | 刪除 `main.css` 第 79–179 行的 `html:not(.dark)` 覆寫，以及舊變數別名 | `main.css` | 中。必須在第 5 階段全部完成後才能做，否則亮色會回到低對比 |
| **7. 防止回退** | 加一支檢查腳本（或 lint 規則）：`components/`、`pages/`、`layouts/` 內出現 hex 或 `(bg\|text\|border)-(gray\|slate\|red\|green…)-\d+` 就報錯 | `package.json` scripts | 低 |

公開狀態頁（第 5 階段 ⑤）另需處理：狀態頁自己的 `theme` 欄位（auto/light/dark）要能覆寫訪客的系統設定，且使用者的 `customCss` 可能依賴現有 class 名稱，遷移時保留 class 名、只換顏色來源。

---

## B. 維護（Maintenance）功能補齊

> 我把「監控維護功能」理解為原版的 **Maintenance（排程維護時段）** 功能。若你指的是其他範圍（例如資料庫維護、監控項目本身的功能缺口），請告訴我，B 部分會重寫。

### B1. 現況

已有：Prisma `Maintenance` / `MaintenanceMonitor` / `MaintenanceStatusPage` 模型（欄位齊全）、`server/services/maintenance/scheduler.ts`（croner 排程、時區、狀態計算）、監控排程器在維護中寫入 status 3、Socket 事件 7 個、列表與編輯頁面。

**實際問題（功能上會壞的）**

| # | 問題 | 位置 |
|---|---|---|
| 1 | 有兩套 REST API：`/api/v1/maintenance/*`（單數）與 `/api/v1/maintenances/*`（複數），前端混用 | `server/api/v1/maintenance/`、`server/api/v1/maintenances/` |
| 2 | 單數路徑沒有 `[id].get` / `[id].put`，但 `pages/maintenance/[id]/index.vue`、`[id]/edit.vue`、`MaintenanceDialog.vue`、`useMaintenances.ts` 都在呼叫 | 檢視 / 編輯頁應該會 404 |
| 3 | 單數 `index.post` 的 strategy 只接受 `manual` / `recurring` | 與排程器支援的 6 種不符 |
| 4 | 複數 `index.post` 建立時沒寫 `userId`（schema 必填），也沒存 `monitorIds`、`weekdays`、`daysOfMonth`、`timeRange`、`dateRange`、`intervalDay`、狀態頁關聯 | 建立應該會失敗，或建立後沒有影響任何監控 |
| 5 | REST 的新增 / 修改 / 暫停 / 恢復 / 刪除都沒有呼叫 `startMaintenanceJob` / `stopMaintenanceJob` | 透過 REST 的變更要重啟才生效；只有 Socket 路徑有接排程器 |
| 6 | 單數路徑同時放了資料庫清理 API（`clear-heartbeats`、`shrink-database`…） | 命名衝突，語意混淆 |
| 7 | 編輯 UI 有三份且選項不一致：`pages/maintenance/index.vue` 內嵌 modal（用了不存在的 Bootstrap class `form-control` / `row` / `col`）、`[id]/edit.vue`（有不存在的 `status-page` 策略、缺 `cron`）、`MaintenanceDialog.vue` | |
| 8 | `useMaintenances.ts` 在前端自行判斷 active / ended，型別只有 3 種策略 | 與後端 `getMaintenanceStatus` 結果會不一致 |
| 9 | `recurring-day-of-month` 的 `lastDay2`–`lastDay4` 被略過；`recurring-interval` 用 `* * * * *` 加 `interval` 選項 | 需對照原版 `generateCron()` 確認行為一致 |

以上第 2、4 點是從程式碼讀出來的推論，尚未實際執行驗證。

### B2. 與原版的功能差距

| 功能 | 原版 | Nuxt 版 | 處理 |
|---|---|---|---|
| 6 種策略（manual / single / cron / recurring-interval / -weekday / -day-of-month） | ✅ | 排程器 ✅、API 與 UI 不完整 | 補齊 |
| 影響的監控（多選、全選 / 取消全選、顯示群組路徑） | ✅ | UI 有欄位，REST 未儲存 | 補齊 |
| 影響的狀態頁（全部 / 指定） | ✅ | 模型有，API 與 UI 缺 | 補齊 |
| 時區選擇（完整清單、「與伺服器相同」、UTC） | ✅ | 只有寫死 8 個 | 補齊 |
| 生效日期範圍（recurring / cron 的起訖日） | ✅ | 缺 | 補齊 |
| 每日時間範圍（起迄時間） | ✅ | 部分 | 補齊 |
| Cron 表達式即時翻譯成文字（`cronstrue`）與驗證 | ✅ | 缺（只有 crontab.guru 連結） | 補齊，需新增套件 |
| 列表狀態：`under-maintenance` / `scheduled` / `inactive` / `ended` / `unknown`，依狀態排序與著色 | ✅ | 部分 | 補齊，狀態由後端提供 |
| 列表顯示目前時段與時區（`MaintenanceTime`） | ✅ | 缺 | 補齊 |
| 暫停（含確認）/ 恢復 / 編輯 / 刪除（含確認） | ✅ | ✅ | 統一 API |
| 複製（Clone） | ✅ | 缺 | 補齊 |
| 公開狀態頁顯示進行中 / 已排程的維護公告 | ✅ | 有藍色區塊，資料來源需確認 | 驗證後補 |
| 監控詳情頁顯示所屬維護 | 部分 | 只有狀態文字 | 選配 |
| 維護開始 / 結束時通知 | ❌（原版也沒有） | ❌ | 不做，除非你需要 |

### B3. 實作階段

| 階段 | 內容 | 主要檔案 |
|---|---|---|
| **1. 統一後端** | 保留複數 `/api/v1/maintenances/*` 為唯一維護 API；資料庫清理 API 搬到 `/api/v1/database/*`；抽出 `server/services/maintenance/service.ts`（create / update / delete / pause / resume / clone），REST 與 Socket 都呼叫它，確保每次變更都同步排程器並廣播；zod schema 涵蓋全部欄位、驗證 cron 與時區；`GET` 回傳 `maintenanceToPublicJSON` 結果（含 `status`、`timeslotList`、`monitors`、`statusPages`） | `server/api/v1/maintenances/*`、`server/api/v1/maintenance/*`、`server/services/socket.ts`、新 service |
| **2. 排程器對齊** | 對照原版 `generateCron()` / `run()`：`lastDay1`–`lastDay4`、interval、跨日時間範圍、`dateRange` 起訖、`SAME_AS_SERVER` 時區；為純函式部分補單元測試（專案目前沒有測試框架，需加 vitest） | `server/services/maintenance/scheduler.ts` |
| **3. 統一前端** | 單一 `MaintenanceForm.vue`，`add.vue` 與 `[id]/edit.vue` 共用，支援 `?cloneId=`；刪除 `index.vue` 內嵌 modal 與 `MaintenanceDialog.vue`；`useMaintenances.ts` 改用複數 API、移除前端狀態推算；新增 `MaintenanceTime.vue`；加入 `cronstrue`；完整時區清單；多選監控（含全選）與狀態頁 | `pages/maintenance/*`、`components/maintenance/*`、`composables/useMaintenances.ts` |
| **4. 列表頁** | 依狀態排序與著色（用 A 部分的 `--uk-status-*` token）、暫停確認、複製按鈕、Socket 即時更新 | `pages/maintenance/index.vue` |
| **5. 對外呈現** | 公開狀態頁的維護公告（進行中 / 已排程，含時段與時區）；儀表板與監控詳情的維護標示 | `pages/status/[slug].vue`、`server/api/v1/status-pages/[slug]/*` |
| **6. i18n** | 新介面字串全部走 `$t()`，沿用原版 key（`strategyManual`、`affectedMonitorsDescription`、`maintenanceStatus-*`、`lastDay1`… 已存在於 `locales/*.json`） | `pages/maintenance/*` |
| **7. 驗證** | 每種策略建立 → 確認監控在時段內寫入 status 3、時段外恢復；暫停 / 恢復 / 刪除即時生效不需重啟；叢集模式下多節點行為（排程器是每節點各跑一份，需確認不會重複廣播） | — |

### B4. 建議順序

1. **B 階段 1–2**（後端修正）— 目前有實際壞掉的路徑，優先。
2. **A 階段 1–4**（token 基礎）— 改動集中在 3–4 個檔案，完成後新寫的 UI 就能直接用 token。
3. **B 階段 3–6**（維護 UI 重寫）— 直接用新 token 寫，不必寫完再遷移一次。
4. **A 階段 5–7**（其餘元件遷移）— 量最大，可分批進行。

---

## 需要你決定的事

1. **主色按鈕的文字色**：`#5cdd8b` 底配白字對比不足。建議改成深色字 `#020b05`（原版暗色模式的做法）。這會改變所有主要按鈕的外觀。替代方案是按鈕底色改用較深的 `#0f8a53` 保留白字。
2. **狀態色對齊原版**：danger `#e11d48` → `#dc3545`、warning `#f59f0b` → `#f8a306`、主色 `#12b06a` → `#5cdd8b`。建議對齊；若你偏好現在的色調則保留現值、只做 token 化。
3. **亮色模式的綠色漸層背景**（`radial-gradient`）：原版沒有。保留或移除？
4. **「監控維護功能」的範圍**是否就是 B 部分所述的 Maintenance 排程維護？
5. **是否要加 vitest**（B 階段 2 的排程邏輯測試）。專案目前沒有測試框架。

---

## 實作狀態（2026-11-16）

採用的決策：主色按鈕改用深色字 `#020b05`；狀態色對齊原版（`#5cdd8b` / `#dc3545` / `#f8a306` / `#1747f5`）；移除亮色綠色漸層背景；範圍為 Maintenance 排程維護；加入 vitest。

### 已完成

**Design token**
- `assets/css/tokens.css`：三層 token（primitive / semantic / component）＋ Nuxt UI `--ui-*` 對應。所有 文字×背景 組合已用對比計算檢查（內文 ≥ 4.5:1）。
- `assets/css/main.css`：補上原本缺少的 `@import "@nuxt/ui"`；以 `@theme` 輸出 `bg-app`、`text-down-fg`、`bg-up-subtle` 等 utility；刪除 `html:not(.dark)` 的 `!important` 補丁；舊變數名保留為別名。
- `app.config.ts`：Nuxt UI 主色為 `kuma` 色票；外觀設定的「主色」改為切換 `appConfig.ui.colors.primary`。
- `app.vue`：移除重複的 dark class 切換；`theme-color` 隨明暗變化；`auto` 主題正規化為 `system`。
- 元件遷移：130 個 `.vue` 的 Tailwind 灰階／狀態色 utility 與 `dark:` 變體改為語意 utility；`<style>` 內的 hex 改為 `var(--uk-*)`；`PingChart` 透過 `useCssTokens()` 讀取 token。
- 公開狀態頁：自訂主題（light/dark/auto）改為切換 `.dark` class，不覆寫管理者的偏好。
- 防回退：`npm run lint:colors`（`scripts/check-colors.mjs`）。

**維護功能**
- `server/services/maintenance/schedule.ts`：純函式排程邏輯（狀態、時段、cron 產生、時區、間隔天數），19 個單元測試（`npm test`）。狀態由設定與時間計算，不依賴記憶體中的 job，叢集各節點結果一致。
- `server/services/maintenance/service.ts`：REST 與 Socket 共用的 CRUD；完整 zod 驗證；每次變更都會重新排程並廣播。
- API 統一為 `/api/v1/maintenances/*`；資料庫清理 API 移至 `/api/v1/database/*`。
- 前端：單一 `MaintenanceForm`（新增／編輯／複製）、列表依狀態排序並顯示時段、詳情頁、`MaintenanceTime`、`MaintenanceStatusBadge`；監控所屬群組在維護中時，子監控也視為維護中。
- 公開狀態頁顯示進行中的維護公告（不含監控 ID）。

**順帶修正**
- `@nuxtjs/i18n` 找不到設定檔（`vueI18n` 路徑錯誤），全站翻譯原本未生效。
- 31 個檔案各自 `new PrismaClient()`，改用共用 client（避免連線池耗盡）。

### 尚未處理 / 後續
- `server/services/socket.ts` 的 `loginByToken` 未驗證 token，任何連線都會被當成 user 1（既有問題）。
- `/status-pages/add` 使用不存在的 `StatusPagesEdit` 元件（既有問題）。
- 約 20 個裝飾性 hex 與藍色系 utility（非狀態用途）仍保留；色票資料（標籤顏色等）屬資料，不需轉換。
- 尚未在實際瀏覽器畫面上目視檢查明暗兩版（驗證以 DOM 與 computed style 進行）。
