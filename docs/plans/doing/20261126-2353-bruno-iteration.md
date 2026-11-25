# Bruno 支援度與功能持續迭代紀錄

**截止時間：2026-11-26 08:00 CST（台北）** — 來源：使用者「持續優化迭代 bruno 的支援度及功能，直到早上 8am」（2026-11-25 23:53 CST 下達）。
**起始時間：2026-11-25 23:53 CST。**

## 範圍與邊界

- 目標：`uptime-iter-20261122`（`iterate/uptime-20261122`）的 Bruno monitor 編輯器與 parser，部署到 `https://uptime.markkulab.net`。
- 參考：GitHub `usebruno/bruno`（RequestPane / Assertions / QueryParams / Vars）與 `@usebruno/lang@0.41.0`。
- 禁區：不改其他平台共用 chart／套件／secret／DB；共用工作_tree 不 stash／reset --hard／clean／切分支；部署前已由使用者授權（2026-11-25「Commit 並部署正式站」），不再每輪重問。
- 每輪：只 commit 自己動的檔 → 走 v-terminal GitOps 部署 → 記錄 commit／artifact／revision／驗證證據。

## 差距清單（會隨 Round 更新）

| # | 差距 | 來源 | 優先 | 狀態 |
|---|------|------|------|------|
| G1 | 編輯器預設應為 UI editor（目前 Raw），空 `.bru` 按 UI 會報 `HTTP_BLOCK_REQUIRED` | 使用者 2026-11-25 | 高 | 🔵 R1 |
| G2 | 不同參數／斷言組合的自動化測試不足 | 使用者 2026-11-25 | 高 | 🔵 R1 |
| G3 | 嵌套 JSON body 的 `}}` 被 parser 誤判為 `UNSUPPORTED_VARIABLE` | 本輪查證 | 高 | ⬜ R2 |
| G4 | 官方支援但本平台尚未支援的 assert operator（in/notIn/matches/startsWith/endsWith/between/isJson…） | GitHub Bruno 原始碼 | 中 | ⬜ |
| G5 | 路徑參數（`:id`）與 path params 分頁 | GitHub Bruno 原始碼 | 中 | ⬜ |
| G6 | Params/Headers Bulk Edit（官方有） | GitHub Bruno 原始碼 | 低 | ⬜ |

## 迭代紀錄

格式：`R<n> ✅/❌ 標題 — commit／映像／驗證證據`
R1 ✅ 預設 UI editor + 參數／斷言 variant 測試 — commit `b8a6cf8`：
- 空 `.bru` 直接開空白 UI 表單，不再出現 `HTTP_BLOCK_REQUIRED`；有內容則自動 parse 進分頁；Raw 仍可切換。
- 新增 `tests/bruno-editor-variants.test.ts`（25 個案例：20 種 operator/expression、禁用列、placeholder、嵌套 URL、20 個參數、body/vars、不支援 operator 的安全錯誤碼）；既有 browser/create 測試改為配合 UI 預設。
- 驗證：unit 102/102、typecheck 0 errors、build 成功；整合 `bruno-editor-browser` + `bruno-create` 3/3 pass。
- 部署：artifact `7af3b9617990f61abd05defd1e9d98b8b24f146fe8d57550c1997dd029091c76`（203,741,704 bytes，source `b8a6cf8`）；
  loader GitOps `edd0ffbe`（rev223，Job `uptime-artifact-7af3b9617990-1` Succeeded）→ app `ad927e17`（rev224，Healthy/Synced）。
- 正式站 UI 需使用者登入後確認（目前只驗證到登入頁）。
R2 ✅ 嵌套 JSON body 支援 — commit `c767f16`：
- `server/services/bruno/parser.ts` 的變數檢查現在只拒絕未配對的 `{{`（open delimiter）；嵌套 JSON 結尾的 `}}` 不再誤判為 `UNSUPPORTED_VARIABLE`，且不會被展開成任何變數值。
- 新增測試：4 種嵌套 JSON body（含 literal `}}`）、未配對 `{{` 仍被拒；variant 測試的 JSON body 案例改回嵌套格式。
- 驗證：unit 104/104、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip。
- 部署：artifact `29d9f0d6de001073dca3fc157a5267958e91da675f60d4e10e0f858ec88133a4`（203,740,042 bytes，source `c767f16`）；
  loader rev225 → app rev226，最終 Healthy/Synced（rollout 中短暫 Degraded，10 秒後 Healthy）；短命 server 已停。
R3 ✅ 官方 assert operator 擴充 + UI 初始化修正 — commit `833e54c`：
- 新增 `in/notIn/startsWith/endsWith/length/isEmpty/isNotEmpty/isJson/isNumber/isString/isBoolean/isArray` 13 個 operator，
  貫穿 shared type、zod 驗證、`evaluateRule()`、Bruno parser 映射、Raw/UI 轉換與兩個編輯器下拉。
- 修正 R1 的 bug：workspace 仍載入時 `canEdit=false` 讓 UI 初始化跳過，導致有內容的 monitor 進編輯頁是空白；
  現在初始化不受 disabled 影響，disabled 只擋使用者輸入。
