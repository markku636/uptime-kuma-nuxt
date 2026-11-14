# Spec：宣告式 API 回應斷言

狀態：🔵 待實作。規劃：Astra。日期：2026-11-14。依 [總計畫](../API_PLATFORM_PLAN.md) 第2階段；先完成workspace principal及安全DTO基礎，再落此功能。程式實作限單一Sol。

## 行為契約

Monitor支援版本化 assertions JSON：version=1、mode=all/any、最多20 rules，rule含穩定id、source、path、operator與typed expected。sources為status/responseTime/header/text/json；operators為equals/notEquals/contains/notContains/gt/gte/lt/lte/exists/notExists/isNull/isNotNull。空rules視無新斷言，保留既有HTTP status預設；network/config/invalid JSON/oversize永遠失敗，不能被any某條成功掩蓋。時間為整個請求check耗時，不包含schedule等待。

JSON selector只接受root `$`、dot property、quoted property與非負index。不得eval/new Function、任意JSONPath filter、function、recursive descent、prototype keys。數字不隱式轉型，null與missing分開。任何新欄位在API與UI皆驗證，未知operator/source明確400。舊json-query也走此安全selector或對不支援格式明確錯誤。

HTTP共用request executor處理auth、environment interpolation、redirect、timeout、byte limit。總deadline覆蓋OAuth/TLS/DNS/redirect/body/retries；AbortSignal真正終止request。回應解壓後上限1MiB（可部署設定但有hard cap），request body與headers也有限制，keepalive池有上限；TLS資料有cache且只在需要時查。保留授權內網private-location用途，目的地policy不得一律禁止loopback而破壞fixture；禁metadata與不允許redirect。

新增試跑API必須editor權限、同workspace/env、有限concurrency/rate；與排程共用checker，不持久化完整response。回傳安全逐條結果與原因（redacted且truncated），structured field不可藏未遮罩actual/raw body。表單可新增刪除rules、選all/any與typed value，試跑可看到每條成功失敗。保存、重載、編輯、clone、匯出皆保持相同schema。

## 受影響檔案

- `prisma/schema.prisma`；新增`prisma/migrations/20261114020000_api_assertions/migration.sql`（若命名不同先更新本文）。
- 新增`shared/types/assertions.ts`、`server/utils/assertions.ts`、`server/services/monitor/checkers/http-request.ts`。
- `server/services/monitor/checkers/http-checker.ts`、`server/services/monitor/checkers/json-query-checker.ts`、`server/services/monitor/checkers/tls-checker.ts`、`server/services/monitor/checker.ts`、`server/services/monitor/scheduler.ts`、`server/utils/json-query.ts`、`server/utils/variables.ts`、`server/utils/serialize.ts`。
- `server/api/v1/monitors/index.post.ts`、`server/api/v1/monitors/[id].put.ts`、`server/api/v1/monitors/[id].get.ts`、`server/api/v1/monitors/[id]/clone.post.ts`；新增`server/api/v1/monitors/test.post.ts`、`server/api/v1/monitors/[id]/test.post.ts`（可只選一個，記錄實際API）。
- `components/monitor/MonitorForm.vue`；新增`components/monitor/AssertionEditor.vue`、`components/monitor/AssertionResults.vue`；`pages/monitors/[id]/index.vue`、`types/monitor.ts`、`types/heartbeat.ts`、`locales/en.json`、`locales/zh-TW.json`。
- `.env.example`、`package.json`、`package-lock.json`；新增`tests/assertions.test.ts`、`tests/assertions.integration.test.ts`、`tests/http-request.test.ts`、`tests/fixtures/http-server.ts`、`docs/validation/api-assertions.md`。

補充實際檔案：`server/api/v1/monitors/[id]/heartbeats.get.ts`、`server/api/v1/monitors/[id]/certificate.get.ts`、`server/utils/resource-crud.ts`（修Zod4 partial defaults意外重設既有欄位）、`server/utils/monitor-input.ts`、`server/utils/monitor-config.ts`、`server/middleware/00-body-limit.ts`、`pages/monitors/add.vue`、`pages/monitors/[id]/edit.vue`、`server/utils/backup.ts`。

HTTP status規則存在時以顯式status assertion取代legacy acceptedStatuscodes；未定義status assertion則保留legacy/default status gate。network/config/invalid JSON/oversize不受any或upsideDown反轉。診斷不回傳raw actual/expected/body/header值，只回穩定rule ID、source、operator、pass及安全reason code。

## 驗收

- [ ] HTTP 200且JSON wrong值會DOWN；同fixture修正後UP。status/header/text/JSON/time各有正反案例，all/any可見差異。
- [ ] null/missing/false/0/empty string/arrays/quoted dotted keys/case-insensitive headers有明確結果；expected型別錯誤不自動coerce。
- [ ] malicious selector、prototype、深度/長度超限、unknown operator拒絕，不執行任意JavaScript。
- [ ] 無效JSON、oversized body、gzip bomb、slow headers/drip、OAuth hang、redirect loop、DNS failure在總deadline內結束並釋放slot。
- [ ] 同workspace錯env/外部monitor/viewer不能試跑；輸出、logs、heartbeat不含sentinel secret。
- [ ] Browser建立→保存→重載→試跑→編輯流程；真正PG+local HTTP排程結果有驗證，不能只測pure evaluator。
- [ ] 舊http/keyword/json-query相容性有記錄，不支援舊expression明確列出。

