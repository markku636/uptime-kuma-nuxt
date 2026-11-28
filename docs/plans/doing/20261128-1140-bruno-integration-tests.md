# Plan：Bruno 多 API 整合測試與報告

狀態：🔵 待核准（2026-11-28 11:40 CST）。撰寫前已查證程式與線上狀態，**尚未改任何程式**。

## 1. 目標與不做的事

**一句話目標**：在上傳一份 Bruno collection（多支 `.bru`）後，能按順序跑完多支 API、把前一步的回應值宣告式帶到下一步、逐筆驗證，並在站內看到可下載（JSON／CSV）的整合測試報告。

使用者已確認的選擇：

| 決策 | 選擇 |
| --- | --- |
| 測試來源 | **Bruno collection 直接建立**（不需先匯入成 monitor） |
| 跨步驟串值 | **需要，宣告式萃取**；不執行 Bruno script／tests |
| 觸發方式 | **先做手動執行**；排程留到後續 |
| 報告 | **站內報告頁 + JSON／CSV 下載** |

明確**不做**（本次範圍外）：

- 不執行 Bruno pre/post script、tests、`bru.setVar()`、JS 運算式；安全邊界與現行 Bruno 支援一致。
- 不把整合測試變成 monitor／排程；不進 worker 週期檢查、不算進 availability／SLA、不發通知。
- 不做 PDF／HTML 單檔報告、不對外分享報告連結。
- 不支援 OpenCollection YAML、ZIP 直接上傳到 server（沿用現行「瀏覽器解 ZIP、server 只收 files[]」）。
- 不改其他平台的 chart／secret／DB；不碰共用工作樹上其他 session 的 WIP。

## 2. 現況（查到的證據）

### Bruno 既有能力（可重用，不需重寫）

- Parser：`server/services/bruno/parser.ts:228` `parseBrunoManifest(manifest, targetValues, targetSecretNames)`，官方 `@usebruno/lang@0.41.0`；單一 request 的宣告式子集文件在 `docs/BRUNO_COMPATIBILITY.md`。
- `vars:post-response` **目前被剝離且只標示**，永不執行：`parser.ts:12,62-63`；editor 也原樣保留：`server/services/bruno/request-editor.ts:83-99`。測試 fixture 已有 `id: res.body.id` 形式（`tests/bruno-groups.test.ts:13-22`、`tests/bruno-request-editor.test.ts:71`），可作為宣告式萃取的語法起點。
- 單一 request 執行與斷言：`server/services/monitor/checkers/bruno-checker.ts:76-130`（`parseBrunoManifest` → `executeHttpRequest` → `evaluateAssertions`）。
- HTTP 安全 guard：`server/services/monitor/checkers/http-request.ts:44-48,163-188`（DNS/private IP/allowlist、origin 限制、body/timeout 上限）—整合測試必須走同一條，不能另寫 fetch。
- 斷言與 JSON 路徑：`shared/types/assertions.ts`（`AssertionRuleResult`）、`server/utils/assertions.ts:8` `parseSelector`、已有限制 50 條/request。
- 輸入與容量：`server/utils/bruno-input.ts`（Zod：4500 files/131072 bytes/file）、`server/services/bruno/guard.ts`（同時最多 2 份解析）。
- 前端收集檔案：`composables/useBruno.ts` 的 `readBrunoZip`（瀏覽器 DecompressionStream）；`components/monitor/BrunoImport.vue` 已有 folder/files/zip/paste/manifest 五種來源。
- 報告 UI 樣式可參考 `pages/reports.vue`（表格、CSV 匯出、formula injection 防護在 `csvCell()`）。

### 目前沒有的

- 沒有「測試流程／run／step」任何資料表（`prisma/schema.prisma` 只有 monitor 與 `bruno_sources`）。
- 沒有任何 endpoint 會順序執行多支 `.bru`，也沒有把 `vars:post-response` 轉成可用的執行期變數。
- `pages/reports.vue` 只做 monitor availability，與 API 功能測試無關。
- 線上目前 revision **372**、Healthy／Synced（artifact `d4bf96b8…`），兩域 `/login` 200；本次需新 migration，部署要照「loader → migration → app」三段。
- 目前工作樹 clean，`git log` 最新為 `d13e3a0`；共用工作樹上有另一條 session 曾同時迭代通知功能，因此本計劃的 commit 一律只 stage 自己的檔案。

