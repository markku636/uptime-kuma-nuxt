# Spec：PostgreSQL 租約排程、結果隔離與跨 Pod 即時事件

狀態：🔵 待實作。規劃與審查：Astra；產品程式由單一 Sol 實作。日期：2026-11-14。依 [總計畫](../API_PLATFORM_PLAN.md) 第 4 階段；phase5 負責完整讀取效能、彙總與保留政策，phase6 負責 K8s 部署與 4,000 API 負載驗收。

## 本輪結果與分段交付

同一資料庫可同時運行多個 API 與 worker process。資料庫決定哪個 worker 可以提交監測結果；worker crash、暫停、修改設定與網路隔離後，過時結果不能改變狀態、發通知或廣播。先交付 4A 排程與結果 fencing，再交付 4B 通知 outbox、4C 跨 API Pod 事件與管理介面。每一段可獨立測試，但只有全部必要驗收通過才宣稱多 Pod 可用。

外部 HTTP 呼叫無法保證 exactly-once：worker 發出請求後失聯，接手者可能再呼叫一次。承諾是同一邏輯 run 最多接受一個結果、同一 transition/channel 最多一筆 outbox。外部通知在遠端已接受而本機尚未寫成功時仍可能重送；有支援的 provider 可使用穩定 idempotency key，文件不得把本機唯一約束描述成端到端 exactly-once。

## 4A：角色、資料模型與排程

### 角色與唯一啟動路徑

設定 `APP_ROLE=api|worker|all`，預設 `all` 保持單機使用方式；K8s 分成 api 與 worker deployments。API role 不執行監測、通知 dispatch 或舊 node redistribution；worker role 不提供登入與管理 UI，可提供最小健康探針。若共用 Nitro HTTP server，worker 的應用 API 路由明確 404/503，不能僅靠 Service 未暴露。所有角色 await 共用 security/database ready；失敗時不 claim、不發外部請求，readiness 失敗。

全 process 只有一個 bounded poll loop，沒有每 monitor 的 `setInterval`。舊 `startMonitorJob`/`stopMonitorJob` 可保留相容 wrapper，但它們只通知本機 poll/abort，不能再啟動第二套排程。`nodeId`/`assignedNode` 舊靜態分配不再作為租約權威。舊健康檢查、node distributor、維護排程及 socket 首請求初始化必須稽核，避免在 API pods 或每個 pod 重複啟動排程。

worker instance ID 使用每次 process 啟動的 UUID，可附 Pod UID 作顯示；不能只使用可重複的 NODE_ID/hostname。重新啟動同名 Pod 不繼承上一個 process 的租約身分。設定以嚴格正整數 schema 驗證，NaN/0/無上限值 fail-closed。

### 建議資料模型

以下是最小必需語意；Sol 可採同等模型並同步此文件。為簡化鎖順序，建議將 queue/lease 欄位加在 `monitors` 同一 row：

- `config_version` bigint（初始 1）、`next_check_at` timestamptz、`run_id` UUID nullable、`scheduled_for` timestamptz nullable。
- `lease_owner`、單調遞增 `lease_token` bigint、`lease_until` timestamptz、`claimed_config_version` bigint。token 不因 release 歸零；不能以時間字串或固定 node ID 取代。
- `MonitorState` 每 monitor 一 row：workspace/environment、最後 heartbeat/run、status、checkedAt、statusChangedAt、ping、安全 checkCode，必要時有序 revision。使用 `(monitor_id, workspace_id, environment_id)` FK；payload 永不含 URL/headers/body/secret。
- `Heartbeat` 增加 nullable unique `run_id`（legacy rows 可為 null）、scheduledFor、configVersion 等足以追查接受結果的欄位。可另用 `MonitorRun` 唯一表，但不可同時無上限保存兩套完整 run 明細。既有 heartbeat assertionResults 只存安全摘要。
- `WorkerInstance` 或擴充現有 Node：instanceId/role/startedAt/lastSeen/draining/版本；診斷為 platformAdmin 專用，且不可含環境機密。worker lastSeen 只作可觀測性，不能替代 leaseUntil。

若選獨立 `MonitorSchedule` 表，所有 claim/completion/edit 統一先鎖 monitor 再鎖 schedule；多 row 以 monitor ID 排序。不可 claim 鎖 schedule 後等 monitor、edit 鎖 monitor 後等 schedule。不要用一把 workspace 鎖序列化每次心跳。

