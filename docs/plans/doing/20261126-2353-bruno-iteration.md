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
R17 ✅ Send 斷言顯示 actual — commit `297e111`：
- 僅在 trial（includeTrialResponse）時附帶 actual，值上限 512 字元；排程 heartbeat 不寫入，避免敏感值落地。
- Bruno 結果面板顯示 actual；新增 unit 驗證 scheduled 無 actual、trial 有值且截斷。
- 驗證：unit 142/142、typecheck 0 errors、build 成功、完整整合 97 pass / 1 skip。
- 部署：artifact `931e18e5c1539feda17e6df46765310701a0bb3ce2d85832fc78b06b038b0977`（source `297e111`）；
  loader rev255 → app rev256，最終 Healthy/Synced。
R18 ✅ Vars 分頁變數清單/插入 — commit `2985c6a`：
- Vars 分頁直接列出目前環境的變數（secret 顯示 ••••••）與 Insert 按鈕，插入最後聚焦的輸入框；上限 50 筆避免畫面爆量。
- 瀏覽器測試驗證環境變數建立後清單出現且 Insert 可用。
- 驗證：unit 142/142、typecheck 0 errors、build 成功、Bruno browser 3/3。
- 部署：artifact `d6d2cc36ff3504de63b6563a1659b69092d2c022b9e965f17db715c538a0c31a`（source `2985c6a`）；
  loader rev257 → app rev258，最終 Healthy/Synced。
R19 ✅ stringify payload 上限 — commit `dd4769f`：
- 序列化 API 在 walking model 前先限制 JSON 的大小（2 MiB）並攔截無法序列化的輸入，回 400/413，不回傳內容。
- 整合測試以 3 MiB docs 模型驗證 413 且 response 不含 payload。
- 驗證：unit 142/142、typecheck 0 errors、build 成功、Bruno API 整合 5/5。
- 部署：artifact `61f5051aed91a502ea915cb602702ae25449bbecde00dbbfcb14cd0aec5bdf6a`（source `dd4769f`）；
  loader rev259 → app rev260，最終 Healthy/Synced。
R20 ✅ `{{` 變數自動完成 — commit `0cff909`：
- 任一欄位輸入 `{{` 後彈出符合的環境變數（secret 遮罩），點選直接替換游標前的 `{{partial`；Esc 關閉，可用滑鼠或鍵盤延續。
- 瀏覽器測試走過完整流程：建立 EDITOR_VAR → Vars 分頁可見 → URL 輸入 `{{ED` → 選取 → 值正確插入 → 清除後 Send 仍正常。
- 驗證：unit 142/142、typecheck 0 errors、build 成功、Bruno browser 3/3。
- 部署：artifact `03685814703ac124b939fba5463f7902341bc43e9e4380b03e64ab8da506f42d`（source `0cff909`）；
  loader rev261 → app rev262，最終 Healthy/Synced。
R21 ✅ Insert 焦點修正 — commit `543f1c3`：
- focus 追蹤只接受 input/textarea，按鈕不再搶走插入目標；Vars 分頁新增列後點 Insert 會插到該列的 Value。
- 瀏覽器測試覆蓋此流程。
- 驗證：unit 142/142、typecheck 0 errors、build 成功、Bruno browser 3/3。
- 部署：artifact `a5af2dcc719dfda694f37d78ca707a95d845a012c341495401f1ca7dd809d1c7`（source `543f1c3`）；
  loader rev263 → app rev264，最終 Healthy/Synced。
R22 ✅ 23 個斷言端到端 + 上限提高到 50 — commit `d36adf0`：
- parser / schema / 編輯器 / exporter 的 assert 上限由 20 提高至 50（仍有大小與複雜度上限）。
- 新增 `tests/bruno-assertions.integration.test.ts`：本機 HTTP fixture 回傳 JSON， Bruno trial 一次驗證 status/responseTime/header/text/json/in/notIn/between/length/型別等 23 條全部通過，trial actual 有值。
- 驗證：unit 142/142（既有 21 條上限測試改 51）、typecheck 0 errors、build 成功、完整整合 99 pass / 1 skip。
- 部署：artifact `adc63e0c9c8e3bfc91ae64e44f7a89f2d27bad79f0eb1b9e63f9d64768775f53`（source `d36adf0`）；
  loader rev265 → app rev266，最終 Healthy/Synced。
R23 ✅ form-url-encoded body — commit `9f142d0`：
- parser 接受 `body:form-urlencoded`，以 `name: value` 行編輯，送出時轉成 URL-encoded 並自動帶 content-type；`{{var}}` 保留不編碼。
- unit round-trip + 端到端 fixture 驗證實際送出 `a=1&b=hello%20world` 與 content-type。
- 驗證：unit 143/143、typecheck 0 errors、build 成功、完整整合 99 pass / 1 skip。
- 部署：artifact `a2eaa3bdb121cbb456e2c8158231e68c8c0d8ccf53aed0daab1ad699f4b6df46`（source `9f142d0`）；
  loader rev267 → app rev268，最終 Healthy/Synced。
