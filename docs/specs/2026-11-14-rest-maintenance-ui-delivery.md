# Spec：REST 維護窗口、操作文件與介面收束

狀態：🔵 待實作。日期：2026-11-14。使用者新增明確要求：完整REST monitor／maintenance管理、改善介面、兩個網域供測試，清除本次實際存在的 owned 4000 fixture、保留 5 筆 demo（13:29 使用者已取消負載驗證）。本Spec補充phase5/6，不取代其workspace isolation、密文、lease與scale驗收。

## A：沿用真 REST handlers，修正維護窗口語意

canonical monitor API為`/api/v1/monitors`及`/:id`的GET/POST/PUT/DELETE，pause/resume沿現有POST子資源；canonical maintenance API為複數`/api/v1/maintenances`及`/:id`的GET/POST/PUT/DELETE與pause/resume POST。不新增第二套CRUD實作。現有單數`/api/v1/maintenance`管理alias可短相容，但UI與文件一律使用複數；單數下clear-history等資料維護功能不能混稱維護窗口API。

維護窗口是workspace資源，monitor仍是workspace+environment資源。API可關聯同workspace不同environment monitors；每個關聯ID都驗workspace，混入外部ID整個404且零partial write。UI選擇當前environment時不得刪除已存在其他environment關聯，GET回安全monitor id/name/environment metadata以顯示既有選項；新增選取可提供明確environment選擇或先限當前environment並清楚標示。使用者選定集合完整保留，包括超過200筆的已選值。

Environment-bound API key 另有較窄邊界：其 maintenance list/get 只可見所有既有 monitor 關聯均屬 key.environmentId 且沒有 status-page 關聯的資料；修改／pause／resume／delete 必須同時驗既有與更新後 monitor 集合，不能先移除 foreign-env 關聯再洗白修改。越界 single resource 或 mixed 關聯回404，list過濾掉不可見資料。空 monitor 集合且無 status-page 關聯可建立／保存為沒有監測影響的 draft；空集合絕不代表所有 monitors。Status page 是可跨environment且關聯可變的workspace資源，env-bound key 不允許操作已有或新增 status-page 關聯的maintenance，不能臨時推導頁內monitor剛好同env就授權。Workspace-wide API key 與 session 仍沿原workspace跨env契約；read key不能寫。更新／刪除的既有關聯驗證在 maintenance row lock 後重讀，與 proposed IDs驗證及monitor fencing同transaction。測試覆蓋 same-env、mixed-env、empty draft、status-page關聯與試圖移除foreign關聯的負例。

API回應保持現行`{ok,data}`、真實HTTP status，不把文件假定201當實作完成。PUT可維持現有partial-update語意但明寫，未傳關聯保留、傳空array清除；不能把未知的`monitors`欄位默默丟棄後顯示成功。新UI傳`monitorIds`／`statusPageIds`。舊alias若轉換body，僅在同一validation入口做明確相容映射。

### 維護時間的單一契約

使用純DB/time evaluation，禁止重新啟用每API Pod Cron副作用。允許注入`now`供測試，預設取得一次時間後沿同一判斷使用。start包含、end不包含，以`[start,end)`定義；active=false一律inactive。

- `manual`：active即maintenance，pause/resume明確切換；不要求時間欄位。
- `single`：新建與轉為此策略時必須有有效startDate/endDate，start<end，RFC3339 timestamp；未開始scheduled、窗口內maintenance、結束ended。不得無日期就永久maintenance。既有dateRange若支援遷移，明確解析為同一欄位，不能存了dateRange卻runtime完全忽略。
- `recurring-interval`：intervalDay正整數、有效anchor startDate與timezone、有效timeRange。計算當地起始日期與N天間隔，指定時間才開始；跨午夜窗口歸屬開始那天。禁止現有`* * * * *`把全天變維護。
- `recurring-weekday`／`recurring-day-of-month`：有效timezone、timeRange、非空且範圍正確的weekdays0–6或days1–31；若支援最後一天則只接受實際已實作的值，不能接受lastDay2–4後默默忽略。不存在的月日跳過。跨午夜同前。
- `cron`：以已使用Croner驗證expression與timezone，duration為**秒**（API／DB一致）。UI顯示分鐘可換算但提交須轉秒；例如30分鐘=1800。DST由選定timezone/Croner規則決定occurrence，duration按實際經過秒數。不要以locale文字解析日期。
- 含糊的`recurring`、`status-page`或其他未實作strategy對新寫入明確400，UI不提供；既有資料顯示unsupported並可編輯修正，不默默當永遠scheduled。