新增到期佇列與租約逾期索引；claim 查詢必須 EXPLAIN，不能每秒讀取／解密全部 4,000 monitor 設定。schema 外的 runtime 欄位不得流進既有 API/UI DTO 或匯出。

### Claim、執行與續租

1. worker 先計算剩餘實際執行 slots，再以單一短 transaction 選取 active、支援 checker、到期且 lease 已過期／空白的 rows。`FOR UPDATE SKIP LOCKED`，穩定排序、有限 LIMIT，claim 數不得超過可執行 slots。claim 只更新必要 queue 欄位並取得 config snapshot，transaction 結束後才解析環境與發出網路請求。資料庫時間為唯一到期判定；以 `clock_timestamp()` 或短 statement 的 `statement_timestamp()` 避免長 transaction 的固定 `now()` 誤判租約。
2. 新 slot 建立 runId 與 scheduledFor；到期租約的接手沿用 runId/scheduledFor，只遞增 fence token。不能每次 reclaim 都產生新 run，否則 unique runId 失去防重意義。config 修改取消舊 run，再為新 config 建立新 slot。
3. checker 使用共用 AbortSignal；HTTP 包含 DNS、OAuth、redirect、body、retry 等有總 deadline。租約初值與續租 interval 有明確上限；續租只允許 owner/token/configVersion 相同、active、尚未到期。續租失敗或 DB 不通，停止 claim、abort 該工作；租約過期不能「復活」續租。
4. 全域 worker concurrency（例如預設 32）、每 origin 上限（例如 8）、小型 claim batch、有限 retry 數／退避、有限總 run deadline。每 origin 定義為解析後 scheme/host/port，redirect 與 OAuth 也受有限連線上限。不得一次 claim 4,000 rows 再在記憶體排隊等 slot。若先 claim 後發現 origin slot 不足，要持續計入全域已占用容量或明確 defer/release，不能啟動大量隱藏等待工作。
5. 每個 logical monitor 不同 slot 不重疊；持有同一 run lease 時不開下一個 interval。落後排程跳過已錯過 slots，不將 outage 的所有分鐘補跑。初次啟用與重啟使用穩定 jitter，避免 4,000 個 immediate checks；保存 scheduledFor 與 start lag 指標。重試屬於同一 run、同一 fence，不建立假成功／失敗 heartbeat。
6. HTTP/keyword/json-query 先作必須支援的 bounded distributed checker。其他既有 checker 若沒有可取消且有限的 I/O，必須補 adapter/資源清理後才納入。不得只用 Promise.race 丟棄 promise 然後釋放 slot：底層 I/O 還在跑，實際並發會突破上限。暫不支援的類型應在 UI/API/worker readiness 說明其限制，不能默默成功、發假的 down 通知或退回另一套無 fence scheduler。

### Config 失效與原子完成

所有影響請求或排程的修改、pause/resume、Bruno replace、批次 backup import、clone/create、環境變數／secret 修改都使用共用 transaction helper。更動 `config_version`、使舊 lease 無效、更新下次 due。不要只呼叫本機 stopMonitorJob；其他 Pod 也必須受 DB fencing。環境設定更新以批次 SQL 遞增該 environment 內所有相關 monitor version（或等價 environment version fence），與設定寫入同一 transaction。delete 使用 FK cascade，使完成時找不到合法目標。

完成結果以短 transaction 鎖定同一 monitor row，**同時檢查** active、workspace/environment、runId、owner、token、claimed/current configVersion、`lease_until > DB now`。任一失敗即丟棄，不能寫 TLS cache、heartbeat、state、notification、event 或更新 nextCheckAt。此條件須在 DB 中原子判斷，不能先 `findUnique` 後無條件 `create`。

通過後在同一 transaction：unique run heartbeat → 讀寫 MonitorState → 判定真實 transition → 建立通知 outbox／durable event → 清除 lease、計算下一個 future slot。TLS safe cache 如有也在此 fence 內更新。commit 成功後才發 wake-up 訊號。completion 重送返回已接受／無操作，不得產生第二個狀態轉移；新 monitor 第一筆結果依既有政策不發「從未知變 down」通知，除非另有明確產品設定。maintenance heartbeat 一樣經 fence/state，不得沿用旁路直接 create。

transaction 外不得以「前一筆心跳」推導 transition，否則並發／順序反轉會產生錯誤通知。系統不能因租約遺失把 monitor 判 DOWN；基礎設施錯誤呈現 scheduler diagnostic/stale，真正 HTTP timeout 等監測結果才是 DOWN。