## 3. 架構與關鍵決策

### 3.1 概念對應

| Bruno | 平台 | 處理 |
| --- | --- | --- |
| Collection | 一份 **BrunoTestSuite**（工作區＋環境內） | 包含有序 steps 與 secrets |
| Request（含 folder 路徑） | Suite 內一個 **step** | 依 `path` 排序；保留原始 `.bru` 存放於 step.source |
| `vars:post-response` | step 的 **extract 規則** | 只接受白名單表达式，執行期有效，不持久化值 |
| Environment vars/secrets | 沿用工作區環境變數 + suite 內加密 secrets | 不改 environment 表，避免側effect |

**拒絕的替代方案**：
- 用 monitor 充當 step：會汙染 availability、通知與排程，且 monitor 是平行排程、無法保證順序與資料串接。
- 把 collection 先匯入成 monitors 再總和：多了不必要 DB 列與 paused 監測，報告也無法對應原始 step。
- 允許 post-response script：等於在 server 上跑任意 JS，安全與成本都不划算，且與既有相容性承諾衝突。

### 3.2 資料模型（只加不刪，3 張表）

放在 `prisma/schema.prisma`，新 migration `prisma/migrations/20261128HHMMSS_bruno_integration_tests/migration.sql`：

- `bruno_test_suites`：`id, workspace_id, environment_id, collection_id, name, definition Json, test_secrets String?, source_fingerprint, created_by, created_at, updated_at`
  - `definition = {steps:[{path,name,method,source,extract:[{name,expression}]}], failFast, timeoutSec, variables, secretNames}`
  - `test_secrets`：用既有 `encryptSecret()`（`server/utils/variables.ts:8`）加密，context 採 `${workspaceId}:${environmentId}:bruno-test:${collectionId}`（suite 唯一鍵）。
  - `@@unique([workspace_id, environment_id, collection_id, name])`。
- `bruno_test_runs`：`id BigInt, workspace_id, suite_id, status (running|pass|fail|error), started_at, finished_at, triggered_by, summary Json`
  - partial unique index：`UNIQUE(suite_id) WHERE status='running'`，防止兩個 API pod 同時跑同一 suite。
  - 超過 10 分鐘仍 `running` 視為 stale，下次執行前先標 `error`。
- `bruno_test_steps`：`id BigInt, run_id, step_index, path, name, method, status, http_status, elapsed_ms, error_code, assertions Json, extracted_names String[]`
  - `@@unique([run_id, step_index])`；step 與 run 用 `ON DELETE CASCADE`。

`definition` 存原始 `.bru` 全文，上限沿用 128 KiB/step、最多 20 steps、總 source 2 MiB；這讓報告可重現，且不依賴 monitor。

### 3.3 宣告式萃取（關鍵安全設計）

新 service `server/services/bruno/test-variables.ts`：

- 讀取 `@usebruno/lang` 解析出的 `vars:post-response` pairs（`ast.vars.res`）。
- **只接受**以下 expression（大小寫敏感、無函數呼叫、無 `{{}}`、無運算子）：
  - `res.status`
  - `res.responseTime`
  - `res.headers.<header-name>`
  - `res.body` 或 `res.body.<json path>`（path 交給既有 `parseSelector` 驗證）
- 變數名 `^[A-Za-z_][A-Za-z0-9_]*$`，最多 32 個；單一值 ≤ 4096 bytes；重複名稱拒絕。
- 不符合者，preview 回 `UNSUPPORTED_EXTRACTION` 並指出 path，**不建立 suite**。
- 執行期值只存在於該次 run 的 memory variable overlay，優先順序：`extract > suite secrets > environment secrets > environment variables`；**不寫回環境、不寫入 DB、不進報告**。
- 若下一步的 `.bru` 參照不存在變數，parser 本身會回 `MISSING_VARIABLE`，step 標 `error`。

### 3.4 執行器

新 service `server/services/bruno/test-runner.ts`：