timeRange/weekdays/daysOfMonth建議API採typed arrays，DB舊JSON string欄由單一normalizer序列化；可接受舊JSON string相容但解析後必須驗相同schema。`HH:mm`以明確數字解析或已載正確plugin，不能依dayjs未載customParseFormat的無效date。timezone用IANA有效性驗證；無效timezone/dateRange/cron及過大資料400。修改時先merge既有設定再驗策略必要欄位，避免PATCH式PUT漏驗。

每次新增／修改／pause／resume／delete需保留既有monitor fencing，真worker在maintenance時產出status3且零外部HTTP；窗口結束後恢復正常check。關聯改動與fence同transaction，並發更新需鎖maintenance再重讀原關聯，不能用transaction外的過期集合漏掉正執行的monitor。排程狀態與UI timeslots共用同一純函式，不能從已停用的local jobs Map讀下一個時段。

### 已確認問題與測試

Astra直接呼叫真getMaintenanceStatus（無DB）重現：當前weekday/hour內仍scheduled，因`dayjs.utc('10:00','HH:mm')`無效；臨時載入customParseFormat後，interval策略在指定開始6小時外仍under-maintenance。`single`無日期也under-maintenance。這些必須有固定clock unit驗收。

真PG+HTTP lifecycle：owner/editor建立、讀取、修改標題/窗口/關聯、pause、resume、delete；viewer與read API key寫入403；write key可在自己的workspace執行，invalid/expired key401，外workspace／混foreign關聯404、零partial mutation。至少manual與single在真worker/local sink驗maintenance零HTTP及結束後恢復；recurrence以固定clock覆蓋窗口前／起點／終點／跨午夜／UTC與Asia/Taipei／一次DST切換。日期／cron無效400，重疊多窗口任一active即maintenance。

## B：可用的 API 文件與 OpenAPI

更新`/api/swagger-json`為權威現行契約，並讓`/api-docs`顯示同一文件；現有靜態文件的Get all monitors、success欄位、未驗201與舊auth不能保留誤導。列cookie session與`x-api-key`／`Authorization: Bearer`兩種key傳法（擇一）、`x-workspace-id`／`x-environment-id`選擇與key綁定邊界。API key僅限`/api/v1`，不能暗示可用來登入、管理platform或換workspace。

OpenAPI至少包含monitor CRUD/pause/resume、typed assertions與試跑、cursor list100/max200與history、summary/state/lookup、maintenance lifecycle與每strategy必要欄位、workspace/environment選擇與roles、Bruno preview/import/export的預設paused／unsupported scripts／preview conflict409。敏感欄位writeOnly、已儲存secret不回值、preserve/replace/clear需文件化；examples使用假token/佔位值，不載入真設定。

新增`docs/REST_API.md`，提供可複製curl lifecycle：建立monitor→試跑→pause/resume→建立single maintenance→修改/停用/刪除→讀cursor下一頁。shell只使用使用者自行設定的env變數，不把真key印出；JSON例與API實際payload一致。列401/403/404/400/409語意及owner/editor/viewer/read/write-key矩陣。

Swagger UI可保留既有固定版依賴載入，但載入失敗有明確error及JSON/Markdown文件連結，不空白。若bundled本機套件則pin版本並同步lock；不要順帶升級整套UI。頁面保留auth middleware，跨originTry it out只用目前host，不能把帶key的操作送到任意外部URL。驗證OpenAPI每個已列route/method確實存在，並以真HTTP上述lifecycle核對response schema，不要求憑空新增未實作功能來吻合舊文件。

