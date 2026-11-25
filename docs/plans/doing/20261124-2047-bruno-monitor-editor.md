# Bruno monitor 編輯器改造：Raw / UI 切換、全域環境變數、頁內 Send 測試

> 建立時間：2026-11-24 20:47 CST
> 目標站：`https://uptime.markkulab.net`（SSG/SPA 已可連線，登入後為 SealWatch；本計劃完成前不改程式）
> 狀態：🟢 實作中（2026-11-25 使用者核准完整改造，並確認 editor 可讀取既有 `.bru` 原文）
>
> 2026-11-25 完成實作與本機驗證（尚未部署正式站；部署需使用者授權）。
>
> 2026-11-25 補充決策：
> - 範圍照本計劃全數執行（Raw/UI、六個 tab、內嵌環境變數、Send 回應面板）。
> - 既有 Bruno monitor 的 `body` 透過 `monitorEditorDTO()` 回傳給非 viewer session（editor+），讓編輯器一進來就顯示原始 `.bru`；viewer 仍走 `monitorSummary()`，看不到 request 內容。
> - UI 停留在 UI 模式直接按 Save/Send 時，由 `BrunoRequestEditor.sync()` 先序列化回 `form.body`，避免存到舊原文。
> 參考：[Bruno 深度整合 Spec](../specs/2026-11-15-bruno-deep-integration.md)、[相容矩陣](../../BRUNO_COMPATIBILITY.md)、[實作紀錄](../../plans/doing/2026-11-22-uptime-iteration.md)

---

## 一、目標與不做的事

**一句話目標**：把 Bruno monitor 的編輯從「只有一個貼 `.bru` 的文字方塊」升級成 Bruno 風格的雙模式編輯器——可切換 Raw `.bru` 與 UI 元件（Params / Body / Headers / Auth / Vars / Assert），可在頁內完整新增改全域環境變數與 secret，可按下 Send 立即看到回應與 assert 結果。

**使用者已確認的決定（2026-11-24）**：

1. 「全部功能」＝ **Bruno 編輯器的全部 tab**（Params / Body / Headers / Auth / Vars / Assert）＋ Raw/UI 切換；**不做** collection/folder 管理頁。
2. 「整合測試」＝ **頁面上即刻測試請求**（Bruno Send 那顆），顯示 status、時間、headers、body、assert 通過/失敗；不是只補自動化測試程式碼（自動化測試仍要寫，作為交付證據）。
3. 「編輯環境變數」＝ **完整內嵌編輯器**，讀取全域（工作區＋該監測所屬環境）變數，可新增／修改／刪除變數與 secret，不用跳到 Settings → Workspaces。

**明確不做（範圍外）**：

- 不執行 Bruno 的 pre/post script、tests、post-response vars；既有政策是「匯入但標示、永不執行」，維持不變。
- 不改 Groups / Bruno Import / Bruno Export 的整體流程，不改 `bruno_sources` 的 source identity。
- 不支援 OpenCollection YAML、ZIP 直傳、collection/folder 管理、OAuth/digest/NTLM/mTLS、GraphQL/multipart/xml、scripts 執行。
- 不新增 DB migration、不新增 secret／環境變數、不改共用 chart／其他平台服務。
- 不影響非 Bruno 監測（HTTP / keyword / json-query / push 等）的現有表單與排程行為。

---

## 二、現況（查證事實與證據）