## 4B：通知 outbox

完成 transaction 以 `(runId, notificationId, eventType)` unique key 建 outbox（狀態轉移、TLS expiry 需分開明確 key）。目標通知限 monitor 所在 workspace；linked/default channels 都要驗 workspace，禁止現有 `defaultNotifications where userId=monitor.userId` 跨 workspace 選取。channel ID 及 monitor ID 用 composite scope FK 或 transaction 內明確檢核。

outbox 只存安全事件資料與 channel reference；不存解密 URL/query/userinfo、request body、header、環境 secret、provider config。訊息使用 monitor ID/name、status、checkCode、ping、發生時間，若顯示 URL 必須是明確安全投影。assertion expected/actual 與原始 exception 不得放通知。

dispatcher 用獨立 bounded slots、SKIP LOCKED lease/token，通知失敗不回滾已接受的 monitor 結果。send 有實際 provider timeout/abort；claim/renew/ack 同樣 fencing。最多嘗試次數、指數退避＋jitter、dead-letter 狀態與下一次 due；停用／刪除／跨 workspace channel 在送出前重新檢查。outbox ack 必須比對 lease token，過期 dispatcher 不可標記新 dispatcher 的工作成功。讀取 config 時才解密，log 只用安全 error code。

所有預設啟用的 provider 必須有有限傳輸；不支援 abort 的傳輸不得在 timeout 後騰出 slot 卻仍執行。可分段先支援現有實際 sender 的 provider，其他明確不支援；不能無限 retry。通知測試只能送 local mock sink，不對使用者真實 channel 發信。

## 4C：跨 Pod 事件與監控

PostgreSQL NOTIFY 只作短 payload 的 wake-up hint（event ID／monitor ID），不可放秘密或完整結果；commit 後才可觀察。API Pod 使用獨立 PG LISTEN 連線，錯誤後 reconnect/backoff。不能把 NOTIFY 當持久 queue。

選擇以下其一並文件化：

- 持久 event table + 每 API instance cursor，分頁讀事件；處理 sequence ID 分配順序與 transaction commit 順序不同造成漏讀的情況，不能單純把 MAX(id) 當保證已 commit 的水位。
- bounded state resync：通知喚醒後／定期只讀本 Pod 已訂閱 monitor 的最新 MonitorState/revision，分批查詢；重連後發最新狀態快照。明確不保證 socket 傳遞每個中間 heartbeat，完整歷史由 HTTP 分頁查詢補回。

前端依 heartbeat ID/state revision 去重並拒絕舊值覆蓋新值。發到每個本地 socket 前重驗 user active/sessionVersion/workspace membership/environment；不能因先前加入 room 就永久有權。撤權、改密碼、API pod 重連或來源 worker 在另一 Pod 都測。payload 沿用 safe DTO，不因 PG fanout 回傳原始 msg 或配置。public status 的發布／sendUrl／secret 規則仍成立。

Socket.IO 如保留 HTTP polling，K8s ingress 需要 sticky session；若選 websocket-only，client/server/ingress 都一致並明列限制。PG 事件 bridge 是跨 Pod 通知機制，不會自動同步 Engine.IO session。

健康探針分 liveness（process 活著）與 readiness（security bootstrap 成功、DB 可用、角色啟動完成、非 draining）。不得向公開 health 輸出 DB URL、host credentials 或 workspace 資料。SIGTERM 先 ready=false、停止新 claim、在 grace deadline 內 drain；超時 abort。只有底層 I/O 確認結束才清除／釋放租約；否則讓租約自然過期。K8s grace 秒數須大於 drain 設定。

platformAdmin 可見角色、instance lastSeen、inflight/limit、claim/complete/stale-result counts、oldest due lag、outbox backlog/dead-letter、DB/LISTEN reconnect、記憶體摘要；workspace editor 只見自己監測 paused/running/stale/unsupported，不可看到其他 workspace monitor IDs。metrics label 禁止 URL/secret/高基數 runId。

## DB 異動、遷移與回復