## C：有限範圍的 UI 改善

改善dashboard、monitor list/detail、workspace/environment selector、Bruno頁與maintenance操作。沿用目前Nuxt UI/Tailwind、現有品牌色與深淺模式，收斂spacing、字級、表單標籤、按鈕主次與狀態色；不換UI框架、不加入與監測無關裝飾。

- dashboard頂部清楚顯示目前workspace/environment、總數與UP/DOWN/paused/stale/maintenance，server-side filter與100筆分頁位置固定；empty/error/loading可區分。即時heartbeat與current-state revision驅動狀態，新UP能清除stale；summary以有界節流refresh，不每heartbeat發一個N+1請求。
- list在窄螢幕轉卡片或合理wrap，名稱長字可斷行、狀態文字不單靠色彩。detail顯示安全request摘要、assertion結果、coverage/N/A、bounded歷史載入，秘密不可因視覺改善重新輸出。沒有history但有current state時仍顯示真目前狀態。
- workspace/environment selector在手機不擠出viewport，清楚標role及目前env。切scope保留已驗的reload/socket teardown，不混舊資料。
- Bruno提供清楚選檔→preview結果→import流程；blocking errors與warnings區分、預設paused可見；大preview不渲染4000個完整展開row，摘要＋bounded明細。secret值不回顯。
- Maintenance list/add/edit/detail共用一個有效form／DTO。現有add頁引用不存在`MaintenanceEdit`、edit使用不存在單數GET/PUT、Dialog用monitors與array格式不合schema，應全部接canonical plural API。viewer只見read view，write按鈕隱藏且API仍拒絕；成功後reload持久化關聯與策略。
- 所有互動有label、鍵盤focus、可操作的button disabled/loading與error文字；modal不超螢幕高度、可scroll、關閉後focus合理。避免小字／低對比及橫向整頁scroll。

瀏覽器驗收至少desktop1440×900、mobile390×844，截圖dashboard/list/detail/workspace/Bruno/maintenance before或最終證據；用真頁面資料走登入、換workspace/env、搜尋第201筆以後、翻頁/selector保存、Bruno preview/import、維護窗口CRUD、viewer負例。檢查console/runtime錯誤與橫向overflow，不以單張畫面代替流程。工具不是MCP就寫瀏覽器自動化。

## D：兩網域與測試資料收尾

目標`uptime.226network.com`及`uptime.markkulab.net`由root透過既有production FRP/DNS/TLS流程接隔離部署API NodePort。不要啟動舊lab frpc或改其他既有proxies。產品設定增加明確allowed origins清單（如`APP_ALLOWED_ORIGINS`），只接受合法http/https完整origin，不用`*`或任意hostname suffix；production例僅上述兩個https origins。

最終demo站與暫時負載環境分離：demo自己的namespace與PostgreSQL PVC必須持續保留，不能採emptyDir或在測試cleanup刪除。先安全完成初始admin setup、驗證再次setup被拒絕，才公開DNS/FRP；不把仍開放首次註冊的fresh testDB直接上網。admin/session/encryption秘密只透過Secret或安全交付機制，不寫報告／console。測試負載namespace/DB可清理，但精確allowlist不能包含已交付demo站。

Socket client預設連目前頁面origin，ticket仍同host取得，避免第二網域頁面偷偷連primary而遭origin拒絕或跨hostcookie混淆。server握手允許明確兩origin並保留ticket/session/member檢查；其他origin拒絕。主APP URL保留作canonical link需要，不能單憑Host header無條件擴大allowlist。兩網域各自登入、HTTPS證書、scoped REST、WebSocket connect/heartbeat、退出測試；host-only cookie不共享登入是可接受且應說明。

