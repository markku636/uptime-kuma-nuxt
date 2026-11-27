# Bruno 配置體驗持續迭代紀錄

**截止時間：2026-11-27 20:00 CST（台北）** — 來源：使用者「優化完善 bruno 配置體驗 直到晚上 8pm」（2026-11-27 11:45 CST 下達）。
**起始時間：2026-11-27 11:45 CST。**

## 範圍與邊界

- 目標：`uptime-iter-20261122`（`iterate/uptime-20261122`）的 Bruno monitor 編輯器／parser，正式站 `https://uptime.markkulab.net`。
- 延續：[20261126-2353-bruno-iteration.md](./20261126-2353-bruno-iteration.md)（R65 結束，rev300）。本輪專注「配置體驗」（UI 編輯器、表單、錯誤提示、變數與憑證輸入），不重做已完成功能。
- 禁區：不改其他平台共用 chart／套件／secret／DB；共用工作樹不 stash／reset --hard／clean／切分支；commit 只 add 自己動的檔，不用 `--no-verify`。
- 每輪交付定義：只 commit（使用者本次未要求每輪部署）。部署前先問一次；若沿用舊授權需明確記錄。lab/prod 部署走 v-terminal GitOps，遇 cluster／artifact 阻塞時記下來換下一項，不硬推。
- 驗證：`npm run test:bruno`、`npm run typecheck`、`npm run build`、Bruno 相關整合測試；畫面改動要跑 browser 整合或如實標註未驗證。

## 差距清單（會隨 Round 更新）

| # | 差距 | 來源 | 優先 | 狀態 |
|---|------|------|------|------|
| U1 | 空白 Bruno monitor 在 UI editor 填完 URL 後 Send 按鈕仍 disabled（`rawSource` 空白），無法頁內試送 | 2026-11-27 code review | 高 | ✅ R1 |
| U2 | Auth 的 Password / Token 用 `type=text` 明文顯示，無顯示/隱藏切換 | 2026-11-27 code review | 高 | ✅ R2 |
| U3 | `savedSource` 只在 mount 時設定，Save 後 props 更新時 Reset 會退回舊內容 | 2026-11-27 code review | 中 | ✅ R9 |
| U4 | Operator 下拉沒有操作數格式提示（`between` 需 `min max` 等），易填錯 | 2026-11-27 code review | 中 | ✅ R3 |
| U4b | Bulk Edit 無效列被靜默丟棄 | 2026-11-27 code review | 高 | ✅ R4 |
| U5 | Raw 模式 Copy / Download 兩顆按鈕沒有間距；busy/parse 中缺少視覺回饋 | 2026-11-27 code review | 低 | ✅ R5 |
| U6 | 正式站 Bruno monitor（monitor 61）人工驗收仍需持有人登入 | 延續 N3 | 中 | ⬜（需使用者） |

## 迭代紀錄

格式：`R<n> ✅/❌ 標題 — commit／映像／驗證證據`

R1 ✅ UI editor 置左 + 空白請求可頁內 Send（11:45–11:51 CST）— commit `f99b38b`：
- 依使用者要求把分頁切換順序改成 `UI editor | Raw (.bru)`；按名稱定位的既有測試不受影響。
- `canSend` 改為依目前模式判斷：UI 模式有 URL 即可 Send（parent 的 `sync()` 會先序列化），Raw 模式仍有 `.bru` 才行；Ctrl/⌘+Enter 也遵守同一規則；URL 空白時顯示「Enter a URL to enable Send.」。
- 新增 browser 測試：空白 monitor → UI 填 URL → Send → fixture 收到 1 次請求且回應面板出現 Status 200 → 切 Raw 驗證 `.bru` 已序列化。
- 驗證：`npm run typecheck` exit=0、`npm run test:bruno` 109/109、`npm run build` 成功、Bruno editor browser 6/6（新測試包含在內）。
- 測試環境：kubectl port-forward `uptime-postgres-0` → 127.0.0.1:55464，隔離 DB 自動建立/銷毀，未動正式資料。
- 部署：未部署（本次交付定義為只 commit）。