1. 建立 run row（`status=running`）→ 取得 DB 層單飛；失敗回 409。
2. 依序對每個 step：
   - `parseBrunoManifest({files:[{path,content:source}]}, resolvedValues, secretNames)`（重用現有 parser）。
   - `executeHttpRequest(config, start, signal)`（重用 SSRF guard、timeout、redirect 限制）。
   - `evaluateAssertions()`（重用現有 operator）；另外套用與 bruno-checker 相同的 accepted-status 規則。
   - 萃取變數到 overlay。
   - 寫入 step 結果（**不存 response body**；`assertions` 只存 ruleId/operator/passed/reason/截斷且去敏感的 actual）。
3. `failFast`（預設 true）時第一個失敗即停止，其餘 step 標 `skipped`；false 則繼續。
4. 全域上限：20 steps、單步 10s、整run 180s、單一回應 64 KiB（與 trial response 一致）、同時最多 1 run/suite、全站台最多 2 run 並行（比照 `withBrunoCapacity`）。
5. 結束時計算 summary 並把 run 改成 `pass|fail|error`；例外一律落 `error` 而非遺留 `running`。

### 3.5 API 與報告

| Method | Path | 用途／權限 |
| --- | --- | --- |
| POST | `/api/v1/bruno/tests/preview` | 解析 collection，回 steps/萃取規則/issues/digest；editor；不寫 DB、不發網路 |
| POST | `/api/v1/bruno/tests` | 以 preview digest 建立 suite；owner 才能提供新 secrets |
| GET | `/api/v1/bruno/tests` | 列表（名稱、steps 數、最後結果） |
| GET/PUT/DELETE | `/api/v1/bruno/tests/{id}` | 讀／改（名稱、failFast、timeout、萃取規則）／刪；editor，跨 workspace 404 |
| POST | `/api/v1/bruno/tests/{id}/run` | 手動觸發；editor；409 若已有 run |
| GET | `/api/v1/bruno/tests/{id}/runs` | run 歷史（最近 100） |
| GET | `/api/v1/bruno/tests/{id}/runs/{runId}` | 報告詳情 |
| GET | `/api/v1/bruno/tests/{id}/runs/{runId}/export?format=json\|csv` | 下載報告 |

報告內容：執行時間、總耗時、pass/fail/error 計數、每步 method/name/path、HTTP status、elapsed、assertions 摘要（N passed / M failed）、error code、萃取出的**變數名**（不存值）。CSV 沿用 `pages/reports.vue` 的 formula-injection 防護。

## 4. 分階段（每階段可獨立驗證）

**Phase 0｜Spike（不做 product code）**
- 用一支 fixture 確認 `@usebruno/lang` 對 `vars:post-response { token: res.body.token }` 的 AST 形狀；確認 `parseSelector` 可直接驗證 expression。
- 確認 partial unique index 在 Postgres 的語法與 prisma 相容；確認 `executeHttpRequest` 可在一般 API request context 呼叫。
- 產出：`docs/validation/20261128-bruno-tests-spike.md`。

**Phase 1｜資料模型 + CRUD/preview API**（可交子代理 A）
- 檔案：`prisma/schema.prisma`、新 migration、`server/api/v1/bruno/tests/*`、`server/services/bruno/test-suite.ts`、`server/utils/bruno-test-input.ts`、`server/utils/openapi.ts`。
- 完成標準：preview 可列 steps 與萃取規則、issues 清楚；建立/讀取/修改/刪除皆通过整合測試；owner/editor/viewer 權限正確。

**Phase 2｜執行器 + 報告 API**（可交子代理 B，需 Phase 1 的 schema 與 API contract 先凍結）
- 檔案：`server/services/bruno/test-runner.ts`、`server/services/bruno/test-variables.ts`、`server/api/v1/bruno/tests/[id]/run.post.ts`、`.../runs/*`、`tests/bruno-test-variables.test.ts`、`tests/bruno-test-runner.test.ts`、`tests/bruno-tests.integration.test.ts`。
- 完成標準：兩步流程（login 取 token → 帶 token 打第二名 API）由整合測試的本地 HTTP fixture 驗過；failFast、timeout、SSRF denied、並發 409、secret 不外洩都有測試。

**Phase 3｜UI**（可交子代理 C，與 Phase 2 平行，但要先固定 API contract）
- 檔案：`pages/bruno-tests/{index,new,[id]}.vue`、`components/bruno-test/*`、`layouts/default.vue`（desktop/mobile nav）。
- 完成標準：可貼/選 collection → preview → 建立 → 按 Run → 看 step 表與摘要 → 下載 JSON/CSV；手機版無水平溢位、無 console error。

