# API 監測平台迭代計畫

日期：2026-11-14。規劃：Astra；程式實作：單一 Sol agent。來源快照：`896c4575f22bf58119b85792b929b6ecb30a1bbd`。本文件是待實作與驗收的計畫，並非完成報告。

> 2026-11-14 13:29 台北範圍修訂：使用者取消 4000 API 負載／容量驗證，改以 K8s 多節點支援為重點。只清除本次仍存在的 owned 4000 fixture，保留 5 筆 demo；其餘 REST、maintenance、UI、assertions、Bruno、workspace 與雙網域要求保留。已完成量測僅是歷史證據。

## 16:35 交付狀態索引

此處不把計畫各列自動標完成。產品已凍結runtime `8d0593a9492538112988024e4b2c1ea9fdbcaf5a3e36164267a58df00075d4b4`；最新build、full77pass＋1skip與targeted5/5通過，unit37/37；typecheck仍66 diagnostics、exit2。cluster最終8d0593 revision9已Healthy／Synced，loader／migration／runtime及新版5-demo雙API smoke通過；先前a4134b另有150秒rolling update證據。多node設定可交付，但現場單node，跨node實測未做；Kaniko d6 context no-push build已成功（非最新版image runtime）；雙網域仍受平台權限阻擋。各版本與限制見 [交付驗證摘要](validation/RELEASE_VALIDATION.md) 和 [證據索引](validation/EVIDENCE_INDEX.md)。4000取消與保留少量demo的範圍不變。

## 目標與設計決策

讓現有 Nuxt／Prisma／PostgreSQL 系統能管理 API monitors，驗證回應內容、從 Bruno 匯入、隔離多 workspace 與環境，並以 Kubernetes 多 worker 執行。K8s 首版範圍是部署及執行本平台，不含 Kubernetes 資源探索或取代 Prometheus。

保留 PostgreSQL 作為唯一排程真實來源；不因加入 cluster 就強制新增 Redis。分開 API 與 worker 角色，移除每個 monitor 各自 setInterval 的排程核心。多環境以每個 monitor 綁定一個 environment 表達，同一 request 可明確複製到其他環境；不暗中將一次排程展開成所有環境。

## 官方能力參考