- 新增 `tests/assertion-operators.test.ts`（6 個語意測試）與 14 個新 variant 案例；既有不支援 operator 測試改為 `matches/notMatches/between`。
- 驗證：unit 123/123、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip（第一次跑的 group drag 為既有 flaky，重跑通過）。
- 部署：artifact `d5c569c9bd90a5d404908ec8a0dc164d745818cff3609c9af2b0958addcc2257`（203,742,289 bytes，source `833e54c`）；
  loader rev227 → app rev228，最終 Healthy/Synced。
R4 ✅ Path params 支援 — commit `70cab92`：
- `parser.ts` 接受 `params:path` block，並在執行前把 `:name` token 換成 path param 值；query/path 分開驗證、path 名稱限定 `^[A-Za-z_][A-Za-z0-9_]*$`。
- DTO 的 `params` 增加選填 `type:'query'|'path'`；Raw↔UI round-trip 保留；Params 分頁新增 Type 下拉（官方的行為）。
- 新增 3 個測試：path/query round-trip、URL 代入與 query 分離、非法 path 名稱 fail closed；既有 `params:path` 視為不支援的測試改為 `params:unknown`。
- 驗證：unit 126/126、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip。
- 部署：artifact `d1844eec0703b9eff39e4ef0a4b7fddf22235eef30df3a138ae7e149bc388ce5`（203,736,113 bytes，source `70cab92`）；
  loader rev229 → app rev230，Healthy/Synced。
R5 ✅ Params/Headers Bulk Edit — commit `d0701c3`：
- Bruno 分頁新增官方風格的 Bulk Edit / Table Edit 切換；`name: value` 每行一筆，`~` 前綴代表停用，
  切回表格與序列化都保留，Params 的 query/path 型別也會沿用。
- 瀏覽器測試實際走過：加 param → Bulk Edit 改值與停用列 → Table Edit → Raw 驗證 `.bru` 內容 → Send → Save → reload。
- 驗證：unit 126/126、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip（數次跑有既有 drag flaky，重跑通過）。
- 部署：artifact `6c69c567c3a046f4138560a1d4c0558921221fba6020026811ad7f7e9f9f9443`（203,737,351 bytes，source `d0701c3`）；
  loader rev231 → app rev232，最終 Healthy/Synced。
R6 ✅ 補齊安全 operator（between/isDefined/isUndefined/isTruthy/isFalsy） — commit `97775dc`：
- 官方 `between 200 299` token 解析成 `[200,299]` 範圍；其餘為無值型 predicate；regex 類（matches/notMatches）因 ReDoS 風險仍明確拒絕。
- 貫穿 shared type、zod、evaluateRule、parser、Raw/UI 轉換與兩個編輯器下拉。
- 驗證：unit 133/133、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip。
- 部署：artifact `b2fa2b59f43a9c4dd478143a5333fc5a71038050809c6d13c2b5ae5784e709e4`（source `97775dc`）；
  loader rev233 → app rev234，最終 Healthy/Synced。
R7 ✅ Query 值安全編碼 — commit `2b3a690`：
- 序列化 URL query 時只編碼字面值，保留 `{{VAR}}` 給 resolver；空白、`&`、unicode、混合 placeholder 都正確。
- 新增 variant 測試驗證 `.bru` URL 與 params block 的原始值行為。
- 驗證：unit 134/134、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip。
- 部署：artifact `9a8607774d6552677ba01d39c0f5e802222c2a7000eb5c715652b89c099e12e3`（source `2b3a690`）；
  loader rev235 → app rev236，最終 Healthy/Synced。
R8 ✅ Docs 分頁 — commit `dc45219`：
- `.bru` 的 `docs {}` block 進 DTO（選填）並在 UI 新增 Docs 分頁可讀寫；multiline 與 `{{variable}}` 原文保留，不影響實際送出請求。
- 驗證：unit 135/135、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip。
- 部署：artifact `fe61486b9cbb805c6acdbf76be2060babfce0d9261bbad1d31972c2bdbacb30d`（source `dc45219`）；
  loader rev237 → app rev238，最終 Healthy/Synced。
R9 ✅ UI 編輯保留不執行區塊 — commit `8e83be0`：
- `ignoredSources` 把 script/tests/post-response vars/settings 原文帶進 DTO，序列化時原樣附加；UI 不再要求二次確認，改為提示「保留但不執行」。
- 既有 full round-trip 測試改為驗證保留；新增 4 個 block 保留測試。
- 驗證：unit 136/136、typecheck 0 errors、build 成功、完整整合 94 pass / 1 skip。
- 部署：artifact `35a81850e1a2f0f4d4eab874f5063c99271a8e21b64d0120efb5a14e58845c41`（source `8e83be0`）；
  loader rev239 → app rev240，最終 Healthy/Synced。