| 事實 | 證據 |
| --- | --- |
| Bruno monitor 的 `.bru` 原文存放在 `monitors.body`；檢查時把它包成單檔 manifest 交給既有 parser | `server/services/monitor/checkers/bruno-checker.ts:37-52` |
| 排程檢查前 `resolveMonitorConfig` 會用**該監測所屬環境**的全域 variables/secrets 展開 `body` 內的 `{{var}}` | `server/utils/monitor-config.ts:7-24` |
| 目前編輯頁只有一個 `<textarea v-model="form.body">`，沒有 UI 模式、沒有環境變數入口 | `components/monitor/MonitorForm.vue:81-93` |
| `handleSubmit()` 把 `data.body` 寫在 `showUrlField` 分支內；bruno 的 `showUrlField=false`，所以**目前 Bruno Trial 實際上送空 body**（要修正） | `components/monitor/MonitorForm.vue:1467-1503`、`1363-1365` |
| 既有 Trial 按鈕會打 `/api/v1/monitors/{id}/test` 或 `/api/v1/monitors/test`，但結果只顯示 `status / code / ping / assertionResults`，沒有回應 headers/body | `components/monitor/MonitorForm.vue:848-850,1661-1665`、`server/utils/monitor-trial.ts:10-27` |
| `checkBruno` 拿到 `executeHttpRequest` 的 `{status,headers,body,elapsed}` 後只取 status，其餘丟掉 | `server/services/monitor/checkers/bruno-checker.ts:56-64` |
| 官方 `@usebruno/lang@0.41.0` 已 pin；`bruToJsonV2` / `jsonToBruV2` / `envJsonToBruV2` 等可直接用，server 端已在用 | `package.json`、`docs/BRUNO_PARSER_REFERENCE.md:14-28`、`server/services/bruno/collection-export.ts:107,186` |
| parser 是 server-only 且已有完整安全檢查（block 白名單、重複 block、變數/Tokenize、安全錯誤碼、10s budget）；`parseBrunoManifest(manifest,targetValues,targetSecretNames)` 可接收全域值 | `server/services/bruno/parser.ts:201-289` |
| 全域環境變數 API：`GET /api/v1/workspaces/{id}/environments`（workspace 成員可讀，回 `variables` 與 `secretNames`，**不回 secret 值**）；`PUT .../environments/{envId}` 限 **owner**，且會 `fenceEnvironment()` 讓該環境所有 monitor `configVersion+1` 重新排程 | `server/api/v1/workspaces/[id]/environments/index.get.ts:1-5`、`[environmentId].put.ts:1-30`、`server/utils/monitor-mutation.ts:9-11`、`server/utils/variables.ts:21-24` |
| 現成安全預覽工具 `previewEnvironmentVariables()` 會把 secret 顯示成 `••••••` 並列 missing | `utils/variable-preview.ts:1-15` |
| 既有測試：unit `npm test`、integration `npm run test:integration`、Bruno browser test（Playwright + 本機 HTTP fixture） | `package.json:8-19`、`tests/bruno.test.ts`、`tests/bruno.integration.test.ts`、`tests/bruno-browser.integration.test.ts` |
| 工作樹目前 clean（本機 repo `uptime-iter-20261122`）；共用工作樹禁 `stash/reset --hard/clean` | `git status`（查證時無 modified/untracked） |

---

## 三、架構與關鍵決策

### 決策 1：canonical storage 仍然是 `.bru` 原文，不加 DB 欄位

UI 模式只是 `.bru` 的另一種檢視／編輯方式。保存到 `monitor.body` 的永遠是官方 `jsonToBruV2` 產生的 `.bru` 字串，排程器、匯出、匯入都不用改資料模型。好處：向後相容、回滾只要退程式；代價：UI ↔ raw 需要來回轉換，必須有嚴謹的 round-trip 測試。

### 決策 2：解析／序列化放在 server，采用既有 parser ＋官方 writer；不把 `@usebruno/lang` 搬進瀏覽器

- 新增 `shared/types/bruno.ts` 的中立 DTO `BrunoRequestModel`（與檔案格式無關）：

```ts
export interface BrunoRequestModel {
  name: string
  method: 'GET'|'HEAD'|'POST'|'PUT'|'PATCH'|'DELETE'|'OPTIONS'
  url: string                         // 保留 {{variable}}，不展開成值
  params: {name:string;value:string;enabled:boolean}[]
  headers: {name:string;value:string;enabled:boolean}[]
  auth: {mode:'none'|'inherit'|'basic'|'bearer';username?:string;password?:string;token?:string}
  body: {mode:'none'|'json'|'text';content:string}
  vars: {name:string;value:string;enabled:boolean}[]   // vars:pre-request
  assertions: {expression:string;operator:string;expected?:unknown;enabled:boolean}[]
  ignoredBlocks: string[]             // script / tests / post-response vars 等
}
```