| 物件 | 異動／索引 | 遷移及回復 |
| --- | --- | --- |
| monitors | config/version/queue/lease 欄位；due/lease index | nullable runtime 起步，backfill active HTTP due 分散到 interval，configVersion=1；先停舊 scheduler 再啟新 worker |
| heartbeats | nullable unique runId、scheduledFor/configVersion 或等價 run ledger | legacy 不變；新 unique index 允許多個 null；新資料不能被舊程式當作另一套可寫排程 |
| monitor_states | monitor 唯一、scope FK、最後結果與 revision | 從各 monitor 最新安全 heartbeat 分批回填；不可掃描整個歷史進記憶體 |
| notification_outbox | unique event/channel/type；pending due、lease indexes | 初始空表，不補發歷史通知；成功／dead-letter 有保留設定與分批 cleanup |
| worker_instances／nodes | role、instance identity、draining、lastSeen | 不依賴 legacy primary-node election；保留舊紀錄供顯示但明確新/舊區別 |
| 可選 event table | scope、安全 IDs、timestamp、cleanup index | 有限保留；cursor 落後 retention 必須 resync，不靜默漏資料 |

phase4 至少提供小批 runtime/outbox cleanup，避免無上限膨脹；完整 heartbeat 彙總／retention 在 phase5。備份→expand migration→停止舊 process→部署新 binary→啟動新角色。禁止舊 setInterval scheduler 與新 lease worker 混跑；更新文件不可稱零停機 mixed-version upgrade。回復先停新 worker/dispatcher，再回復相容 binary；保留新增欄位／表資料，不以 drop table 作一般回復。回退到會忽略 configVersion 的舊 binary 前必須確定沒有舊／新 lease 工作仍在進行。

## 受影響檔案

- `prisma/schema.prisma`、新增 `prisma/migrations/20261114040000_distributed_scheduler/migration.sql`；若拆 4A/4B migration 先在此補實際名稱。
- `server/services/monitor/scheduler.ts`、`checker.ts`、`checkers/**`、`http-request.ts`、`cert-expiry-notification.ts`；新增同目錄 `leases.ts`、`worker.ts`、`completion.ts`、`runtime.ts`、`config-version.ts`（可依責任合併）。
- `server/services/notification/sender.ts`、`providers/**`；新增 `outbox.ts`、`dispatcher.ts`。
- `server/services/socket.ts` 或實際 `server/services/socket/**`、新增 `server/services/events/**`；`composables/useSocket.ts`、monitor state store/composable。
- `server/plugins/00-database.ts`、`00-auth-security.ts`、`01-node-init.ts`、`04-node-health.ts`、`socket.ts`；新增 runtime lifecycle plugin；`server/utils/security-bootstrap.ts`、`cluster-config.ts`、`node-initializer.ts`、`server/middleware/00-auth-ready.ts`。
- `server/services/monitor-distributor.ts`、`node-health-checker.ts`、`dynamic-node-discovery.ts`、`maintenance/scheduler.ts`（停用舊分配／排程入口或接共用 scheduler，不另起網路 side effects）。
- `server/api/v1/monitors/**`、`server/services/bruno/importer.ts`、`server/utils/backup.ts`、environment/maintenance mutation APIs、`server/utils/resource-crud.ts`（所有監測設定變更 fence）；新增共用 monitor mutation helper。
- `server/api/v1/health.get.ts`、新增 liveness/readiness endpoints、`server/api/v1/nodes/**`；必要 admin worker diagnostics endpoint；`pages/settings/nodes.vue` 或既有 cluster page、`types/cluster.ts`、`shared/types/**`。
- `.env.example`、`package.json`、`package-lock.json`（若新增 pg LISTEN client）；新增 worker entry/script、`scripts/migrate.mjs`、`scripts/test-unit.mjs`。
- 新增 `tests/scheduler.test.ts`、`tests/scheduler.integration.test.ts`、`tests/outbox.integration.test.ts`、`tests/cluster-socket.integration.test.ts`、`tests/fixtures/worker/**`、`docs/CLUSTER_RUNTIME.md`、`docs/validation/distributed-scheduler.md`；既有 auth/workspace/Bruno/monitor integration 回歸。

實作選用不同實際檔名時先補本文再改程式；此清單授權必要同責任拆檔，不代表必須全部更動。

## 驗收矩陣

