# Bruno declarative subset

使用官方 `@usebruno/lang@0.41.0`，不執行 Bruno runner、CLI、JavaScript 或外部檔案。接受帶相對路徑的 .bru manifest；UI 可選 collection 資料夾、一或多個 .bru、ZIP（瀏覽器端解壓，伺服器仍只收 files[]）、貼上單一 request，或本平台匯出的 manifest JSON。OpenCollection YAML 尚未支援（第 2 期）。

2026-11-15 起（[深度整合 Spec](specs/2026-11-15-bruno-deep-integration.md) 第 1 期）：folder 對應工作區群組、script/tests 改為「匯入但標示」、匯出改為 Bruno 可直接開啟的 .bru／ZIP。

| 功能 | 本輪行為 |
| --- | --- |
| HTTP | GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS；每個 request 僅一個 HTTP block |
| headers/query | enabled entries；同層重複拒絕；內層覆蓋外層；query 以 URLSearchParams 正確編碼 |
| body | none / json / text / `form-url-encoded`（`name: value` 每行，送出時 URL-encoded）；JSON 在靜態展開後驗證 |
| auth | none/inherit/basic/bearer；request > folder > collection；明確none不啟用閒置credentials |
| variables | request > inner folder > source/target environment > collection；disabled忽略；循環/缺值拒絕 |
| secrets | source env secret placeholders需填值或重用target；owner才可改target；secret依賴不能降成普通variables |
| target values | 既有target值與顯式secret輸入是opaque literal，內含`{{...}}`不會再次當程式或變數解析 |
| assertions | res.status/res.responseTime/res.text/res.body property/index/res.headers property；eq/ne/neq/gt/gte/lt/lte/in/notIn/matches/notMatches/startsWith/endsWith/length/between/exists/notExists/isNull/isNotNull/isEmpty/isNotEmpty/isJson/isNumber/isString/isBoolean/isArray/isDefined/isUndefined/isTruthy/isFalsy；最多 50 條；expected 用 JSON literal；matches 用線性時間安全比對子集（無群組/alternation/backref/lookaround/{}） |
| scripts/tests | `script:pre-request`、`script:post-response`、`tests`、`vars:post-response` 可匯入但**永不執行**；非空內容記在 `bruno_sources.ignored_blocks`，監測頁顯示「Not executed」。collection/folder 層的 script 會標到其下所有 request。依賴 script 產生的變數仍會因缺變數而被擋 |
| settings | `settings { encodeUrl: true }`（Bruno 預設）靜默略過；其他設定值會被標示為 settings 未套用 |
| folders | 每個有 request 的資料夾（含祖先）成為群組；名稱取 folder.bru `meta.name`，否則資料夾名；`seq` 成為排序。collection 根依「Place in group」：新群組（bruno.json name）、不分組、或指定既有群組 |
| query | request 有 `params:query` 時以它為準並移除 URL 上的 query（Bruno 會兩邊都寫，舊版會重複送出） |
| path params | `params:path` 的 `:name` token 在送出前代入值；名稱必須符合 `^[A-Za-z_][A-Za-z0-9_]*$` 且出現在 URL |
| unsupported | app、extends、typed annotations、OAuth/digest/NTLM/mTLS、multipart/files/XML/GraphQL/gRPC/WebSocket、自訂methods/未知semantic欄位；script/tests 永不執行 |
| metadata | `docs {}` 可在编辑器的 Docs 分頁讀寫並保留原文；bruno.json僅name/version/type/ignore，其他行為設定拒絕 |
| limits | 4000 requests/4500 files/20MiB source/128KiB每檔；10秒parse budget，檔間yield，最多2份解析且同user1份 |

preview不寫DB、不發網路、不回URL/headers/body/secret值；只顯示mapping、method、rule數及明確errors。commit重解析原檔，HMAC綁user/workspace/environment、manifest、environment狀態與source monitor configVersion，鎖列重查後原子寫入。create拒已存在identity；skip保留原項目；replace只改同source identity並暫停。source identity包含workspace、target environment、collectionId、source environment與path；不以顯示名稱覆寫。

source environment變更與監測寫入同一transaction。Monitor request配置與secret vars均AES-GCM；owner session才能改target environment，editor可重用已配置的target值。所有匯入監測預設paused，沒有匯入即執行或自動外部請求。