R10 ✅ 既有 trial 缺變數 fail closed — commit `6cab92a`：
- `/api/v1/monitors/{id}/test` 包住 `resolveMonitorConfig()`，缺變數交給 checker 回 `CONFIG_ERROR`，不再 500。
- 整合測試建立含 `{{MISSING_EDITOR_VAR}}` 的 Bruno monitor 並驗證 trial 回 200/CONFIG_ERROR。
- 驗證：unit 136/136、typecheck 0 errors、build 成功、完整整合 95 pass / 1 skip。
- 部署：artifact `888234ae9dc742d6cfbbe8f9fd8fd80c741ebd154f464c8808fe99a33b119e37`（source `6cab92a`）；
  loader rev241 → app rev242，最終 Healthy/Synced。
R11 ✅ Ctrl/Cmd+Enter Send — commit `14bf5d8`：
- 編輯器內按 Ctrl/⌘+Enter 直接觸發 Send；按鈕旁顯示快捷鍵提示；瀏覽器測試改用快捷鍵送請求。
- 驗證：unit 136/136、typecheck 0 errors、build 成功、Bruno browser 2/2；完整整合的 group drag 為既有 flaky（單獨跑 3/3 通過，與 Bruno 無關）。
- 部署：artifact `b455617ba460befb529dc6d9a4009d3db4cea106ae1443ab359c80bb9c8c1597`（source `14bf5d8`）；
  loader rev243 → app rev244，最終 Healthy/Synced。
R12 ✅ API key 不讀 .bru 原文 — commit `c01aa3f`：
- `GET /api/v1/monitors/{id}` 只在互動式 session 回傳 Bruno source；read/write API key 都移除 `body`，viewer 本來就走 monitorSummary。
- 整合測試建立含 bearer token 的 Bruno monitor，驗證 session 可見、read/write key 與 viewer 都看不到原文。
- 驗證：unit 136/136、typecheck 0 errors、build 成功、完整整合 96 pass / 1 skip。
- 部署：artifact `179895cbae4d21652079b51ea55ee3825e2e516d3c0180df12481d0a8fbc8194`（source `c01aa3f`）；
  loader rev245 → app rev246，最終 Healthy/Synced。
R13 ✅ matches/notMatches（安全比對） — commit `9fdfa36`：
- 新增 `server/utils/safe-pattern.ts`：線性時間 DP 比對，支援字面/`.`/`[]`/轉義/`^$`/`*+?`；拒絕群組、alternation、backref、lookaround、`{}` 等量詞，避免 ReDoS；值上限 64 KiB、pattern 256 bytes。
- 貫穿 shared type、zod、evaluateRule、parser、Raw/UI 與兩個編輯器；不支援的 pattern fail closed 為 type_mismatch。
- 驗證：unit 140/140、typecheck 0 errors、build 成功、 Bruno 整合全綠；完整整合的 group drag 仍為既有 flaky（單獨跑通過）。
- 部署：artifact `de86d2347ffa53444cf4d783f29e4985f4302ee6d7ee7480ac77dee81972ae97`（source `9fdfa36`）；
  loader rev247 → app rev248，最終 Healthy/Synced。
R14 ✅ Script / Tests 唯讀分頁 — commit `5c2c735`：
- 官方排版補上 Script 與 Tests 分頁，顯示 R9 保留的 raw block；明確標示不執行、要改請用 Raw。
- 新增瀏覽器測試：建立含 script/tests 的 monitor → 預設 UI → 兩個分頁可見且內容正確。
- 驗證：unit 140/140、typecheck 0 errors、build 成功、Bruno browser 3/3。
- 部署：artifact `31978a7fde8d65b2d8e10ad444167e8d2cdebbcd1c702ee3d93e5785eec8bcbe`（source `5c2c735`）；
  loader rev249 → app rev250，Healthy/Synced。
R15 ✅ Path param 與 URL  token 對帳 — commit `8a17ae1`：
- `modelToSource()` 與 `buildRequest()` 都拒絕 URL 沒有對應 `:name` 的启用 path param，避免靜默忽略。
- 新增正反兩側測試（UI model 與直接 parser）。
- 驗證：unit 141/141、typecheck 0 errors、build 成功、完整整合 97 pass / 1 skip。
- 部署：artifact `044bf17922a1cbdd6307d28f1cf0465995ef0b566b204ae999a81109e963cc16`（source `8a17ae1`）；
  loader rev251 → app rev252，最終 Healthy/Synced。
R16 ✅ Settings 唯讀分頁 — commit `e3f8ed3`：
- 官方最後一個分頁補齊：顯示保留的 `settings {}` block，並標示 worker 不套用，interval/timeout 請用監測表單。
- 瀏覽器測試同時驗證 Script/Tests/Settings 三個分頁。
- 驗證：unit 141/141、typecheck 0 errors、build 成功、Bruno browser 3/3。
- 部署：artifact `9eb81a6258b8ae7be3a6a81b24002ffdee23a2ca564072a07de0b5d5465a3f88`（source `e3f8ed3`）；
  loader rev253 → app rev254，最終 Healthy/Synced。