- [ ] 真 PG、至少兩個獨立 worker processes 同時 claim：單一 run 只有一筆 accepted heartbeat/state/outbox；不是同一 process 的兩個 mocked function。
- [ ] worker A claim 後暫停，B 到期接手；A 最後送舊結果、TLS metadata、notify 均零接受。續租過期後拒絕復活。重複 completion 冪等。
- [ ] check 途中 pause/delete/URL/header/assertion/env secret 修改/Bruno replace；舊 config 結果拒收，其他 API Pod 的 pause 同樣有效，resume 不接續舊 run。
- [ ] crash 在 claim 後、HTTP 後、DB commit 前／後各有案例；DB rollback 不廣播不送信，commit 後 process crash 可由 outbox 接手。
- [ ] DB 中斷／renew failure／SIGTERM 停止 claim、abort 真 socket；bounded concurrency 觀察 fixture server 實際連線，不只看 JS counter；slow headers/drip/gzip bomb/OAuth 等仍守 deadline。
- [ ] retry、每 origin、全 worker 上限、jitter、overdue skip 與總 deadline 有測量；一個慢 origin 不使整個佇列無限等待，unsupported checker 有明確行為。
- [ ] 兩 workspace、同一 user、兩個 default channel local sinks，事件只送自身 workspace。秘密 sentinel 不出 heartbeat/outbox/socket/log/provider body。
- [ ] outbox claim race、逾期重接、stale ack、provider timeout、channel disable/delete、最大重試/dead-letter、相同事件 unique key 全通過。
- [ ] 兩 API pods + 一 worker：任一 API 的 socket 可看見新狀態；LISTEN 斷線重連與漏 hint 能 resync；撤權 socket 不收到後續資料，前端舊 revision 不覆蓋新。
- [ ] migration fresh/legacy、舊 scheduler 停用、角色 env validation、security bootstrap failure zero outbound、readiness/drain 均驗證。真 PG query plan、DB pool 及 LISTEN 連線數有紀錄。
- [ ] 本輪至少 500 monitored local endpoints 的 bounded smoke；4,000 endpoints/完整持續時間與 worker-loss 壓測留到 phase6，未實測前不宣稱完成 4,000 效能。

## 官方依據

實作 Prisma 6 DB timeout 與 lease watchdog 時，依 [Prisma timeout reference](../PRISMA_TIMEOUT_REFERENCE.md) 區分 connect/pool/socket/server/transaction timeout；新增 claim 回應已過期同步 abort、晚 renew 不復活 finished run、真 TCP blackhole 下 HTTP socket abort 驗收。長匯入／migration 不可因短 worker control-query timeout 被誤殺。

短DB控制範圍包含 maintenance lookup、runtime instance heartbeat/drain、readiness probe及state bridge resync，不只lease/outbox。任何await一般無socket timeout查詢的run都可能在watchdog abort後仍卡在await；需依實際query路徑逐項驗證blackhole與bounded shutdown，不能只測renew失聯。