4000 負載驗證已取消；若先前存在 owned fixture，現在精確刪除，只保留**5筆明確demo monitors**。runner保存本次owned workspace/environment/monitor IDs，cleanup以精確ID＋scope及task標記核對，不用名稱模糊查詢或全表delete。先將fixture pause/fence並等inflight結束再刪，確認heartbeats/state/outbox/Bruno mappings按FK清理；不刪原有使用者monitor、workspace或secret。

demo可另建獨立demo workspace/environment，包含健康HTTP、assertion示例、明確paused示例等；若依賴將停止的fixture origin，交付前改為paused並說明，不留下4000個DOWN alerts。報告列實際刪除計數（若無則記 0／原隔離 DB 已清除，不能捏造刪除 4000）、remaining5 IDs/name/paused/active與不含secret的畫面。保留aggregate負載報告，不需要留下大量raw fixture資料才能證明曾跑。

## 受影響檔案

- `server/utils/resource-crud.ts`、`server/services/maintenance/scheduler.ts`、新增`server/utils/maintenance-input.ts`（或同目錄明確normalizer）、`shared/types/maintenance.ts`／`types/index.ts`。
- `server/api/v1/maintenances/index.{get,post}.ts`、`[id].{get,put,delete}.ts`、`[id]/{pause,resume}.post.ts`；現有單數`server/api/v1/maintenance/index.{get,post}.ts`／`[id].delete.ts`若保留alias共用handler。若新增單數GET/PUT相容檔，在此範圍明確批准但不另寫CRUD。
- `server/api/swagger-json.get.ts`、`pages/api-docs.vue`、可新增`server/utils/openapi.ts`、`docs/REST_API.md`、`docs/TESTING.md`與README文件入口；`package.json`／lock僅必要API-doc UI依賴。
- `assets/css/main.css`、`layouts/default.vue`、`pages/dashboard/index.vue`、`pages/monitors/index.vue`、`pages/monitors/[id]/index.vue`、`components/layout/WorkspaceSelector.vue`、`pages/settings/workspaces.vue`、`pages/settings/bruno.vue`。
- `pages/maintenance/{index,add}.vue`、`pages/maintenance/[id]/{index,edit}.vue`、`components/maintenance/{MaintenanceDialog,MaintenanceList}.vue`；可新增`components/maintenance/MaintenanceForm.vue`以統一入口；`components/status-page/MonitorSelector.vue`、`composables/useMonitorPicker.ts`僅必要safe選取整合。
- `composables/useMonitorPage.ts`、`stores/monitor.ts`／`composables/useMonitors.ts`與`components/monitor/MonitorPagination.vue`／`components/dashboard/{StatusBadge,MonitorListPanel,MonitorListItemSimple}.vue`，只與上述功能及現有phase5契約相關。
- `nuxt.config.ts`、`.env.example`、`server/services/socket.ts`、`plugins/socket.client.ts`、domain相關部署ConfigMap/README/runbook；實際DNS/FRP操作由root完成。
- 新增`tests/maintenance.test.ts`、`tests/maintenance.integration.test.ts`、`tests/rest-contract.integration.test.ts`與`tests/ui-delivery.integration.test.ts`（可整合現有Chrome helper）；必要修`tests/workspace.integration.test.ts`／`tests/cluster-socket.integration.test.ts`增加雙origin與安全負例。
- 既有 fixture ownership 記錄及必要 cleanup helper（不新增 benchmark runner），新增`docs/validation/rest-maintenance-ui.md`、`docs/validation/domain-delivery.md`與demo清理摘要；phase6負載結果保留原報告。

本Spec預期不新增產品table；若策略必要正規化須資料migration，先補具體table/欄位與legacy轉換/回復規則。所有時間／UI／OpenAPI變更由Sol單人實作，Astra僅規劃與審查。


## Root MCP 介面驗證（2026-11-14 12:45 台北附近）

環境：本機32512，Sol phase5 production build；工具為實際 cua MCP／IAB，使用既有 demo admin session。這是部分UI驗收，尚非maintenance新版或公開網域驗收。