R24 ✅ 可讀的錯誤訊息 — commit `7876f7c`：
- 安全錯誤碼轉成英文說明（含 field），不再只顯示 `HTTP_BLOCK_REQUIRED` 之類的內部碼。
- 瀏覽器測試建立不含 HTTP block 的 monitor，驗證畫面出現 "A single GET/POST/… request block is required." 且不會進 UI 模式。
- 驗證：unit 143/143、typecheck 0 errors、build 成功、Bruno browser 4/4。
- 部署：artifact `7c95dfdcb8ae7bfc52faebf0c7812c329f083c10232b8bb9f60403fe026d4783`（source `7876f7c`）；
  loader rev269 → app rev270，Healthy/Synced。
R25 ✅ 轉換層健壯性測試（僅測試，不影響 runtime，故不重新部署） — commit `e153434`：
- `tests/bruno-editor-robustness.test.ts` 驗證 14 種畸形 model 與 5 種畸形 source 都只回安全錯誤碼、不拋例外、不洩漏 secret 值。
- 驗證：unit 145/145、typecheck 0 errors、build 成功；正式站仍為 R24 的 rev270。
R26 ✅ 瀏覽器覆蓋 Auth / Docs 分頁 — commit `2f3f04b`：
- 補 aria-label 讓自動化與鍵盤使用者可定位 Auth mode / Token / Docs；瀏覽器測試實際設定 bearer token 與 docs，Raw 驗證 `.bru` 內容。
- 驗證：unit 145/145、typecheck 0 errors、build 成功、Bruno browser 4/4。
- 部署：artifact `88fcf82dddee99ced0ff4bfe052038b0324b98cf5285cd81b62c176e84ffd38e`（source `2f3f04b`）；
  loader rev271 → app rev272，最終 Healthy/Synced。
R27 ✅ 50 個斷言的效能 guard（僅測試，不部署） — commit `91fd5ed`：
- 加入 50 條規則（含 20 條安全 regex、60 KB body）的效能測試，要求 <2 秒；實測約 11 ms。
- 驗證：unit 146/146、typecheck 0 errors。正式站仍為 R26 的 rev272。
R28 ✅ Reset 按鈕 — commit `b6c7ae2`：
- 一鍵還原到已儲存的 `.bru`，重新進入預設 UI；避免改壞後手動復原。
- 瀏覽器測試：空白 monitor → 填 URL → Raw → Reset → URL 回空。
- 驗證：unit 146/146、typecheck 0 errors、build 成功、Bruno browser 4/4。
- 部署：artifact `1b7b84fcc03b54be14be2587571794c91f0fdc429780217b3cc12a4026294f99`（source `b6c7ae2`）；
  loader rev273 → app rev274，最終 Healthy/Synced。
R29 ✅ 窄畫面表格 — commit `479835e`：
- 四個表格外層加 overflow-x-auto；390px 寬度瀏覽器測試驗證分頁與欄位可見，並存 /tmp/opencode/bruno-mobile.png。
- 驗證：unit 146/146、typecheck 0 errors、build 成功、Bruno browser 5/5。
- 部署：artifact `21d78c33c1e97a576e5c856579ca564dfbc066b35a372c5646f7f59bffb472c7`（source `479835e`）；
  loader rev275 → app rev276，最終 Healthy/Synced。
R30 ✅ Copy .bru — commit `ae771b8`：
- Raw 模式一鍵複製整份 .bru 到剪貼簿，顯示 Copied 回饋；失敗時提示手動複製。
- 瀏覽器測試授與 clipboard 權限後驗證內容與原始碼一致。
- 驗證：unit 146/146、typecheck 0 errors、build 成功、Bruno browser 5/5。
- 部署：artifact `2ce284d6cefcf37f389ab7e9468f4320b71d74889f390d35aa9cfa28274ca84f`（source `ae771b8`）；
  loader rev277 → app rev278，Healthy/Synced。
R31 ✅ Download .bru — commit `20e90d0`：
- Raw 模式可下載目前 .bru 檔，檔名取自 request name；瀏覽器測試驗證下載事件與 .bru 副檔名。
- 驗證：unit 146/146、typecheck 0 errors、build 成功、Bruno browser 5/5。
- 部署：artifact `6235133e9920fda148e6cf37c054e213460136ef55ec158f0de57bd3c7e67fb1`（source `20e90d0`）；
  loader rev279 → app rev280，最終 Healthy/Synced。