PostgreSQL 的 `SKIP LOCKED` 適合 queue consumers，但不是一般一致讀取方法；本方案以它分配工作，再用 transaction/fence 驗證完成。[PostgreSQL SELECT](https://www.postgresql.org/docs/current/sql-select.html)

`NOTIFY` 是跨 session 訊號，通知 transaction 的 commit 時點會影響送達；真正資料保留在 table，payload 僅作提示。[PostgreSQL NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html)

transaction timestamp 與實際時鐘不同，租約需明確選擇資料庫時間函式。[PostgreSQL Date/Time Functions](https://www.postgresql.org/docs/current/functions-datetime.html)

Socket.IO 多節點需處理傳輸 session affinity 與跨 server 訊息轉送；僅建立多個 pods 不會自動完成兩者。[Socket.IO multiple nodes](https://socket.io/docs/v4/using-multiple-nodes/)

Sol 4A 實作補充：新增 `server/services/monitor/runtime-config.ts`、`server/utils/monitor-mutation.ts` 與 `server/utils/prisma.ts` 有限連線 pool（預設6／process），health 路徑 `/api/health/live`、`/api/health/ready`，middleware auth/rate-limit allowlist 同步。`server/jobs/index.ts`／舊 reconcile、node init/health plugins 停止自動啟動，以單一 runtime lifecycle 替代。`server/utils/monitor-secrets.ts` editor DTO 改明確白名單；`plugins/socket.client.ts`／現有 dashboard socket consumer 加 revision 去重。初版 4A 的 maintenance 由各 claimed run 查 DB／純時間判定，不依賴每 API Pod 的 Cron side effects。

控制平面 DB client 補充：新增 `server/utils/worker-prisma.ts`，worker claim/renew/completion/outbox 使用獨立有限 pool（預設3）與 socket_timeout/connect_timeout/pool_timeout／statement_timeout／lock_timeout。API/Bruno client 不套3秒 query上限，避免破壞120秒原子匯入。local monotonic watchdog 保守使用送出 renew 前時間，不以收到回應時間延長。

管理 UI 實際檔案：新增 `components/settings/WorkerRuntime.vue`，插入 `pages/settings/nodes.vue`，保留 legacy node metadata 管理但明示它不控制新 scheduler。API `server/api/v1/nodes/runtime.get.ts` 僅 platform admin cookie session。

4B expand 補充：`prisma/migrations/20261114041000_outbox_deduplication/migration.sql` 增 nullable unique `NotificationOutbox.dedupeKey`，用於每 certificate/channel/threshold 的 TLS warning，不影響 status event 的 run/channel/event unique key。TLS warning 不回傳 cert subject／URL；outbox 依事件類型有限保留（TLS 90天／一般7天），避免每次 heartbeat 重寄同一證書警告。

Runtime resilience/cleanup 拆檔：新增 `server/utils/database-errors.ts` 與 `server/services/monitor/cleanup.ts`。只對已知 transient DB 啟動錯誤有限退避重試；錯 key/AAD 保持 fail-closed。SIGTERM/close 共用同一 drain promise。每分鐘 advisory-lock 下有限批次清理 outbox／過期 WorkerInstance；heartbeat retention 留 phase5。

Probe 驗收時間設定：`NOTIFICATION_TIMEOUT_MS` 預設10000（100–30000），所有實際 provider 共用同一總 deadline。允許在 local 故障測試縮短時限，產品預設仍10秒。

Readiness 補強：`backfillMonitorSecrets` 也以有限批次驗證已 sealed 且 base 欄位全空的 rows；`securityReady` 驗證 environment secret envelopes。錯 key／錯 AAD 不可因沒有待回填 plaintext 而開放 API。補 `tests/migration.integration.test.ts`／bootstrap 已 sealed 壞 envelope 負例。

Push 相容性：`server/api/push/[token].ts` 也寫同一 transaction 的 safe heartbeat/state/outbox 並 PG hint，避免 push 只在收到 HTTP 的 API Pod 可見。新增 `server/services/monitor/commit-result.ts` 共用已授權結果寫入；push 是事件回報，不進 HTTP worker queue。`tests/workspace.integration.test.ts` 改等待 bounded resync 而非假設150ms同步廣播，新增 cluster push跨API驗證。

控制路徑 blackhole 補強：`monitor-config.ts`／maintenance query 注入短 worker client；runtime registry/heartbeat/drain、health ready、StateBridge 及 socket delivery permission reads、security bootstrap 全使用有限 socket/statement timeout client。保留一般 API/Bruno 長 client。驗收新增 maintenance query 中途黑洞、API readiness 黑洞、SIGTERM registry drain 黑洞，確認實際 DB operation 終止與 worker slots 釋放。受影響測試含 `tests/scheduler.integration.test.ts`、`tests/cluster-socket.integration.test.ts`、`tests/fixtures/worker/process.ts`、新增 `tests/helpers/database-blackhole.ts`。

LISTEN lifecycle 補強：`pg.Client.end()` 對已 blackhole 的 idle socket 可能只送 graceful FIN 而無限等待對端；StateBridge shutdown/reconnect 必須實際 destroy 所有權屬的專用 listener stream，再 await end，不能只 timeout race 留未關閉連線。真 production API process 的 SIGTERM 黑洞測試驗此邊界。

實測 native connector socket timeout 未覆蓋全部 registry 新 query 黑洞路徑（raw execute／raw returning皆15秒未settle）。控制 client改官方`@prisma/adapter-pg@6.19.1`及專用pg pool：單query有deadline，超時實際destroy該client socket，等待query settle後釋放；connect/pool有限，transaction沿同連線。API/Bruno一般native client保留。受影響`package.json`、`package-lock.json`、`server/utils/worker-prisma.ts`、新增`server/utils/bounded-pg.ts`、`tests/bounded-pg.test.ts`／scheduler integration。不使用timeout race後繼續共用尚未終止的連線。

Runtime診斷freshness：`nodes/runtime.get.ts`／WorkerRuntime 以lastSeen超過30秒（heartbeat5秒）標offline，draining優先；保留紀錄但effectiveConcurrency=0，不把舊record視為可用capacity。cluster integration加入過期record負例。