**Bruno 匯出（2026-11-15）**：`GET /api/v1/bruno/download`，限 owner session。`ids=單一` 下載 .bru；多個 ids、`groupId`（含子群組）或 `all=1` 下載 ZIP（最多 1000 筆）。依 Bruno 慣例：request 內容照存放值輸出（保留 `{{變數}}`），群組成為資料夾（folder.bru 帶名稱與 seq），環境變數寫值、環境 secret 只寫名稱；request 內的明文憑證（bearer token、basic 密碼、Authorization/Cookie/X-Api-Key 等 header）改成新的 secret 變數並列入環境檔。間隔／timeout 等平台設定寫在 `docs` 區塊。非 HTTP 類型或 Bruno 表達不了的監測會略過，ZIP 旁附 `<名稱>-skipped.json`。由 `server/services/bruno/collection-export.ts` 使用官方 `jsonToBruV2`／`envJsonToBruV2`／`jsonToCollectionBru` 產生。

**Redacted manifest（原有）**：匯出限owner、最多20 monitors與200 secret placeholders，給工作區外的人用。僅支援能表示成該子集的HTTP設定；timeout必須30秒、redirect10、TLS verify開啟、無proxy/upsideDown；any多rule、多個legacy status ranges等拒絕。URL/body/auth/query與header values用secret placeholders，原值不下載；header名稱及assertion定義會包含。原先被basic auth覆蓋的Authorization header不另匯出。schedule/通知/tag等association不在.bru表示範圍。匯出manifest需重新填secret值才能匯入；不是保密備份還原格式。

錯誤只回path/field/safe code，官方parser可能附原行的exception不出API與log。單次超過budget回明確錯誤；4000筆本機fixture匯入已另記錄實測，不代表任意複雜度輸入皆在10秒完成。


## Bruno 風格編輯器（2026-11-26）

`/monitors/{id}/edit` 選擇 Bruno monitor 後，**預設進入 UI editor**（可隨時切回 `Raw (.bru)`）：

| 分頁 | 內容 |
| --- | --- |
| Params | query/path 類型切換、增刪列、Bulk Edit（`name: value` 每行，`~` 代表停用；無效列會提示行號） |
| Body | none / json / text / form-url-encoded |
| Headers / Auth / Vars | 表頭與 basic/bearer 憑證（預設遮罩）、pre-request vars（可 Bulk Edit）、環境變數清單（可篩選、超過 50 筆會提示）與插入 |
| Script / Tests / Settings | 可直接編輯保留的 block；worker 永不執行，存檔原樣保留 |
| Assert | Expr / Operator / Value / Description，完整安全 operator 下拉 |
| Docs | `docs {}` block 可讀寫 |

- 切換順序為 `UI editor | Raw (.bru)`；工具列顯示目前使用的環境名稱，parse/stringify 時顯示 `Converting…`。
- `{{` 在任何欄位會彈出環境變數自動完成；secret 只顯示 `••••••`；Vars 分頁可篩選變數名稱。
- Auth 的 Password / Token 預設遮罩，勾選 `Show credentials` 才會顯示明文。
- Bulk Edit 遇到不合格式的列會在畫面列出行號，不會靜默丟棄。
- Assert 分頁的 Value  placeholder 會隨 operator 變化（如 `between` → `200 299`），並有 Quick add 一鍵加入現成斷言。
- URL 不是 http(s) 時即時提示並擋下 Send（`{{變數}}` 開頭的 URL 仍可送）；JSON body 即時驗證且允許 `{{變數}}`；同名且啟用的 params/headers/vars 會出現重複警告。
- 空白請求在 UI 填完 URL 就能 Send（不必先切 Raw）；Ctrl/⌘+Enter 立即 Send；分頁可用 ← / → 切換。
- 結果面板顯示 status / elapsed / Headers / Body / Assertions（含 actual 與「N passed / M failed」摘要）。
- Raw 模式可 Copy / Download `.bru`，或 Reset 回到已儲存版本。
- Bruno monitor 可用於單檔與 ZIP 匯出，以及 redacted manifest；字面值會轉成 secret placeholder。
- 既有 `.bru` 原文只對互動式 editor+ session 可讀；API key 維持 write-only。