R32 ✅ 相容性文件更新（僅文件，不部署） — commit `87fd49d`：
- `docs/BRUNO_COMPATIBILITY.md` 補上 UI editor 各分頁、快捷鍵、operator 清單、path params/form body 與 API key 可見性。
R33 ✅ 完整回歸（驗證輪，不部署） — 無程式變更：
- unit 146/146、typecheck 0 errors、build 成功、完整整合 102 pass / 0 fail / 1 skip。
- 正式站仍為 R31 的 rev280（Healthy/Synced）；R32 文件與 R33 驗證不需要重新部署。
R34 ✅ 匯出支援所有 operator — commit `52fbf53`：
- `assertionPair()` 補上 13 個新 operator 的 Bruno token；否則匯出會寫出 `undefined`。
- 新增 31 種 operator 的匯出→解析→operator 還原測試。
- 驗證：unit 147/147、typecheck 0 errors、build 成功；完整整合 101 pass / 1 fail（既有 group drag flaky，單獨跑通過）。
- 部署：artifact `1ae7e119abe588bf2cc0f565aaad0ebb4dc2cc60e8e2e722773b0d39a7571391`（source `52fbf53`）；
  loader rev281 → app rev282，最終 Healthy/Synced。
R35 ✅ Bruno monitor 可匯出 — commit `8da6f2d`：
- `monitorToBru()` 對 type=bruno 直接輸出 stored `.bru`（owner-only download 本來就照存放值輸出），單檔與 collection ZIP 都納入。
- 新增 3 個 unit 測試：原文原樣、collection 收錄、空 body 安全拒絕。
- 驗證：unit 150/150、typecheck 0 errors、build 成功、Bruno 整合 8 pass / 1 skip；完整整合的 group drag 仍為既有 flaky。
- 部署：artifact `5ab8b523e889c6bb49580456fabc8f5c47df8e8910a0033a7fec14c1405b9f1a`（source `8da6f2d`）；
  loader rev283 → app rev284，最終 Healthy/Synced。
R36 ✅ 穩定 drag 整合測試（僅測試，不部署） — commit `d3ec9f6`：
- group drag 改用最多 3 次重試與新 boundingBox，消除常見的 flaky；兩次完整整合中一次全綠、一次剩 unrelated badges 時序 flaky（與 Bruno 無關）。
R37 ✅ Unsaved changes 提示 — commit `9cbf36f`：
- 任一欄位輸入即顯示 Unsaved changes，Reset 後清除；避免誤以為已存檔。
- 瀏覽器測試驗證提示出現與消失。
- 驗證：unit 150/150、typecheck 0 errors、build 成功、Bruno browser 5/5。
- 部署：artifact `e5f95b7195e2ba7e9c818a738fd96b14fdd3a9a3f1734ef6d834739f566d9aa1`（source `9cbf36f`）；
  loader rev285 → app rev286，最終 Healthy/Synced。
R38 ✅ Bruno 專用測試指令（僅工具，不部署） — commit `ccd0e66`：
- `npm run test:bruno` 跑 103 個 Bruno/assertion unit；`npm run test:bruno:integration` 跑 Bruno 相關整合（獨立 DB）。
R39 ✅ 審查發現修復（5 項） — commit `bccee14`：
1. `safe-pattern.ts` 改真正的 O(tokens·n) NFA 模擬並加 800 萬工作上限；64 個 `.*` 對 4KB 由約 700ms 降到 5ms。
2. `monitorEditorDTO(monitor,{includeBody})` 集中控制 Bruno source 可見性；writer API key 的 PUT/clone/pause 回應不再洩漏。
3. `sync()` 改送出 `serializableModel()`，空白新增列不再讓 Save 失敗。
4. `checkBruno` 改用 `monitor.acceptedStatuscodes`（原本永遠讀到 undefined）。
5. Bruno monitor 匯出時把 bearer/basic 與 auth-like header 的明文憑證轉成 secret placeholder。
- 驗證：unit 152/152、typecheck 0 errors、build 成功、Bruno browser 5/5、Bruno 整合全綠；完整整合 102 pass / 1 fail（unrelated badges flaky）。
- 部署：artifact `c2d0c252fb36322dc35fddc03b92ab0f04f3f3a68e4ef54e96a975fbd6b60405`（source `bccee14`）；
  loader rev287 → app rev288，最終 Healthy/Synced。
R40 ✅ Bruno 專用回歸（驗證輪，不部署） — `npm run test:bruno` 105/105、`npm run test:bruno:integration` 全綠（1 skip）。正式站仍為 rev288。
R41 ✅ 轉換 API 逾時 — commit `8a50387`：
- parse/stringify 請求加 10 秒 AbortSignal，避免 API 卡住讓編輯器永久 busy；Bruno browser 5/5。
- 部署：artifact `de2ad8d88d6de2d36d6661f91ffbe77c91fed723a6c1eaa9408757dba32efe89`（source `8a50387`）；
  loader rev289 → app rev290，最終 Healthy/Synced。
R42 ✅ DTO 可見性 unit 測試（僅測試，不部署） — commit `7d629bd`：確認 monitorEditorDTO 預設不回 body，只有 includeBody:true 才回。unit 153/153。