**Phase 4｜收尾**
- 更新 `docs/BRUNO_COMPATIBILITY.md`、OpenAPI、`docs/plans/doing/20261128-1140-bruno-integration-tests.md` 的實作紀錄。
- 跑完整驗證並部署（見下）。

**平行建議**：A 與 C 可在 Phase 1 contract 凍結後同時進行；B 等 A 的 schema 落庫；文件與 CI 測試最後統一由規劃者驗收，不把子代理回報當證據。

## 5. 資料與部署

- **DB**：3 張新表、1 個 partial unique index，全部只加不刪；既有 monitor／bruno_sources 不改。回滾只需回上一版程式，資料表可保留。
- **Secret／環境變數**：不新增環境變數；suite secrets 用現有 `APP_ENCRYPTION_KEY` 加密，部署時確認該 secret 已存在（目前線上有）。
- **Chart**：不需改 Helm chart；沿用現有 artifact loader / migration / application 三段流程。
- **部署順序**：package artifact → loader job 成功 → migration job（套用新 migration，確認「All migrations have been successfully applied」）→ app values 換 sha + restartToken → 等 Healthy/Synced → 兩域 `/login` 200 + `/api/v1/bruno/tests` 可讀。
- 每次部署後手動 prune artifact releases 到 2 個，避免 DiskPressure 復發。

## 6. 驗證（每階段都要留證據）

| 項目 | 指令／檢查 |
| --- | --- |
| Prisma client | `npm run db:generate` |
| Build | `npm run build` |
| Unit | `npm test`（含新 `bruno-test-variables`／`runner` 測試） |
| Typecheck | `npm run typecheck`（0 error） |
| Integration | `TEST_PG_ADMIN_URL=... npm run test:integration` |
| Bruno 既有回歸 | `npm run verify:bruno`（避免新功能破壞單檔匯入） |
| 資安 | viewer 不能 run／create；跨 workspace id 回 404；報告 JSON/CSV 不含 token 值；`169.254.169.254` 目的回 `DESTINATION_DENIED` |
| 瀏覽器 | 建立 → Run → 報告 → 下載 JSON/CSV；console errors = 0；390px 手機版無 overflow |
| 上線 | revision 上升、Healthy/Synced、兩域 200、migration 無 pending |

## 7. 風險與待決

1. **萃取語法來源**：目前以 Bruno `vars:post-response` 的白名單子集實作，與 Bruno CLI 的 JS 語法**不完全等價**；是否要把 platform 專用規則寫進 `docs {}` 讓 collection 自帶說明？（建議：Phase 0 先確認 AST，若官方只給純文字 JS，就採 platform 專用 `docs` metadata，避免誤解。）
2. **報告保留天數**：建議 run/step 保留 90 天，超過由現有清理 job 或新 CronJob 處理；是否要可設定？（本次先固定 90 天。）
3. **actual 值去敏感**：建議只對非敏感來源存 actual（≤256 字），欄位名/header 名含 `token|secret|password|authorization|cookie|key` 時一律 `[redacted]`；若你要完整 actual 需另行確認。
4. **排程與通知**：本次不做；若之後要「每日跑並通知」，應另立 spec，避免把 run 混進 monitor notification outbox。
5. **與既有 Bruno import 的差異**：整合測試會「執行」`vars:post-response`（但仍不跑 script/tests），需在 `BRUNO_COMPATIBILITY.md` 明示，避免使用者以為一般的 Bruno monitor 也曾執行它。
6. **共用工作樹**：另一條 session 可能同時改檔；每個 commit 只 add 自己檔案，部署前先確認目前 GitOps values 的 sha 沒有被別人換掉。

## 8. 完成定義（DoD）

- 一支含 2 個以上 request 的 Bruno collection 能建立 suite、手動跑完、得到逐 step 報告。
- 前一步 `res.body.token` 能帶到下一步 Authorization，且報告中看不到 token 值。
- JSON／CSV 可下載，CSV 無公式注入。
- 上述所有驗證指令全綠，並完成一次正式站部署與線上使用者的真實 collection 驗收。