- 新增 `server/services/bruno/request-editor.ts`：
  - `sourceToModel(source, environmentId)`：用 monitor 所屬環境的全域值（server 端解密）呼叫既有 `parseBrunoManifest({files:[{path:'request.bru',content:source}],...})`；把 `parsed.requests[0].config` 映射到 DTO。`config.url/headers/body` 已由 parser 的 `retain` 保留 `{{var}}`，bearer 要從 `headers.authorization` 轉回 `auth.token`，避免 writer 再產生 `AMBIGUOUS_AUTH`。
  - `modelToSource(model)`：組 official AST → `brunoLang.jsonToBruV2()` → **再 parse 一次驗證** → 回 `.bru`；URL 上有 query 且 `params` 也存在時，照 `collection-export.ts:86-90` 的 Bruno 慣例處理，避免重複 query。
  - 既有 parser 的 `buildRequest()`（`parser.ts:143-189`）目前沒有把 `vars:pre-request` 放進 result；在 `BrunoRequest` 加**選填** `vars` 欄位（`{name,value,enabled}[]`），只收靜態安全值，既有呼叫端不受影響。
  - 錯誤只回 `{file,code,field}` 安全碼，不回官方 parser 訊息（可能含原始 token 行）。
- 新增兩個 API（`requireWorkspace(event,'editor')`，`environmentId` 必須屬於 current workspace）：
  - `POST /api/v1/bruno/request/parse` → `{model, issues}`
  - `POST /api/v1/bruno/request/stringify` → `{source, issues}`
- **放棄的選項**：前端直接 `import '@usebruno/lang'`（CJS＋dotenv/lodash/ohm-js，瀏覽器 bundle 可行性未驗證，且會把 parser 邏輯複製兩份）；手寫 `.bru` serializer（日後 Bruno 改版會漂移）。

### 決策 3：UI 模式照 Bruno 分頁，DataSource 只有一份

新增 `components/monitor/BrunoRequestEditor.vue`：

- Props：`modelValue`（`.bru` 字串）、`environmentId`、`disabled`、`trialResult`、`trialLoading`、`trialError`；Emits：`update:modelValue`、`send`、`insertVariable`。
- 頂端 segmented toggle：`Raw (.bru)` ↔ `UI editor`。既有監測預設 **Raw**，避免一進來就做有損轉換；切換選擇只存在元件 state，不持久化。
- Raw → UI：打 parse API。若 `ignoredBlocks` 非空，顯示明確警告「這些 block 不會被執行，切到 UI 後儲存會被移除」，要按「仍然切換」才進 UI（保留 raw 字串直到真的 save）。
- UI → Raw：打 stringify API，把結果寫回 `form.body`；任何 issue 都阻止切換並顯示安全錯誤碼。
- UI 分頁對應（畫面用現有 `input-field` / `select-field` / `section-card`，英文文案與目前 MonitorForm 一致）：

| Bruno tab | 欄位 | DTO | 序列化目標 block |
| --- | --- | --- | --- |
| Request 資訊列 | Name / Method / URL（含 `{{var}}` 預覽） | `name/method/url` | `meta`、`get/post/...` |
| Params | Name / Value / Enabled（＋型別固定 query） | `params` | `params:query` |
| Body | none / json / text＋內容 | `body` | `body:json` / `body:text` |
| Headers | Name / Value / Enabled | `headers` | `headers` |
| Auth | none / basic / bearer | `auth` | `auth:basic` / `auth:bearer` |
| Vars | request 層 pre-request vars＋全域變數入口 | `vars`＋環境變數API | `vars:pre-request` |
| Assert | Expression / Operator / Value / Description（沿用 `MonitorAssertionResults` 的運算子集合） | `assertions` | `assert` |

- `MonitorForm.vue` 改動：把 81-93 行的 textarea 換成 `<BrunoRequestEditor v-model="form.body" .../>`；`handleSubmit()` 把 `data.body = form.body` 移到 bruno 也適用的位置（修決策現況的 bug）；bruno 不送 `data.assertions`（assert 在 `.bru` 裡）。
- 不新增 i18n key；此頁目前是英文硬編碼，新 UI 也用英文。

