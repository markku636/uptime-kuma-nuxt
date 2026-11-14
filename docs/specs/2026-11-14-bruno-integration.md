# Spec：Bruno 宣告式匯入與預覽

狀態：🔵 待實作。規劃：Astra。日期：2026-11-14。依 [總計畫](../API_PLATFORM_PLAN.md) 第3階段。先使用API assertions共用schema；程式由單一Sol實作。

## 輸入與相容性

首版宣稱「Bruno .bru 宣告式子集」，不宣稱完整Bruno runtime。接受帶relative path的file manifest（request .bru、collection.bru、folder.bru、environments/*.bru）；限制最多4000 requests、總輸入20MiB、單檔1MiB與path長度。拒絕absolute/traversal/duplicate paths、symlink/遠端URL。可先不用ZIP；若使用ZIP要另設解壓總量與entry cap。OpenCollection YAML明確列不支援，除非另加schema與fixtures後更新矩陣。

使用安全parser，不能透過執行Bruno CLI驗證。支援enabled HTTP URL/method/headers/query、raw JSON/text、basic/bearer、靜態變數及支援範圍內declarative assertions。優先序request > folder（內層優先） > environment > collection；disabled values不啟用。環境變數從使用者選擇的source environment映射目標Environment。使用者secret不出preview/export/validation errors。

拒絕任意pre/post scripts、tests blocks、require/import、runtime/prompt/process.env/dynamic variables、request chaining、unsupported auth/body/typed-variable format；未知semantic block也阻擋，不能忽略後顯示成功。允許文件註解等非執行metadata。`res.status`、`res.responseTime`、`res.body.foo[0]`、`res.headers['x']`轉成共用assertion AST；`res(...)`/calls/regex/filter若不支援則明確指出file/field，不執行。

## 流程與權限

UI選檔→選目標workspace/env→preview映射/缺變數/不支援項目→確認匯入。preview無DB寫入、無網路請求；editor可匯入monitors，建立／修改secret或環境權限遵守workspace policy，不能藉import繞過owner限制。commit重驗證同一manifest/hash，所有資料transaction原子寫入，全部monitors預設paused。source identity使用workspace+collection identity+path+environment；明確create/replace/skip，禁止只憑display name覆寫。

預覽token如採server保存需綁user/workspace/env與expiry；不可接受client提交已解析monitor就略過原檔驗證。若沒有token，commit直接重送manifest並完整解析即可。防4000筆單transaction timeout，預覽先驗上限，DB批次createMany但仍同一transaction；若未做到大匯入可先顯示較小明確限制，不假稱4000檔匯入已驗證。

匯出可在此輪完成支援子集的.bru manifest，永不含secret原文，unsupported features阻擋／報告，不靜默失真。重複匯入與同名request不覆蓋其他workspace/env。

## 受影響檔案

- 新增`server/services/bruno/parser.ts`、`server/services/bruno/importer.ts`、`server/services/bruno/exporter.ts`、`shared/types/bruno.ts`。
- 新增`server/api/v1/bruno/preview.post.ts`、`server/api/v1/bruno/import.post.ts`、`server/api/v1/bruno/export.get.ts`；如採`imports/bruno`路徑先同步本文。
- `prisma/schema.prisma`；新增`prisma/migrations/20261114030000_bruno_sources/migration.sql`（source identity storage必要時）。
- 新增`pages/settings/bruno.vue`、`components/monitor/BrunoImport.vue`；`pages/settings.vue`、`pages/settings/index.vue`、`pages/monitors/index.vue`（選實際navigation入口，不要求全改）。
- `server/utils/workspace.ts`、`server/utils/assertions.ts`、`server/utils/variables.ts`、`server/utils/serialize.ts`、`types/monitor.ts`、`.env.example`、`package.json`、`package-lock.json`。
- 新增`tests/bruno.test.ts`、`tests/bruno.integration.test.ts`、`tests/fixtures/bruno/**`、`docs/BRUNO_COMPATIBILITY.md`、`docs/validation/bruno-integration.md`。

## 驗收

- [ ] 至少一個真實格式collection含nested folder、兩env、headers/query/raw body/basic/bearer/disabled entry與declarative assertions，匯入後UI可編輯且local fixture試跑成功。
- [ ] collection/folder/env/request同名變數優先序正確；缺變數／process.env／runtime不能發出請求。
- [ ] scripts/tests/未知block/惡意path/超大manifest/unsupported assertions全部有具體錯誤；不能只warning然後丟失測試語意。
- [ ] preview前後DB數量不變；commit失敗全rollback；成功全部paused且零外部請求。
- [ ] same-name不同path、重複import、replace/skip、跨workspace/environment、viewer/read-key/editor-with-secrets等權限矩陣。
- [ ] export無secret；受支援subset export→preview→import語意相同；不支援項目可追查。
- [ ] 使用真正PG與HTTP API integration，另以browser驗證preview→import→monitor detail；無MCP時明列未經MCP。

## 實作細化

Pin官方`@usebruno/lang@0.41.0`，不執行CLI/JS。檔案上限4500、request4000、source總20MiB、單檔128KiB；同步官方parser每檔前後檢查10秒總budget並以setImmediate讓出event loop，最多同時2份解析。超過預算明確失敗，不宣稱所有4000檔任意複雜度必成功。raw top-level block掃描只補parser會合併/丟失的語意，不替代官方parser。所有settings/app/scripts/tests/response-vars/extends拒絕。

source environment的靜態/secret值需owner才可建立或修改目標environment；editor可用既有target環境做不改環境的request匯入。folder/request變數先套用，target/source environment參照保留成native `{{name}}`，collection fallback內聯。環境值本身先解析成純字串，循環與缺值拒絕。所有secret輸入只進AES envelope或環境密文；preview只回名稱、類型、method、configured資訊，不回URL/header/body或expected值。

preview/commit都完整重解析原manifest；HMAC digest綁user/workspace/env與原manifest，commit必須帶相同digest。digest不是已解析配置的授權token。source identity為workspace/environment/collectionId/sourceEnv/path；global create/replace/skip策略，replace只能命中該identity，強制paused。監測資料與source mapping、必要environment變更同一PG transaction；bulk reserve IDs、createMany分批，4000筆原子提交。

補充受影響：新增`server/services/bruno/guard.ts`、`server/utils/bruno-input.ts`、`shared/types/bruno-lang.d.ts`、`scripts/test-unit.mjs`；測試script區分unit與integration，integration併發1。

為保留query參數的環境變數與正確URL encoding，新增封存於requestSecrets內的虛擬`queryParams`陣列（不增加明文DB欄位）。共用`monitorDbInput`移除虛擬欄位後才寫Prisma；`resolveMonitorConfig`在變數解析後用URLSearchParams.append，避免秘密中的`&`或`#`改變查詢結構。受影響另含`server/utils/monitor-input.ts`、`server/utils/monitor-secrets.ts`、`server/utils/monitor-config.ts`、monitor create/update/clone/backup helpers及相關unit/integration tests。

## Astra 第四輪補充驗收

- collection vars 僅作 environment 之後的 fallback，不得先合併到 request/folder primary map。測試必須包含「沒有 request/folder override，但 collection 與 environment 同名」；只測四層都有值會遮住此錯誤。
- parser 必須知道既有 target secret 的分類；普通 environment 變數不可直接或間接依賴 secret 後把解密值寫到 plaintext variables。測 direct reference、兩層 alias、collection fallback reference、同名 secret 降級，以及合法 secret→secret 依賴。owner 匯入仍遵守 write-only secrets 契約，不能因 owner 可修改 secret 就放寬明文輸出。
- 既有平台 environment secret 的內容是 opaque 字串，不能因含 `{{...}}` 而重新解讀或令無關 request 匯入失敗。新匯入 Bruno 靜態定義可依明確規則解析，但需分清「既有 target literal」與「新 source expression」。
- preview digest 同時綁定命中的 monitor configVersion；commit 先以固定 ID 順序鎖 monitor rows，再重讀版本比對。預覽後手動編輯／pause／resume／其他匯入 replace，都使舊 digest 409，且整筆不寫。環境變更與 source mappings 仍在同一 transaction。
- UI workspace/environment 改變時清除舊 preview、完成狀態與秘密輸入，避免把前一目標的秘密誤帶到下一目標；API 即使收到舊 digest 仍拒絕。

本輪提前加入 `monitors.config_version`，供 preview 失效與下一階段 scheduler fencing 共用。受影響新增 `prisma/migrations/20261114031000_monitor_versions/migration.sql`，以及 monitor PUT/pause/resume/clone、Bruno replace；新增整數欄位預設 1，既有資料不重寫秘密，回復保留欄位。phase4 所有環境與監測 mutation 再統一 fence helper。

Astra第四輪負例：collection變數必須低於environment；secret分類與間接依賴須一路追蹤，禁止把target secret改名解析成普通variables（含同名降級）。replace preview將額外綁Monitor.configVersion；新增`prisma/migrations/20261114031000_monitor_versions/migration.sql`並在monitor PUT/pause/resume/import replacement自增，clone回到1。commit鎖定來源monitor後重查版本，以防預覽後人工編輯被舊匯入覆寫。

實際新增Chrome驗證：`tests/bruno-browser.integration.test.ts`，走directory→preview→paused import→共用edit試跑；CLI驗證不冒稱MCP。