- UptimeRobot 支援 status、header、JSON、raw body 斷言與 AND／OR。借鏡其表單式條件和明確失敗原因，而非複製完整付費產品。[官方文件](https://help.uptimerobot.com/en/articles/13628553-uptimerobot-api-monitoring)
- Checkly 提供請求試跑、環境變數與敏感值遮罩；本平台的試跑應呼叫同一個 production checker，顯示逐條結果。[官方文件](https://www.checklyhq.com/docs/detect/synthetic-monitoring/api-checks/configuration/)
- Bruno declarative assertions 與 JavaScript tests 是不同能力；不能因能解析 .bru 就宣稱能執行其測試腳本。[Assertions](https://docs.usebruno.com/testing/tests/assertions)
- Bruno 現在推薦 OpenCollection YAML，同時保留 .bru。首版明確標示「Bruno .bru 宣告式子集」；YAML 與 typed variables 必須有獨立 fixture 才能宣稱支援。[格式文件](https://docs.usebruno.com/bru-lang/overview)、[變數優先序](https://docs.usebruno.com/variables/overview)
- PostgreSQL `FOR UPDATE SKIP LOCKED` 適合多個 consumer 競爭工作列；它不提供外部 HTTP 呼叫 exactly-once 保證。[PostgreSQL 16 SELECT](https://www.postgresql.org/docs/16/sql-select.html)
- Socket.IO 多節點必須處理跨 server 訊息轉送，使用 polling 時還須 session affinity；單純多開 pod 不能保證所有 UI 都收到 heartbeat。[官方文件](https://socket.io/docs/v4/using-multiple-nodes/)

## 起始基線缺口（歷史盤點，非目前未修清單）

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
| 6 K8s 多節點支援 | immutable image、跨節點 manifests、migration、runbook | 兩 API／兩 worker 的小量功能與故障測試；image 模式無單節點 artifact PVC；實際 lab 單節點限制與未執行的跨 node 驗收明列 |

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

採 jitter 分散 monitors；重啟不瞬間執行全部，不補跑每個錯過週期。嚴格限制 worker global concurrency、per host concurrency、queue length、retry count、總 timeout 及 DB pool。重試需 jitter/backoff；非冪等 HTTP 重試須明確設定。外部 HTTP 不能保證 exactly-once；lease 過期重領可能重送，產品與文件須如此說明。

outbox 與結果同 transaction，唯一事件鍵避免同一 transition 多次 enqueue；sender 自己 lease、可重試。第三方通知若沒有 idempotency API，crash 後重送不能宣稱 exactly-once。跨 API pod fanout 可用 PostgreSQL NOTIFY 作失效提示，再讀有權限的 DB state；通知丟失不影響結果正確性，client reconnect 用 cursor 同步。也可採正式 Socket.IO PG adapter，但必須測跨 pod 的實際連線。

API cursor pagination 預設 100、最多 200，穩定排序含 ID，search/environment/status/tag 都在 DB 篩選；list 只拿安全摘要及 latest state，不附 50 heartbeats。詳情另有 bounded history API；summary 是全 workspace aggregate，不可把單頁統計當全局。更新推送批次化，慢 client 合併狀態並設 queue cap。

容量須依實際工作負載 sizing，本輪不再驗證特定 4000 筆容量。目前 raw 保留設定為48小時、hourly rollup400天，實際刪除預設關閉；沒有交付daily rollup；rollup 依狀態持續時間計算 uptime，不以不等頻次簡單計數。cleanup 使用有時間索引的 bounded batches，單一 maintenance lease；不能一次刪除數千萬筆。

## K8s 交付

實作與驗收以 [phase6詳細Spec](specs/2026-11-14-k8s-scale-validation.md) 為準：canonical Docker/Compose入口、獨立migration Job、可重現integration harness、跨節點 image 部署設定與隔離 namespace 小量功能實跑；built-image與artifact smoke分開列證據。

同 image 以 APP_ROLE=api|worker|all 分工，cluster 使用分開 Deployments；每 process 新UUID 作唯一 workerId，Pod UID只作診斷。API 無排程，worker 無外部管理入口。提供 Secret/ConfigMap、Service、Ingress 範例、requests/limits、startup/readiness/liveness、PDB、terminationGracePeriodSeconds、non-root securityContext、migration Job。DB migration 只跑一次，不讓每個 replica 自行 db push。readiness 可檢查 DB 與 worker loop，liveness 不因短 DB outage 無限重啟。

SIGTERM 停止 claims，維持/安全結束既有租約，在期限內完成或取消；timeout 留待 lease expire，不能在仍有 in-flight request 時立即釋放租約。若後續配置 K8s HPA，只擴 API／worker（本期未交付 HPA 自動擴縮驗證）；worker sizing 以 queue lag、utilization 為依據。PostgreSQL HA、備份、連線池為部署前提，不能因有多 worker 就宣稱整體無單點。

## 驗收與證據

1. 自動測試：typed assertions／malicious paths／oversized response；Bruno parser fixture／scripts rejection／variable precedence；role/resource matrix；lease race／stale commit／pause race／outbox dedupe。
2. DB 整合：新安裝與既有 schema 資料遷移；兩個 workspace 的 REST、socket、import/export、public endpoint 越權；真正 PostgreSQL transaction，不只 mock。
3. Browser：登入、建 workspace/env、建 API monitor、試跑、編輯重載、Bruno preview/import、跨 workspace 切換、viewer 按鈕與 server 拒絕。若無 MCP，只能記為瀏覽器自動化，不能寫 MCP 驗證通過。
4. K8s：少量 task-owned HTTP fixture 驗兩 API／兩 worker、migration、role、fanout、rollout、lease 接手；取消新增 4000 seed 與持續負載 runner。
5. 證據：分列 image build、built-image runtime、artifact runtime、實際 node placement 與故障事件。單節點 lab 不可宣稱跨 node failover；既有 SQL/helper 量測不等同容量 SLA。
6. 故障：2 worker 啟動，kill 一個、延遲舊結果、DB 暫斷、滾動重啟；有效結果不重複、stale result 被拒、lease expiry 後恢復。K8s 如只有 manifests 靜態驗證，報告必須直說尚未實際部署。

## 變更策略

使用者新增交付要求依 [REST／maintenance／UI與雙網域Spec](specs/2026-11-14-rest-maintenance-ui-delivery.md)：維護窗口真時間語意與REST權限／OpenAPI、desktop/mobile介面收束、兩網域測試、精確清除實際存在的 owned 4000 fixture 並保留 5 筆 demo（不再先跑負載）。公開demo使用獨立持久化PVC，不隨 fixture cleanup 刪除；DNS發布前完成admin setup。這些接續原phase5/6，不取代其完整驗收。

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

## Kaniko完成追記（16:24:05）

Astra已直接讀 `kaniko-d6-build-result.json`：canonical Dockerfile no-push build Succeeded，image digest `sha256:bc37be21e220d9d88d6193525ab8fdaca4787fab5b2b63452335b82d2f6bd764`，tar353607680bytes。這只證明d6 source context的實際image建置，不是registry發布或built-image runtime，也不包含其後最終UI修復。較早「執行中」是當時狀態，現以本追記為準。98eb511c候選未部署，Sol因最後UI select修復再產新artifact，最後部署identity待新manifest。多node模板獨立render及每revision spread finding見 [review16](validation/astra-review-16.md)。

## 最後文件交接

最新產品8d0593已完成K8s revision9與live REST補驗／精確cleanup。仍有66次typecheck診斷，其中部分為可達功能缺口，詳 [使用者影響維修清單](validation/TYPECHECK_REPAIR_QUEUE.md)；不能說全部既有或無影響。live REST第一輪503原因未明、雙網域權限／產品GitHub未推送／實際跨node與built-image runtime未驗仍保留，見 [交付摘要](validation/RELEASE_VALIDATION.md)。Astra文件自此凍結供Sol完整source bundle收錄；後續root唯讀觀察以獨立結果／最終回報追加，不在打包中途改檔。


## 17:22後授權 continuation：typecheck修復

Astra規劃/審查、Sol唯一實作者，因本輪sandbox不同，所有變更先在/tmp Spec/patch/old-new SHA與guarded apply交root正常require_escalated套用；不繞過寫權、不自行build/部署。第一切片tags PUT／status group reorder／legacy lastSeen已套source，4/4 VM驗證，真PG/HTTP/browser待累積切片後build驗收。第二切片badge XML/input contracts、avg rollup統計、fenced TLS cache讀取與失效、有效UI URLs在staging；其純函數/HTTP驗收須逐項記真實結果，線上仍8d0593 revision9直到下一次發布。Session契約另切片，不新增session registry/schema。4000負載仍取消，原5paused demos保持。


## 2026-11-14 18:13 continuation 已部署

Tag／badge／群組拖曳修正已經GitOps部署revision12，線上REST驗證與owned資料清理通過；詳見 [部署驗收](validation/continuation-1813.md)。Session修復仍為未套用staging；全量typecheck與跨實體node驗證未完成。使用者指定Tenon綁雙網域，目前仍受settings:write權限阻擋。


## 2026-11-15 Tenon 雙域 HTTPS 交付追記

`uptime.226network.com`（Tenon route 71）與 `uptime.markkulab.net`（route 72）已透過 V-TERMINAL admin MCP 建立，均由 agent 2 連至 `127.0.0.1:32480`，公開 DNS 為 A `161.33.213.93`。API release revision 12 為 Healthy／Synced，API 2/2、worker 2/2。兩域各連續三次通過可信 TLS `/login` HTTP 200 且包含 Uptime Kuma 內容；CUA 一般帳密登入、dashboard Live、原 5 paused demos 與 reload 保持登入均通過，第二域 hydration 後恢復 Live。第二域最終截圖為完整 5 筆列表，使用者 tab 保留已登入 dashboard。

兩域另以 Python 標準 `http.cookiejar` 各登入 HTTP 200，確認 Set-Cookie 屬性 `Path=/; HttpOnly; Secure; SameSite=Lax`；後續 `/api/_auth/session` 均為 HTTP 200 且有 user，沒有輸出 Cookie 值。原 HTTP NodePort 登入循環的根因為 Secure cookie 不隨 HTTP 回送；公開 HTTPS 已通過，Secure cookie 全程維持，沒有產品 rollout。

仍有 **P2 hydration mismatch**：兩域均出現 `Hydration completed but contains mismatches.`，未定位或修復，不能宣稱 console 無 error。訊息 UTC 時間為第一域 `2026-11-14T16:22:09.914Z`、第二域 `2026-11-14T16:24:16.864Z`。另有 **P3 空結果文案**：第二域搜尋無匹配時顯示 `0 on this page · 5 in environment`，卻提示 `No monitors yet. Click Add...`；已清除搜尋並恢復 5 筆，本次未修正文案。

功能結果與 wizard 狀態分列：初次 job `0ac6f36b-5b13-4861-b2bc-3e11956b5115` 的 LAN target 不在 `allow_targets`，僅清本任務 route 再改 loopback。job `a1e4e085-4185-4b9c-8316-718542d58e6c` 雖通過直連 TLS，因 Tenon 自動 A 與 wizard 僅接受 CNAME 的檢查衝突而為 `rollback_failed`，且缺 `dnsAfter`，沒有盲目回滾。第二域以正常 `tenon_create_route` 建立；preview `79b55da6-7085-4fed-b6db-476c512ea19e` 未 apply。自動 A 記錄經審查保留；公開入口成功不改寫 wizard 狀態。完整結果與截圖見 [Tenon HTTPS／登入驗收](validation/20261115-tenon-https-login.md)。

此追記取代先前「settings:write 阻擋、網域未發布」作為目前狀態，舊記錄保留為歷史。Session 第三切片仍是未套用 staging；4000 負載仍取消，跨實體 node 與 built-image runtime 限制未改。