### 決策 4：內嵌環境變數編輯器直接讀寫「全域」變數（單一來源）

- 新增 `composables/useEnvironmentVariables.ts`：封裝 `GET /api/v1/workspaces/{workspaceId}/environments`、owner 的 `PUT .../environments/{envId}`、新增/刪除 secret（`secrets:{name:null}`）、與 `pages/settings/workspaces.vue:153-176` 相同的 key 驗證（200 個上限、byte 上限）、`previewEnvironmentVariables()` 的 secret 遮罩。
- 新增 `components/monitor/EnvironmentVariablesDialog.vue`：
  - 從 `props.environmentId`（監測所屬環境；若無則退回目前 workspace environment）讀取**該環境**的全域變數；顯示環境名稱，讓使用者清楚改的是全域而非 monitor 自己的副本。
  - 表格形式的 key/value 增刪改＋「Edit JSON directly」切換（與 Settings 頁一致）；secret 只顯示名稱＋`••••••`，值为 write-only；新增/刪除走同一個 PUT。
  - owner 才能存；editor/viewer 唯讀並顯示「Workspace owner required」，附 Settings → Workspaces 連結。
  - 每列有 `={{NAME}}` / 插入 `{{NAME}}` 動作，emit `insertVariable('{{NAME}}')` 給 editor 放進最後聚焦的輸入框。
  - 存檔成功明確提示「此環境的監測將重新排程」（PUT 會 fence 所有 monitor）。
- 重構 `pages/settings/workspaces.vue:97-185` 改吃同一個 composable（行為不變），避免兩份驗證邏輯漂移。這是本計劃唯一會碰到 Settings 頁的改動，需 regressions 測試。

### 決策 5：Send＝強化既有 Trial，不另建執行路徑

- `handleSubmit(true)` 已有 rate limit、SSRF guard、destination allowlist、共享 checker，延用它；`BrunoRequestEditor` 的 Send 只 emit `send`，由 MonitorForm 呼叫同一個 function。
- 在 `CheckResult`（`server/services/monitor/checker.ts:16-25`）加選填 `response?: {status:number;headers:Record<string,string>;body:string;elapsed:number}`。
- `checkBruno` 只在 monitor 帶 `includeTrialResponse===true` 時把 `executeHttpRequest` 的回Details 放進 result；**排程檢查永不帶此旗標**，heartbeat/notification 不寫入回應內容。
- body 限制：最多 64 KiB 且只取文字（先截斷、標示 truncated）；header 最多 50 個、單一 value 最多 4 KiB；避免把敏感回應整包帶到瀏覽器。
- 兩個 trial endpoint 都要能處理 bruno：`/api/v1/monitors/[id]/test` 已 resolve env（`[id]/test.post.ts:11-12`）；`/api/v1/monitors/test` 要補上 `resolveMonitorConfig({...body,workspaceId,environmentId})`，否則新監測的 `{{var}}` 不會展開。
- 結果面板：`status / elapsed / code`，Headers、Body（JSON 可讀化）、Assertions 三個子分頁；沿用既有 10 次/分、8 並行、全域 8 個 trial 上限，不為 Send 開特權。

### 決策 6：有損轉換要「先警告、後丟棄」

Raw 裡的 `script:*` / `tests` / `vars:post-response` / 非預設 `settings` 會被 parser 標成 `ignoredBlocks`。UI 模式只編輯支援的子集；從 UI 序列化回去時這些 block 消失。做法：進 UI 前明確警告、監測詳細頁既有的「Not executed」標示維持、round-trip 測試要覆蓋「有 ignored block 的 raw 進 UI 再回 raw」的預期行為。

---

## 四、分階段交付（可平行）