| 步驟 | 預期 | 實際 | 結果／證據 |
| --- | --- | --- | --- |
| Bruno頁載入、workspace初始化 | 顯示正確target與editor操作 | hydration完成後API Platform Demo / demo，操作可用 | 通過 |
| 上傳一個無secret的JSON manifest | 顯示1個來源檔 | collection identity與1 source file顯示正確 | `root-mcp-bruno-before.jpg` |
| 點Preview import | 辨識HTTP與2條typed assertions，不直接建立監控 | 1 request / 1 create / 2 assertions；按鈕為Import paused monitors | `root-mcp-bruno-preview.jpg` |
| 換成包含tests區塊的負例，再Preview | 顯示unsupported且禁止import | `health.bru · UNSUPPORTED_BLOCK · tests`，Import按鈕disabled | `root-mcp-bruno-rejected.jpg` |
| 開無heartbeat的Demo HTTP詳情 | 回應時間無資料不冒稱0ms | Current與24h Avg均N/A；Uptime顯示N/A %（小型格式改善待辦） | `root-mcp-detail-na.jpg` |

上述圖片位於 `.data/validation-logs/`；Bruno正例畫面已在使用者對話顯示。新恢復tab的console error捕捉為空。舊tab在Sol受控build/restart期間停留ERR_CONNECTION_REFUSED，該tab的data-error URL被工具攔截，改用同一browser的新tab恢復；沒有繞過TLS或安全警告。這一輪沒有按Import，沒有新增或刪除monitor，也未宣稱已重驗完整Bruno import lifecycle（原自動化另有證據）。

手機 settings 外框補充：`pages/settings.vue` 在390px以有label的select切換子頁，完整sidebar僅lg以上顯示，避免nav占第一整屏。選單目前值須與實際route一致（含直接SSR載入profile），不得預設顯示首項Bruno。保留route與各子頁，不改權限。UI驗收同時量測document overflow與主form可見位置。

## Root MCP 補驗（2026-11-14 13:34 台北，新 maintenance build）

- 實際 MCP Browser 在 390×844 開啟設定：手機版已改為 Settings section 選單，Bruno 表單出現在主內容；DOM viewport 390、document scrollWidth 375，沒有橫向溢出。由選單切換 Workspaces 成功，初始載入不再錯顯 Saved。截圖 `.data/validation-logs/root-mcp-settings-mobile-after.jpg`，舊版對照 `root-mcp-settings-mobile-before.jpg`。
- 以既有 demo session 在 `/maintenance/add` 建立唯一 title `MCP verification — paused maintenance`，Enabled=false、timezone=Asia/Taipei、沒有關聯 monitors/status pages；成功轉到列表，顯示 inactive。重新 Edit 保留 title／timezone／停用狀態。
- 把 timezone 改為 `Invalid/Zone` 後提交，介面顯示 Invalid timezone 且留在編輯頁；改回 Asia/Taipei 後更新成功。截圖 `root-mcp-maintenance-created.jpg`、`root-mcp-maintenance-invalid.jpg`。
- 測試後以真登入＋workspace/environment scope 的 REST API 核對 ID 4 的 title、workspace、active=false，再刪除此唯一測試 maintenance；DELETE 200、GET 404。MCP reload 顯示 No maintenance windows scheduled；console error=[]。清理證據 `root-mcp-maintenance-cleanup.json`。沒有更動 5 隻示範監控。
- 使用者於 13:28 取消 4000 負載要求。Root 真 PG 唯讀盤點：本機 `uptime_kuma` 只有 workspace5/environment6 的 IDs 8353–8357、共5筆、全部 paused；該專用 PG 沒有其他暫存測試 DB。證據 `monitor-cleanup-audit.json`。此盤點不替代稍後 K8s demo 建立與清理驗證。

維護窗口 response DTO 使用同一純 public/time projection，timeRange/weekdays/daysOfMonth/dateRange回typed arrays，DB仍存相容JSON string；不把DB序列化格式當新REST contract。GET/POST/PUT保留safe selected monitor metadata，OpenAPI PUT的Update schema不繼承create required欄位（仍merge後驗完整策略）。
