# API 監測平台迭代計畫

日期：2026-11-14。規劃：Astra；程式實作：單一 Sol agent。來源快照：`896c4575f22bf58119b85792b929b6ecb30a1bbd`。本文件是待實作與驗收的計畫，並非完成報告。

## 目標與設計決策

讓現有 Nuxt／Prisma／PostgreSQL 系統能管理 4,000 個 API monitor，驗證回應內容、從 Bruno 匯入、隔離多 workspace 與環境，並以 Kubernetes 多 worker 執行。K8s 首版範圍是部署及執行本平台，不含 Kubernetes 資源探索或取代 Prometheus。

保留 PostgreSQL 作為唯一排程真實來源；不因加入 cluster 就強制新增 Redis。分開 API 與 worker 角色，移除每個 monitor 各自 setInterval 的排程核心。多環境以每個 monitor 綁定一個 environment 表達，同一 request 可明確複製到其他環境；不暗中將一次排程展開成所有環境。

## 官方能力參考

- UptimeRobot 支援 status、header、JSON、raw body 斷言與 AND／OR。借鏡其表單式條件和明確失敗原因，而非複製完整付費產品。[官方文件](https://help.uptimerobot.com/en/articles/13628553-uptimerobot-api-monitoring)
- Checkly 提供請求試跑、環境變數與敏感值遮罩；本平台的試跑應呼叫同一個 production checker，顯示逐條結果。[官方文件](https://www.checklyhq.com/docs/detect/synthetic-monitoring/api-checks/configuration/)
- Bruno declarative assertions 與 JavaScript tests 是不同能力；不能因能解析 .bru 就宣稱能執行其測試腳本。[Assertions](https://docs.usebruno.com/testing/tests/assertions)
- Bruno 現在推薦 OpenCollection YAML，同時保留 .bru。首版明確標示「Bruno .bru 宣告式子集」；YAML 與 typed variables 必須有獨立 fixture 才能宣稱支援。[格式文件](https://docs.usebruno.com/bru-lang/overview)、[變數優先序](https://docs.usebruno.com/variables/overview)
- PostgreSQL `FOR UPDATE SKIP LOCKED` 適合多個 consumer 競爭工作列；它不提供外部 HTTP 呼叫 exactly-once 保證。[PostgreSQL 16 SELECT](https://www.postgresql.org/docs/16/sql-select.html)
- Socket.IO 多節點必須處理跨 server 訊息轉送，使用 polling 時還須 session affinity；單純多開 pod 不能保證所有 UI 都收到 heartbeat。[官方文件](https://socket.io/docs/v4/using-multiple-nodes/)

## 已確認的現況缺口

1. `server/services/monitor/scheduler.ts` 每個 monitor 立即執行並建立 setInterval，沒有跨節點 lease、同 monitor in-flight guard 或全域並行上限；retry 可能跨越下一次 interval。
2. `server/api/v1/monitors/index.get.ts` 取全部 monitors，且每筆附 50 heartbeats；4,000 monitors 即可能返回 200,000 heartbeats。Prisma 物件直接展開亦可能洩漏認證欄位。
3. `server/services/socket.ts` 實際初始化路徑仍將連線指定為 mock user 1，global monitors room 無會員隔離。`server/services/socket/index.ts` 另有第二套不完整驗證；必須統一入口。
4. API key middleware 查 `expiresAt`，schema 欄位卻為 `expires`；後續 middleware 與 handlers 仍要求 cookie session。REST 與 socket 的授權不能各自定義。
5. JSONPath checker 未限制 expression 能力；JSON query 錯誤訊息會包含 actual value。舊有 HTTP checker 無回應大小上限，HTTPS 每次額外取 TLS 資訊。
6. raw heartbeat 預設保留 180 天，cleanup 一次 deleteMany；無 rollup。舊文件的「已完成」百分比不作為驗收證據。

## 實作順序與交付閘門

| 階段 | 交付 | 完成條件 |
| --- | --- | --- |
| 0 基線與認證 | 可重現安裝、schema drift 清理、真正 session/API key principal、socket 驗證 | build／Prisma validation；兩個使用者的 REST/socket 防越權整合測試；未登入不能讀寫私人資源 |
| 1 Workspace／環境 | membership、角色、環境、secret、既有資料遷移、所有入口隔離 | 兩 workspace、兩 user、viewer/editor/owner 矩陣；UI 切換不殘留舊資料；關聯 ID 不能跨 workspace |
| 2 API assertions | 型別化規則、表單、CRUD、試跑、排程、明確失敗原因 | UI 建立並重載成功；HTTP 200 但 JSON 不符合會 DOWN；所有受支援運算子有正反案例 |
| 3 Bruno | preview、欄位映射、環境選擇、批次 paused import、相容矩陣 | 官方風格 fixture、明確拒絕 scripts、未知 block、缺變數；失敗不留下半套資料；匯入後可編輯與試跑 |
| 4 分散排程 | atomic claims、lease/fencing、角色拆分、並行上限、通知 outbox | 2 worker 同時 claim 無重複有效結果；crash/timeout/lease loss/config update/pause 測試 |
| 5 規模與操作 | cursor 列表、batch latest state、聚合統計、retention、跨 pod 更新 | UI 不下載全資料；DB 查詢數不隨單頁 monitor 數線性增加；刪除有 batch 上限；斷線可重新同步 |
| 6 K8s 與 4,000 驗證 | manifests、runbook、負載工具、量測報告 | 真實本機兩 worker + PG；可用時 kind/K8s smoke；4000 monitors 實際排程報告；未執行的檢查明確列出 |

## Workspace、環境、授權

模型：Workspace、WorkspaceMember(workspaceId,userId,role)、Environment(workspaceId,name,variables)、Monitor(workspaceId,environmentId)、workspace scoped ApiKey。Owner 管會員／secret，editor 管監測設定，viewer 只能讀；節點與系統全域設定限 platform admin，不能讓任一 workspace owner 修改整個 cluster。

遷移為每位既有 user 建立 personal workspace 及 default environment，將其 Monitor、Notification、Tag、Proxy、DockerHost、RemoteBrowser、Maintenance、StatusPage、ApiKey 歸入該 workspace，保留既有 userId 作建立者資訊。無 user 關聯的 global Setting 明確列為平台設定，不偽裝成 workspace 設定。

API principal 為唯一來源，cookie session 或有效 API key 均可形成 principal；workspace 由 route/header 指定並查 membership，不能信任 body 的 userId/workspaceId。所有讀、寫、bulk、clone、import/export、test、heartbeat、uptime、certificate、badge、RSS、status page、socket 路徑及關聯驗證都納入 audit。關聯 join 應由複合 FK 或服務層 transaction 驗證同 workspace；猜測不存在與別人 ID 都給 404。

公開 status page 只讀 published 頁面明確選入的 monitor 安全投影，不輸出 URL、headers、secret、完整 assertion actual value。API key 限 workspace 與 read/write scope，stored hash，新 key 只顯示一次；過期、停用或 membership 變更立即拒絕。

Socket handshake 使用真正 session，驗證 origin；每個 subscription 及 mutation 驗證權限，不接受 client 自報 user ID。採 workspace 與 monitor scoped rooms；切換時清空 Pinia/cache、退出舊 rooms，會員撤銷時斷線或重新鑑權。舊 socket mutation 必須轉入同一服務或明確停用，不能留下旁路。

secret 在 DB 以 authenticated encryption envelope 儲存，key 來自部署 secret；read API 僅傳名稱與是否已設定。headers/token/basic auth/環境 secrets 不出現在列表、export、logs、heartbeat failure。未知或遺失 variable 必須中止檢查，不能保留 `{{name}}` 直接打到目標。

## API 回應斷言

使用版本化 JSON AST：`{ version:1, mode:'all'|'any', rules:[{id,source,path?,operator,expected?}] }`。sources：status、responseTime、header、text、json；operators 初版：equals/notEquals/contains/notContains/gt/gte/lt/lte/exists/notExists/isNull/isNotNull。數字不做字串隱式轉型；null 與不存在分開；header 不分大小寫；AND／OR 只作用在規則，network/invalid JSON/config error 不能被另一條成功規則掩蓋。

採自寫小型安全 path tokenizer 或套件的明確 non-eval 模式；初版 JSON path 只接受 `$`、dot property、quoted bracket property、非負 array index。拒絕 filters、function calls、recursive descent、script expression、prototype keys。預設最多 20 rules、path 長 256、body 1 MiB、JSON 深度 64；值大小與整體 schema 都有上限。regex 若沒有 RE2 等安全引擎則先拒絕，不能直接 new RegExp 任意使用者輸入。

既有 json-query 也必須移入同一安全解析器或顯式拒絕超出子集，不讓新增安全入口旁邊保留任意舊 expression。UI 逐條新增／移除、選來源／運算子／型別值、all/any；儲存、試跑與 scheduled checker 共用驗證器。result 包含 rule ID、pass、reason、有限且遮罩的 expected/actual；不要預設儲存完整 body。HTTP client 有 max redirects、timeout、最大解壓後 body、keepalive 與 cancellation。

試跑與 scheduled request 共用 egress policy。系統須允許明確設定的內網 API，但阻擋 metadata/link-local 與未允許目的地，redirect/DNS resolution 也重新檢查；不能用禁止所有 private IP 的策略破壞內網監控需求。受信任管理員可設定 private-location 的目的地範圍，本機 fixture 的 loopback 也應在測試環境明確允許。

每次 check 有跨 DNS／TLS／OAuth token／redirect／body download／retry 的總 deadline，不能只設定各個 axios timeout。OAuth 也必須帶 cancellation 與時間上限。TLS 到期資訊僅需要時取得並 cache，避免每次 HTTPS 額外握手；cache 上限與失效時間可設定。加入 slow headers、持續 drip body、解壓後超大 body、OAuth 卡住及 redirect chain fixtures，確認會 abort、釋放 concurrency slot 且不越過有效 lease。

## Bruno 邊界

首版匯入檔案清單（path+content），可支援 .bru request、collection.bru、folder.bru、environments/*.bru；若採 archive，限制 entry 數、解壓大小且拒絕 traversal/symlink。使用官方 parser 做語法解析可以，但不啟動 Bruno CLI 或任何 runtime。

支援 HTTP method/URL、enabled headers/query、raw JSON/text body、basic/bearer、靜態 collection/folder/request/environment variables 及可映射宣告式 assertions。遵守 request > folder > environment > collection 靜態優先序；不讀 host process.env，拒絕 runtime/prompt/dynamic variables、request chaining、JavaScript tests、pre/post scripts、外部檔案／模組、unsupported auth。`res.status`、`res.body.foo[0]`、`res.headers['x']`、`res.responseTime` 可映射；任意 `res(...)` 或 JS expression 不執行。

preview 顯示每個檔案會建立什麼 monitor/environment、warnings、blocking errors、變數缺漏及不支援功能；有 blocking error 不可 commit。commit 重驗證同一 manifest/hash，整批 transaction、預設 paused，避免匯入立即對 production 發出 POST。以 workspace+collection source path+environment identity 支援可預期重複匯入，明確 create/replace/skip；不依 name 靜默覆寫。匯出限支援子集、secret placeholders、無失真回合測試。OpenCollection YAML 可於後續增加，未完成前 UI 必須明確標示不支援。

## 分散排程與資料面

建議 MonitorSchedule 記錄 nextRunAt、scheduledFor、leaseOwner、leaseUntil、fence(version)、configVersion；DB 時間為準。worker 依空閒容量，以單一 transaction `FOR UPDATE SKIP LOCKED LIMIT batch` claim due jobs，更新 lease/fence，立即釋放 DB lock，再執行 network；不在 HTTP 期間持有 transaction。

同一 monitor 僅一個有效 lease；claim 必須有硬 batch 上限。lease 需涵蓋有效 timeout/retry budget 並 heartbeat renew；續租失敗即 abort。completion transaction 再檢查 owner、fence、leaseUntil、configVersion、active；只有匹配者可寫 heartbeat、latest summary、下一次時間與 notification outbox。run 唯一鍵 `(monitorId,scheduledFor)` 防重複結果；舊 worker 不得覆蓋新結果。pause/delete/config update 使舊 fence 失效。

採 jitter 分散 4,000 monitors；重啟不瞬間執行全部，不補跑每個錯過週期。嚴格限制 worker global concurrency、per host concurrency、queue length、retry count、總 timeout 及 DB pool。重試需 jitter/backoff；非冪等 HTTP 重試須明確設定。外部 HTTP 不能保證 exactly-once；lease 過期重領可能重送，產品與文件須如此說明。

outbox 與結果同 transaction，唯一事件鍵避免同一 transition 多次 enqueue；sender 自己 lease、可重試。第三方通知若沒有 idempotency API，crash 後重送不能宣稱 exactly-once。跨 API pod fanout 可用 PostgreSQL NOTIFY 作失效提示，再讀有權限的 DB state；通知丟失不影響結果正確性，client reconnect 用 cursor 同步。也可採正式 Socket.IO PG adapter，但必須測跨 pod 的實際連線。

API cursor pagination 預設 100、最多 200，穩定排序含 ID，search/environment/status/tag 都在 DB 篩選；list 只拿安全摘要及 latest state，不附 50 heartbeats。詳情另有 bounded history API；summary 是全 workspace aggregate，不可把單頁統計當全局。更新推送批次化，慢 client 合併狀態並設 queue cap。

4,000 × 每分鐘一次 = 66.67 checks/s；每天 5,760,000 raw results。平均 1 秒需約 67 並行，平均 10 秒需約 667，必須依實測 sizing。raw 預設短期保留（建議 7 天，可設定），hourly/daily rollup 長期保存；rollup 依狀態持續時間計算 uptime，不以不等頻次簡單計數。cleanup 使用有時間索引的 bounded batches，單一 maintenance lease；不能一次刪除數千萬筆。

## K8s 交付

同 image 以 APP_ROLE=api|worker|all 分工，cluster 使用分開 Deployments；Pod UID 作唯一 workerId。API 無排程，worker 無外部管理入口。提供 Secret/ConfigMap、Service、Ingress 範例、requests/limits、startup/readiness/liveness、PDB、terminationGracePeriodSeconds、non-root securityContext、migration Job。DB migration 只跑一次，不讓每個 replica 自行 db push。readiness 可檢查 DB 與 worker loop，liveness 不因短 DB outage 無限重啟。

SIGTERM 停止 claims，維持/安全結束既有租約，在期限內完成或取消；timeout 留待 lease expire，不能在仍有 in-flight request 時立即釋放租約。K8s HPA 只擴 API／worker；worker sizing 以 queue lag、utilization 為依據。PostgreSQL HA、備份、連線池為部署前提，不能因有多 worker 就宣稱整體無單點。

## 驗收與證據

1. 自動測試：typed assertions／malicious paths／oversized response；Bruno parser fixture／scripts rejection／variable precedence；role/resource matrix；lease race／stale commit／pause race／outbox dedupe。
2. DB 整合：新安裝與既有 schema 資料遷移；兩個 workspace 的 REST、socket、import/export、public endpoint 越權；真正 PostgreSQL transaction，不只 mock。
3. Browser：登入、建 workspace/env、建 API monitor、試跑、編輯重載、Bruno preview/import、跨 workspace 切換、viewer 按鈕與 server 拒絕。若無 MCP，只能記為瀏覽器自動化，不能寫 MCP 驗證通過。
4. Load：seed 4,000 monitors 對本機受控 fixture，60 秒 interval，warmup 2 分鐘 + steady 10 分鐘；記錄實際硬體／版本／body大小／延遲分布／concurrency／DB pool。建議基線 fixture：95% 100ms、4% 1s、1% timeout；另跑慢回應及 1 MiB 上限壓力，不替外部網站做壓測。
5. 量測：due/claimed/completed/failed/expired、schedule lag p50/p95/p99、throughput、max in-flight、duplicate accepted results、HTTP count、API p95、RSS/event-loop lag、DB query time/pool wait。穩態目標完成率 ≥99% due checks、schedule lag p95 <5秒、單頁 API p95 <500ms；均為指定硬體 fixture 的驗收目標，未實測不得當宣稱。
6. 故障：2 worker 啟動，kill 一個、延遲舊結果、DB 暫斷、滾動重啟；有效結果不重複、stale result 被拒、lease expiry 後恢復。K8s 如只有 manifests 靜態驗證，報告必須直說尚未實際部署。

## 變更策略

第 5 階段依 [分頁、聚合與保留詳細 Spec](specs/2026-11-14-scale-read-retention.md)：5A同步API/UI/pickers/current state，5B先驗證時間加權rollup再啟retention，5C量測busy-origin claim/defer成本。歷史clear/retention不得破壞current state或TLS通知去重；不能把現有duration方向錯誤永久寫入rollup。

第 3 與第 4 階段之間加入 [共用資源 secrets 修復](specs/2026-11-14-resource-secrets.md)：notification/proxy/docker-host/remote-browser 的安全 DTO、憑證封存與保留／替換編輯，先收束同 workspace viewer 可讀原始設定的缺口，再接通知 outbox。

第 4 階段的實際開工依 [分散式排程詳細 Spec](specs/2026-11-14-distributed-scheduler.md)，分 4A lease/configVersion/fenced completion、4B bounded notification outbox、4C role/fanout/resync。queue 欄位可放 monitor 同一 row 或獨立 schedule；以下 table 名稱是語意模型，最終 SQL 以各 Spec 為準。worker 身分另加 process instance UUID，避免同名 Pod restart 沿用租約身分。

依序完成各階段，保留實際驗收紀錄。第 0 階段先讀 [Baseline/Auth Spec](specs/2026-11-14-baseline-auth.md)，其餘階段由 Sol 在改程式前建立自己的 🔵 Spec，列明實際受影響檔案。不要一次改完所有檔案才找錯；遇到既有型別問題先建立 baseline 清單，修必要路徑，不能以關閉 type check 掩蓋新增錯誤。

## DB 異動影響清單與回滾

以下為預計模型／table，最終實際 SQL 及 row counts 必須由每階段 migration 報告補齊；不以 `db push` 覆蓋既有 production schema。

| 類別 | 影響 tables | 遷移與驗證 |
| --- | --- | --- |
| 認證基線 | `users`、`api_keys` | 先修程式使用正確 `expires`；若加 key hash/role/token version，採 nullable 新欄位與 backfill，保留舊 key read 相容窗口；不讓未指定角色的舊 user 全變 admin |
| Workspace | 新增 `workspaces`、`workspace_members`、`environments`、`environment_variables`（或等價 secret table） | 每舊 user 建一 personal workspace/default environment；membership unique(workspace,user)；variable unique(environment,name)；FK 驗證 |
| 資源歸屬 | `monitors`、`notifications`、`tags`、`proxies`、`docker_hosts`、`remote_browsers`、`maintenances`、`status_pages`、`api_keys` | 先新增 nullable workspace_id，再依 user_id backfill，檢查零 orphan/零 null 後設 NOT NULL；monitors.environment_id 必須同 workspace |
| 資源關聯 | `monitor_notifications`、`monitor_tags`、`status_page_groups`、`status_page_monitors`、`maintenance_monitors`、`maintenance_status_pages`、`incidents` | 查出既有跨 owner／跨 workspace 關聯並報告，不能靜默歸給任一租戶；新增 composite FK 或 transaction 守衛；拒絕矛盾資料直到有明確修復 |
| API 斷言／匯入 | `monitors`、`heartbeats`；可能新增 `import_batches`／`monitor_sources` | assertions JSON version/schema，既有 null 視為無新斷言；result detail 有大小上限；source identity unique，import batch 不保存 secrets 原文 |
| 分散排程 | 新增 `monitor_schedules`、`notification_outbox`；`heartbeats` 增 run identity；`nodes` 更新 worker metadata | schedule 一對一 monitor；(monitor_id,scheduled_for) 唯一結果；due/lease indexes；舊 scheduler 與新 scheduler 不可同時啟用 |
| 規模 | 新增 `monitor_state`、`heartbeat_hourly`、`heartbeat_daily`（或等價摘要）；`heartbeats` time index | 建 rollup 唯一 bucket key；先 backfill/驗證再啟動 retention；raw 刪除不可用 schema rollback 復原 |
| 全域資源 | `settings`、`nodes` | 保持 platform scope，避免將全域設定任意複製到每個 workspace；mutation 由 platform admin policy 管理 |

遷移順序為 expand → backfill → validate → switch readers/writers → 最後才考慮移除舊欄位。先在獨立 PostgreSQL 跑新安裝與舊資料 fixture，再對 production 做備份／restore rehearsal；大型 index 評估 concurrent 建立，避免把長鎖混入 Prisma transaction。backfill 有批次／checkpoint，migration script 重跑必須安全。

回滾先停 worker/claims、保留 DB、回復上一相容版本及 feature flag；保留新增欄位/table，避免 destructive down migration。跨入 workspace 共享資料後，舊版僅依 userId 不能安全解釋會員權限，因此禁止直接回舊版對外服務；需進 maintenance mode 修復／前滾，或還原切換前完整 DB 備份並明確承認切換後新資料需另行搬移。scheduler 回滾先 drain/等待 lease 到期並確保新 worker 全停，再啟舊排程，避免雙跑。retention 真刪 raw data 前須驗證 rollup/備份與保留政策，刪除後只能由備份復原；不得宣稱 migration rollback 可復原被刪結果。