| 階段 | 內容 | 可交給子代理 | 完成標準 |
| --- | --- | --- | --- |
| 0. Baseline | 記錄目前 `npm test` / `npm run build` / `npm run typecheck` 的通過數與既有錯誤數；截圖目前 `/monitors/{id}/edit` 的 Bruno 區塊；確認 `initialData.environmentId` 有出現在 GET monitor DTO | 否 | 有 baseline 數字，之後能區分新錯與舊錯 |
| 1. Server 转换层＋API | `shared/types/bruno.ts`、`server/services/bruno/request-editor.ts`、`parser.ts` 選填 `vars`、`server/api/v1/bruno/request/{parse,stringify}.post.ts` | ✅ A（不碰 UI） | unit round-trip 全綠；API integration 通過；不影響既有 import/export 測試 |
| 2. 環境變數 composable＋dialog | `composables/useEnvironmentVariables.ts`、`components/monitor/EnvironmentVariablesDialog.vue`、`pages/settings/workspaces.vue` 重構 | ✅ B（不碰 server bruno / MonitorForm） | owner 可改、editor 唯讀、secret 不回值、Settings 頁既有流程沒壞 |
| 3. Send 回應 | `checker.ts`、`bruno-checker.ts`、`monitor-trial.ts`、兩個 `test.post.ts` | ✅ C（和 A/B 檔案不重疊） | 排程檢查結果形狀不變；trial 回傳 response 且有大小上限 |
| 4. UI 整合 | `components/monitor/BrunoRequestEditor.vue`、`MonitorForm.vue` 改動、串接 A/B/C 的輸出 | 否（依赖前三階段） | Raw↔UI 來回不失真；Send 面板顯示 status/headers/body/assert |
| 5. 測試與交付 | `tests/bruno-request-editor.test.ts`、`tests/bruno-editor.integration.test.ts`、`tests/bruno-editor-browser.integration.test.ts`、build/baseline 比對、截圖 | 測試可拆給 D，但需等 4 完成 | 見第六節；**build 成功、部署成功、使用者流程通過分開列證據** |

平行安全性：A 碰 `server/services/bruno/**` + `server/api/v1/bruno/**` + `shared/types/bruno.ts`；B 碰 `composables/**` + `components/monitor/EnvironmentVariablesDialog.vue` + `pages/settings/workspaces.vue`；C 碰 `server/services/monitor/**` + `server/utils/monitor-trial.ts` + `server/api/v1/monitors/**/test.post.ts`。三者檔案不重疊，可同時進行；第 4 階段才把它們接起來。子代理只拿到自己那份說明，需自足規格（目標、檔案、完成標準、禁區）。

---

## 五、資料與部署

- **DB schema**：無新增 table／欄位／migration。既有 `monitors.body`、`environments.variables/secrets` 直接沿用。回滾：退程式即可，資料不需回滾。
- **Secret／環境變數**：無新增。Env dialog 寫入的是既有 workspace environment secret（AES envelope，`APP_ENCRYPTION_KEY`），值永不回傳。
- **副作用**：owner 在 dialog 存變數 → `fenceEnvironment()` → 該環境所有 monitor `configVersion+1` 並重排程。要在 UI 講清楚，且 Send 測試若在存變數後立刻按，需重新載入 monitor 版本避免舊值。
- **API 權限**：parse/stringify/Tial 都要 `requireWorkspace('editor')`；env 寫入沿用既有 owner-only PUT；跨 workspace 的 `environmentId` 一律 404/400，不能利用 id 猜測讀別人變數。
- **部署**：無 chart／values 變動。依既有 GitOps 流程（lab `uptime-api-demo-20261114/uptime-api` → migration loader → application）出新 artifact；**部署前取得使用者授權**（沿用迭代plan的規則），部署後在 `https://uptime.markkulab.net/monitors/{id}/edit` 用真實 Bruno monitor 驗證，並回報 commit／rev／Pod Healthy 狀態。不影響其他平台、共用 chart 與 secret。

---

## 六、驗證（每階段怎麼證明完成）