此Spec不宣稱任意JavaScript test、任意regex或完整JSONPath相容；UI需精確呈現支援範圍。

## Astra 補充：既有 request credentials 與 redirect（2026-11-14）

本期將monitor的敏感request配置封裝至AES-GCM requestSecrets envelope（新增nullable Json/String欄位依實作選擇，migration命名先列明）。環境secret已有加密，不應讓legacy headers/basicAuthPass成為detail/export旁路。detail GET對viewer/editor/owner均不回既有secret；editor編輯用configured flags，省略欄位表示preserve，顯式clear表示刪除，不能把`********`作placeholder回寫。URL query、body、headers、authConfig都可能含secret，不只根據Authorization字樣判斷。UI可顯示安全URL摘要及非敏感設定。

新增受影響檔案：`server/utils/monitor-config.ts`、`server/utils/monitor-secrets.ts`、`server/plugins/00-security.ts`、`prisma/migrations/20261114020000_api_assertions/migration.sql`、`tests/monitor-secrets.test.ts`、`tests/monitor-secrets.integration.test.ts`。backfill須明確無APP_ENCRYPTION_KEY時fail-closed，保存密文後移除原欄位明文值；報告legacy已處理筆數但不含值。先以獨立DB驗證，正式遷移前備份。

安全界線：editor可配置要發送的URL與request，因此本輪把editor視為可使用workspace secrets的受信任操作者。加密與write-only減少直接回傳／靜態洩漏，無法阻止editor透過自有endpoint接收自己設定的已認證request。若需要對editor隱藏秘密的強隔離，另需owner核准secret binding／目的地policy，不能宣稱本輪已實現。

- [ ] 有認證monitor保存→GET不回secret→只改name→local HTTP仍收到正確auth；clear/replace各有fixture，不覆寫未變更secret。
- [ ] migration密文AAD綁正確monitor/workspace/env，搬移或篡改失敗；DB原欄位不留雙份明文。
- [ ] cross-origin redirect保留body的方法一律拒絕，避免PUT/PATCH/DELETE收到301/302仍把敏感body轉送；GET跨origin移除Authorization/Cookie/X-Api-Key等敏感headers。
- [ ] 303 HEAD仍維持HEAD；其餘依明確HTTP redirect規則變method/body，使用兩local servers斷言新host未收到敏感body。

## Astra 第三輪補充

實際security plugin名稱為`server/plugins/00-auth-security.ts`，列入本輪受影響檔案；共用bootstrap gate若抽出可新增`server/utils/security-bootstrap.ts`並改`server/plugins/00-database.ts`。HTTP request gate與背景scheduler都必須等同一個security bootstrap成功，不能API 503而排程已對外執行。

`dockerHost`可為含userinfo的URL，納入敏感request封存／DTO遮罩（或對含userinfo明確拒絕並清理legacy）。API PUT對numeric dockerHost也要驗同workspace，與POST一致。封存欄位擴充後，已存在requestSecrets的舊row若仍有新增敏感欄位明文，backfill也須處理；不能只掃requestSecrets=null。

clearSecrets與同欄位replacement不得有試跑／保存不同的優先序：建議共同schema明確拒絕衝突，或兩個入口使用同一merge helper。UI勾clear且又填新值時顯示錯誤或確定採一致契約。未支援的NTLM/mTLS/proxy等配置要在form/API提供清楚限制，避免保存成功後只顯示CONFIG_ERROR。

- [ ] 同payload同時clear與replace，在試跑與保存得到同一可預測結果或一致400；不同欄位clear+replace仍成功。
- [ ] Docker host的userinfo sentinel不在DB明文／DTO／backup，跨workspace dockerHost ID於POST/PUT都404。
- [ ] 已sealed row補封新敏感欄位的migration測試，以及security bootstrap失敗時zero outbound checks。

實際加密遷移：`prisma/migrations/20261114021000_request_secrets/migration.sql`；啟動門閘實際為`server/plugins/00-auth-security.ts`。requestSecrets AAD 綁 workspace/environment/monitor，editor 是可使用 workspace secrets 的受信任操作者，write-only 不代表可任改目的地的 editor 無法藉請求使用秘密。

補充變更：`server/utils/monitor-trial.ts`、`server/api/v1/monitors/[id]/pause.post.ts`、`server/api/v1/monitors/[id]/resume.post.ts`、`shared/types/assertions.ts`、`types/monitor.ts`、`tests/workspace.integration.test.ts`（push token 一次性 provisioning 契約）。

安全啟動共用門閘：新增 `server/utils/security-bootstrap.ts`，修改 `server/plugins/00-database.ts`、`.env.example`、`tests/migration.integration.test.ts`。清除與替換同欄時替換優先，試跑與保存共用相同 helper；Docker host URL 亦納入加密。

瀏覽器驗證路徑：`tests/assertion-browser.integration.test.ts`；用獨立 headless Chrome + local fixture，沒有 MCP 時明列。截圖只保存無秘密測試畫面。

安全 bootstrap 負例另更新 `tests/setup.integration.test.ts`：壞 envelope 造成非同步 backfill 失敗時 HTTP503 且 local fixture 零 outbound。

實測 Nitro request hook 會捕捉並吞掉 exception，不能作授權／安全門閘。新增 `server/middleware/00-auth-ready.ts` 真正阻擋 API；plugin只啟動及記錄bootstrap，不依賴request hook throw。