R2 ✅ Auth 憑證預設遮罩 + 顯示切換（11:51–11:56 CST）— commit `5c96fee`：
- Basic Password / Bearer Token 改為 `type=password`，新增「Show credentials」核取方塊切換；補 `for/id` 與 `autocomplete=off`，並說明值存放在 `.bru`、API 不回傳。
- browser 測試：basic password 與 bearer token 預設為 password、勾選後變 text、getValue 仍保留、取消勾選再遮罩。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R3 ✅ Assert 值格式提示（11:56 CST）— commit `8c76112`：
- Value 輸入框依 operator 顯示不同 placeholder（between → `200 299`、in/notIn → `[200, 201]`、regex → `safe regex literal` 等），表格下補一段格式說明（含 unary 不需值）。
- browser 測試驗證切到 between / in 時 placeholder 正確，再切回 eq 不影響後續存檔流程。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R4 ✅ Bulk Edit 無效列提示（12:00–12:04 CST）— commit `87c4611`：
- 原本 `name: value` 解析會 silently 丟掉沒有冒號/空名稱的列；現在顯示 `Skipped line N: use "name: value" (prefix ~ to disable).`，切回表格前就能看到。
- 為避免 computed setter 在 Vue 重新渲染時把草稿正規化（第一次跑測試時警告被清掉、文字被吞），改為 textarea 有自己的 `bulkDraft`，watch 後解析進 model。
- browser 測試：`token: demo2\n~off: no\nbroken line\n: empty` → 警告列出 3、4 行 → Table Edit 只剩 2 列；後續 Raw/Save 流程不變。
- 驗證：第一次跑 5/6（警告被吞）→ 修正後 `npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R5 ✅ Raw 工具列與轉換回饋（12:04–12:07 CST）— commit `5768d89`：
- Copy / Download 兩顆按鈕加 `gap-2`；parse/stringify 進行中在工具列顯示 `Converting…`。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6（無視覺回歸）。
- 部署：未部署。

R6 ✅ Vars 變數清單可篩選（12:07–12:08 CST）— commit `be91b4a`：
- Vars 分頁新增 `Filter variables` 輸入框；篩選只套用到清單，`{{` 自動完成仍用完整變數集合。
- browser 測試：`EDITOR` 看得到、不存在的關鍵字看不到、清空後恢復。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R7 ✅ 編輯器顯示目前環境（12:08–12:12 CST）— commit `834d817`：
- 從 environments API 取回所選環境名稱，工具列顯示 `Environment: <name>`；載入失敗時不顯示，不影響其他功能。
- browser 測試驗證環境名稱出現（建立的 workspace 預設環境為 `default`）。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R8 ✅ Assert 快速新增（12:12–12:14 CST）— commit `f0061c7`：
- 「Quick add…」下拉提供 Status is 200 / Response time under 1000 ms / JSON field equals…，一鍵帶入 expression、operator、value，不必記 `.bru` 斷言語法。
- browser 測試選 responseTime 後驗證三欄值都正確填入，選完下拉自動回到提示。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R9 ✅ Reset 基準同步（12:14–12:17 CST）— commit `e802d12`：
- 集中所有 `update:modelValue` 到 `emitSource()`，用 `selfEmission` 區分自己的寫回與外部 props 更新；外部更新時同步 `savedSource`／`rawSource`，UI 模式重新初始化。
- 避免 Save／clone 在同一元件實例更新 source 後，Reset 退回舊 `.bru`。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6（既有 Reset／Save／Send 流程無回歸）。外部 prop 更新缺乏直接自動化案例，如實記錄。
- 部署：未部署。

R10 ✅ URL 格式即時提示（12:17–12:20 CST）— commit `ed0d019`：
- UI 與 Raw 模式都在 URL 不是 http(s)（且不是 `{{變數}}`）時顯示提示，不用等到 Send 才失敗。
- browser 測試：`ftp://` 出現提示，改回 http 後提示消失，Send 仍正常。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R11 ✅ 斷言結果摘要（12:20–12:22 CST）— commit `4884b96`：
- Send 結果的 Assertions 標題旁顯示「N passed / M failed」，不用逐條數。
- browser 測試驗證摘要出現。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R12 ✅ 文件更新 + 完整回歸（12:22–12:27 CST）— commit `a164ad5`：
- `docs/BRUNO_COMPATIBILITY.md` 補上 R1–R11 的行為。
- `TEST_PG_ADMIN_URL=postgresql://uptime@127.0.0.1:55464/postgres npm run verify:bruno` 全綠（unit 109/109、typecheck、build、Bruno 整合 27 pass / 1 skip）；完整 `npm run test:integration` 107 pass / 0 fail / 1 skip。
- 部署：未部署。

R13 ✅ lab 部署（14:56–15:01 CST，使用者授權「現在部署到 lab 驗證」）— 無程式 commit：
- Artifact：`4bb02a1c5a6a7987cfa9ac9c92532ffbd28462adfb285dd05b9cbfa008acd8a5`（204,810,327 bytes；source `6724089`、working tree clean、Node v20.20.0）；短命只讀 artifact server `192.168.50.57:18991` 供 loader 拉取後立即停止。
- v-terminal GitOps `uptime-api-demo-20261114/uptime-api`（deploy repo commit `587d5e9` loader → `30581ff` migration → `32f95a3` application）：rev304 loader Job `uptime-artifact-4bb02a1c5a6a-2` Succeeded；rev305 migration Job `uptime-migrate-4bb02a1c5a6a-2` Succeeded，套用 2 個先前未上的 visual-diff migrations；rev306 API 2/2、worker 2/2、DB 1/1 Healthy，release Healthy / Synced。
- 驗證：`/api/health/ready` = 200；未登入的 `/monitors/61/edit` 正確導向登入頁，故 UI 畫面仍待持有人登入 lab 驗收（不冒稱已人工驗收）。
- 正式站未部署（使用者只授權 lab）。

R14 ✅ JSON body 即時驗證（15:01–15:07 CST）— commit `a399cb9`：
- json body 輸入時即時檢查；`{{VAR}}` 先以純量替代再檢查，不會把合法 placeholder 誤判為錯誤。
- Body mode select 補 `aria-label="Body mode"` 方便自動化與鍵盤定位。
- 驗證：第一次跑 5/6（測試選到 Method 下拉而非 Body mode）→ 補 aria-label 後 `npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：此輪在 R13 lab 部署之後，尚未進 lab。

R15 ✅ 分頁鍵盤導覽（15:07–15:09 CST）— commit `11f3bf5`：
- 分頁按鈕可用 ← / → 切換並自動 focus 到新的分頁（環狀）。
- browser 測試驗證 ArrowRight / ArrowLeft。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：尚未進 lab。

R16 ✅ 重複欄位警告（15:09–15:11 CST）— commit `935e920`：
- 啟用中的 params / headers / vars 若有同名（不分大小寫）即在分頁上方顯示警告；停用列與空名稱忽略。
- browser 測試加第二個同名 param 出現警告，移除後消失；避免存檔時才被 strict parser 拒絕。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：尚未進 lab。

R17 ✅ 無效 URL 擋下 Send（15:11–15:14 CST）— commit `5083b64`：
- `canSend` 加入 `!urlWarning`，非 http(s) URL 不能試送；`{{var}}` 開頭的 URL 仍可送（執行時展開）。
- browser 測試：`ftp://` 時 Send disabled，改回 http 後恢復。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：尚未進 lab。

R18 ✅ 完整回歸 + lab 再部署 R14–R17（15:14–15:19 CST，沿用 lab 授權）— 無程式 commit：
- `docs/BRUNO_COMPATIBILITY.md` 補上 R14–R17；`npm run verify:bruno` 全綠（unit 109/109、Bruno 整合 27 pass / 1 skip、typecheck、build）。
- Artifact `b8b402cd199051e4ef7cd80134c04d6dbad1a8a405126600670be685da5ed674`（204,809,915 bytes；source `272c86f`、working tree clean）；短命 server 拉取後已停。
- GitOps `be485b1` loader（rev307，Job Succeeded）→ `83d372f` migration（rev308，Job Succeeded，無 pending migrations）→ `215bb95` application（rev309）。
- rev309 API 2/2、worker 2/2、DB/fixture Healthy，release Healthy / Synced；`/api/health/ready` = 200。正式站仍未部署。

R19 ✅ 環境變數 dialog 遵循 disabled（15:19–15:22 CST）— commit `73d56b2`：
- 把編輯器的 `disabled` 傳給 `EnvironmentVariablesDialog`，表單 loading／無權限時 dialog 也唯讀。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：此輪在 rev309 之後，尚未進 lab。

R21 ✅ Vars 清單截斷提示（15:22–15:24 CST）— commit `b4fbd0a`：
- 清單上限 50 筆；超過時顯示「Showing 50 of N variables — use the filter to find the rest.」
- browser 測試先建立 55 個環境變數，驗證提示出現。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：尚未進 lab。

R22 ✅ Vars 支援 Bulk Edit（15:24–15:27 CST）— commit `0446b88`：
- Params / Headers 的 Bulk Edit 延伸到 Vars；無效列警示、停用列前綴 `~` 與表格回填行為一致。
- browser 測試：Vars → Bulk Edit 填 `BULK_VAR: yes` → Table Edit 驗證列值。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：尚未進 lab。

R23 ✅ 最終回歸 + lab 部署 R19–R22（15:27–15:32 CST）— 無程式 commit：
- 文件更新、`npm run verify:bruno` 全綠（unit 109/109、Bruno 整合 27 pass / 1 skip、typecheck、build）。
- Artifact `c283ace735b26c24a9438ab96db4b9c7f5a3ba623a1f3a77924fed6ed63c6e5d`（204,823,899 bytes；source `d545d03`、working tree clean）；短命 server 拉取後已停。
- GitOps `9f55add` loader（rev310）→ `52164a0` migration（rev311，無 pending）→ `b141518` application（rev312）。
- rev312 API 2/2、worker 2/2、fixture 1/1 Healthy，release Healthy / Synced；`/api/health/ready` = 200。正式站未部署。

R24 ✅ 完整整合回歸（15:32–15:34 CST，驗證輪）— 無程式變更：`npm run test:integration` 107 pass / 0 fail / 1 skip；lab rev312 不變。

R25 ✅ 斷言 expression 自動建議（15:35–15:37 CST）— commit `9bf9753`：
- Assert 分頁 expression 欄位加 `datalist`，提供 `res.status` / `res.responseTime` / `res.body.data` / `res.headers.content-type` 等 6 個建議。
- browser 測試驗證 datalist 選項與 input 的 `list` 屬性。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：尚未進 lab（預計 R26 一起部署）。

## 目前狀態（2026-11-27 16:15 CST，截止 20:00）

- 本機 HEAD `0bab011`（32 輪，含環境編輯易用性 R27–R31）；工作樹乾淨，commit `f99b38b` → `0bab011`。
- lab：`uptime-api-demo-20261114/uptime-api` rev318，Healthy / Synced，artifact `539161e9…`，API/worker/fixture 全 Healthy，`/api/health/ready` 200。
- 驗證：`npm run verify:bruno` 全綠（unit 109/109、Bruno 整合 29 pass / 1 skip）；完整整合 109 pass / 0 fail / 1 skip；Bruno editor browser 8/8。
- 未部署正式站（使用者只授權 lab）。待持有人：到 lab／正式站登入後人工驗收 UI（R13 起如實記錄未做）。

R32 ✅ 完整回歸 + lab 部署 R27–R31（16:07–16:15 CST，沿用 lab 授權）— 無程式 commit：
- `docs/BRUNO_COMPATIBILITY.md` 補上環境編輯入口與功能；`npm run verify:bruno` 全綠、完整整合 109 pass / 0 fail / 1 skip。
- Artifact `539161e9dfe81a3f1c38da225848338a33ec465173d8508cbfd297abc03a3288`（204,823,738 bytes；source `7631787`、working tree clean）；短命 server 拉取後已停。
- GitOps `9eea3a7` loader（rev316）→ `b210f02` migration（rev317，無 pending）→ `02ead7c` application（rev318）。
- rev318 API 2/2、worker 2/2、fixture 1/1 Healthy，release Healthy / Synced；`ready` 200。正式站未部署。

R27 ✅ 監測編輯頁直接編輯環境變數（15:41–15:56 CST）— commit `458e4b3`：
- `MonitorForm.vue` 在 Basic Information 後新增獨立的 Environment variables 卡片與 `Edit environment variables` 按鈕，所有監測類型都能直接打開對話框（不再只有 Bruno 的 Vars 分頁）。
- 對話框 `insert` 事件：Bruno 透過新暴露的 `insertVariable()` 插入到最後聚焦欄位；其他類型插入到 URL 欄。
- 第一次跑 5/7：Bruno 測試遇到兩個同名按鈕（改用 `.last()`）；新測試的對話框沒出現（Nuxt 嵌套元件 auto-import 名稱是 `MonitorEnvironmentVariablesDialog`，補上明確 import）。第二次跑 6/7：URL 是 write-only 欄位，reload 後表單不回填，改為重新打開對話框驗證變數值。
- 驗證：最終 `npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 7/7。
- 部署：尚未進 lab。

R28 ✅ 環境編輯深連結（15:56–15:59 CST）— commit `456d953`：
- 對話框的 Settings 連結改為 `/settings/workspaces?environment=<id>`；workspaces 頁面讀取 query 並選取對應環境。
- browser 測試建立第二個環境後帶 query 進入設定頁，驗證下拉選到該環境。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 8/8。
- 部署：尚未進 lab。

R29 ✅ Settings 環境變數編輯易用性（15:59–16:01 CST）— commit `ce50e26`：
- 每列變數新增 `Copy token`（複製 `{{NAME}}`）、非法名稱即時提示；新增 `Reset changes`；新增 Preview placeholders（用尚未儲存的草稿值即時解析，secret 遮罩、缺值列出）。
- browser 測試：填變數與 preview 得到解析值、Copy token 寫入剪貼簿、Reset 還原。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 8/8。
- 部署：尚未進 lab。

R30 ✅ 嵌入對話框同步易用性（16:01–16:04 CST）— commit `740741d`：
- 對話框新增 Copy token / Reset changes / 非法名稱提示；Preview 改用以尚未儲存的草稿值解析。
- browser 測試：在監測編輯頁的對話框 Preview 得到解析值、Copy token 寫入剪貼簿、重新開啟後 Reset 還原已存值。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 8/8。
- 部署：尚未進 lab。

R31 ✅ 環境編輯副作用提示（16:04–16:07 CST）— commit `0bab011`：
- Settings 與對話框都標示「Saving reschedules every monitor in this environment.」；Settings 顯示變數草稿數量（N/200）。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 8/8。
- 部署：尚未進 lab。

R26 ✅ lab 部署 R25（15:37–15:41 CST，沿用 lab 授權）— 無程式 commit：
- Artifact `92d8e768d7a58e8ffd1b6045755a6a97054faa13e52b1c5c27739b7bc239f18b`（204,817,549 bytes；source `a456e5d`、working tree clean）；短命 server 拉取後已停。
- GitOps `6b4b474` loader（rev313）→ `f76b4e8` migration（rev314，無 pending）→ `df42987` application（rev315）。
- rev315 API 2/2、worker 2/2、fixture 1/1 Healthy，release Healthy / Synced；`ready` 200。正式站未部署。