1. **Unit（logical）**：`npm test` 新增 `tests/bruno-request-editor.test.ts`，至少覆蓋
   - 六個 tab 全部欄位的 `.bru → model → .bru → model` round-trip 相等；
   - `{{var}}` 不被展開、secret 名稱保留但值不出現在 model/API response；
   - basic/bearer 互斥與 `AMBIGUOUS_AUTH` 不再發生；
   - query params 不重複、body json/text、所有 assert 運算子；
   - script/tests/post-response vars 被標 `ignoredBlocks`；重複 HTTP block、unknown block、超長來源回安全錯誤碼。
2. **API integration（DB＋HTTP）**：`npm run test:integration` 新增 `tests/bruno-editor.integration.test.ts`，驗證 parse/stringify 權限與跨 workspace 隔離、env 值由 monitor 的環境而來、owner 改全域變數後 configVersion fence、editor 只能讀、trial 不寫 heartbeat、trial response 截斷與 rate limit。
3. **Browser integration（真實畫面）**：新增 `tests/bruno-editor-browser.integration.test.ts`，用現有 `tests/helpers/http.ts` 登入＋本機 fixture HTTP server：
   - 建立 Bruno monitor → 貼 `.bru` → 切 UI editor → 改 URL/header/assert → 切回 Raw 確認 `.bru` 內容；
   - 點「Edit environment variables」→ 以 owner 新增變數與 secret → 插入 `{{NAME}}` → 儲存 → 重新整理還在；
   - 按 Send → 檢查 status / elapsed / headers / body / Assertions 面板；secret 輸入框在截圖中 mask；
   - 走 `/settings/bruno` 與 `/settings/workspaces` 回歸，確認既有 import/export 與變數頁沒壞。
   - 這是 **CLI＋Playwright 驗證**，不冒稱 MCP 驗證（本機沒有 v-terminal MCP 可用性保證）。
4. **Build／型別**：`npm run build` 必須成功；`npm run typecheck` 先記 baseline，新增檔案不得增加錯誤數（此 repo 既有大量 typecheck 錯誤，不能要求清零）。
5. **正式站人工驗收（部署授權後）**：真實 Bruno monitor 的 Edit 頁可切模式、env dialog 讀到該環境變數、Send 有回應面板；HTTP monitor 編輯頁與 Settings 頁無視覺/功能 regression；console 無新錯誤。

---

## 七、風險與待決

| # | 風險／待決 | 建議 |
| --- | --- | --- |
| R1 | UI 序列化會丟掉 `ignoredBlocks`（script/tests/settings） | 決策 6 的警告＋保留 raw 到真正 save；若你要「完全無損」，需改成分块保留而不是官方 writer 重寫，工時明顯增加——**請確認目前取捨可接受** |
| R2 | Send 回應可能含敏感資料（body/headers、甚至 secret 明文） | 限 64 KiB 文字、header 上限、只給 editor+、不進 heartbeat；**請確認 editor（非 owner）是否可見 response body**，若不行就改成 owner-only |
| R3 | `{{var}}` 在 Raw 模式看起來像字串，實際值在執行時才展開 | Vars tab 與 URL 旁沿用 `previewEnvironmentVariables()` 顯示遮罩後結果與 missing 清單；secret 只顯示 `••••••` |
| R4 | env dialog 的 PUT 會 fence 整個環境的 monitor | UI 明確提示；dialog 存完重新 load monitor 再 Send，避免拿舊 configVersion |
| R5 | `parseBrunoManifest` 需要環境值才能解析 `{{var}}`，若環境有 secret 值，server 解密後只用於驗證，不可回傳 | 測試要斷言 response 沒有 secret 值；解析錯誤不能帶官方 exception 原文 |
| R6 | `@usebruno/lang` 官方 AST 的 `vars:pre-request` 在新 DTO 是選填；Bruno 改版可能變形 | 升版時以 round-trip fixtures 驗證，不直接更版號 |
| R7 | 目前 `initialData.environmentId` 是否存在於 GET monitor DTO 尚未完全確認（Prisma 有此欄位，DTO 未明確列出） | Phase 0 先查證；若被 DTO 濾掉，改由監測頁把 `monitor.environmentId` 明確帶入 form props |
| R8 | 共用工作樹與部署授權 | 只 commit 自己改的檔；不 stash/reset --hard/clean；部署前先問使用者 |

---

**核准後才進實作**；實作依 `project-development` 流程，子代理分工按 fourth section 的 A/B/C 邊界拆，回來後由規劃者親自看 diff 與測試結果，不把回報當證據。

---

## 八、實作與驗證紀錄（2026-11-25）

### 交付檔案

- Server：`server/services/bruno/request-editor.ts`、`server/api/v1/bruno/request/{parse,stringify}.post.ts`、
  `server/services/monitor/checkers/bruno-checker.ts`（`clampTrialResponse()`）、`server/services/monitor/checker.ts`、
  `server/utils/monitor-trial.ts`、`server/api/v1/monitors/test.post.ts`、`server/utils/monitor-secrets.ts`、
  `shared/types/bruno.ts`。
- UI：`components/monitor/BrunoRequestEditor.vue`、`components/monitor/EnvironmentVariablesDialog.vue`、
  `components/monitor/MonitorForm.vue`、`composables/useEnvironmentVariables.ts`、`pages/settings/workspaces.vue`。
- 測試：`tests/bruno-request-editor.test.ts`、`tests/bruno-trial-response.test.ts`、
  `tests/environment-variables.test.ts`、`tests/bruno-editor.integration.test.ts`、
  `tests/bruno-editor-browser.integration.test.ts`。

### 驗證證據（baseline → 完成）

| 項目 | Baseline | 完成後 |
| --- | --- | --- |
| `npm test` | 61/61 | **77/77 pass, 0 fail** |
| `npm run typecheck` | 0 errors | **0 errors** |
| `npm run build` | 成功 | **成功**（33.4 MB output） |
| `npm run test:integration`（`TEST_PG_ADMIN_URL=postgresql://uptime@127.0.0.1:55464/postgres`） | 未量測 | **93 pass / 0 fail / 1 skip（scale）** |

新增瀏覽器整合測試實際走過：既有 `.bru` 原文顯示 → Raw→UI → 加 param/header → Vars 內嵌 dialog 存全域變數 →
Assert tab → UI→Raw → Send 顯示 status 200 → Save → reload 後原文保留。
API 整合測試驗證 parse/stringify 的 editor 權限、跨 workspace 環境擋下、secret 值不出現在 response、安全錯誤碼。

### 修正的既有回歸

- Raw 模式輸入原本沒有回寫 `form.body`，導致「新增 Bruno monitor → Send」送空 body；已加 `rawSource` watch。
- 新 monitor trial 原先因 `resolveMonitorConfig()` 對未知變數拋錯而回 500；改為 fallback 給 checker 回 `CONFIG_ERROR`。

### 待辦

- 部署正式站前取得使用者授權；依既有 GitOps 流程出 artifact，部署後在 `https://uptime.markkulab.net/monitors/61/edit`
  以真實 Bruno monitor 驗證 Raw/UI、環境變數 dialog 與 Send 面板。

### 部署紀錄（2026-11-25 20:57 CST）

- 本機 commit：`a080216`（`iterate/uptime-20261122`，20 檔、+1915/-43）。本機 git 沒有 GitHub 憑證，不 push；正式站以 immutable artifact 為準。
- Artifact：`88677a197030f3400acb781c75af5ff588252d4059fdaca5e047f64dabbdf804`
  （203,739,179 bytes；sourceCommit `a080216`、workingTree 無 dirty、node v20.20.0）。
- GitOps：`uptime-api-demo-20261114/uptime-api` values-lab.yaml
  loader commit `3e4cd18`（rev221，Job `uptime-artifact-88677a197030-1` Succeeded，
  短命 artifact server 已立即停止）→ app commit `245db70`（rev222，API 2/2、worker 2/2、
  fixture 1/1 Healthy，Synced）。本次無 schema 변更，migration 保持 disabled。
- 正式站人工驗證：瀏覽器到 `https://uptime.markkulab.net/monitors/61/edit` 被導向登入頁，
  需要使用者本人登入後才能確認 Raw/UI 分頁、環境變數 dialog 與 Send 面板；此項目尚待使用者接手確認，
  不冒稱已完成 UI 驗收。
