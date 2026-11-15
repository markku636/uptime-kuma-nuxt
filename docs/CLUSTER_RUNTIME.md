# PostgreSQL API / worker runtime

設定 `APP_ROLE=api|worker|all`，預設 all。API 處理 REST 與 WebSocket；worker 只提供健康 probes，登入／管理／UI 路由回404。`npm run start:worker` 啟動 production build 的 worker role。各 process 使用新的 UUID，舊 NODE_ID／assignedNode 不再分配工作；舊 node metadata 保留作管理資料。

HTTP、keyword、JSON query 是目前具備可取消 bounded adapter 的 scheduled checker。其餘 legacy 設定保留，DTO／編輯器／runtime diagnostics 明確標 unsupported，不另啟無 fence 的 scheduler。push callbacks 不用 queue，經相同原子 heartbeat/state/outbox 寫入與跨 Pod fanout。支援任意舊協定 adapter 前必須補實際取消與資源上限，不能僅 Promise.race。

Queue 與 lease 放在同一 monitor row。短 PostgreSQL `FOR UPDATE SKIP LOCKED` 只領實際剩餘 slots；逾期接手保留 runId/scheduledFor、增加 fencing token。完成 transaction 鎖 monitor，再比對 active、scope、runId、owner、token、設定版本及未到期租約，原子寫 heartbeat/state/outbox/TLS cache 與下個 future slot。config、pause/resume、環境變數與 Bruno replace 廢止舊 lease。落後 slots 跳過，不補跑整段 outage。

worker 預設32個 global slots、每 origin8個，claim batch8。每一 redirect/OAuth hop 也受共用 HTTP origin semaphore。忙 origin 會有限 defer，沒有一次領4000再建立無限 promise queue。初次啟用在 interval 內穩定 jitter；儲存後不承諾立即首跑，編輯器試跑仍可立即驗證。lease15秒、renew3秒，monotonic watchdog 以送出 query 前時間扣安全 margin；DB黑洞／遺失租約會取消實際 HTTP。HTTP/retry 共用有限 run deadline。

通知 outbox 與 accepted state 同 transaction；只保存安全事件與 channel reference。dispatcher 重新確認 scoped active channel、解密設定，使用 bounded provider transport，對 claim/renew/ack 檢查自己的 token／expiry。最多5次，指數退避，失敗／unsupported provider dead-letter。TLS warning 用 certificate/channel/threshold digest 去重。一般完成 outbox 保留7天、TLS90天，分批 cleanup；通知遠端已接受但本機 ack 尚未提交時，接手可能再送。**不承諾外部 HTTP／通知 exactly-once**。

API 每 process 固定一條 PG LISTEN 連線，NOTIFY payload 只有 monitor ID 作 hint；定期 bounded state resync 只讀本機 socket 已訂閱的 scope／IDs，200 rows一批。斷線重連不依賴連續 event序號；每 socket 用 revision，client 用 heartbeat ID 去重。socket 不保證傳送每個中間 heartbeat，完整歷史由分頁 HTTP 補讀。每批 delivery 重驗 membership/user active/sessionVersion。傳輸固定 websocket-only，不需 HTTP polling sticky session；ingress 必須支援 upgrade。

健康：`/api/health/live` process liveness；`/api/health/ready` database/security/runtime readiness。SIGTERM 立即停止 readiness／claim，grace內 drain，超時取消 I/O；close hook 共用同一 drain promise。K8s termination grace 必須大於 WORKER_DRAIN_MS 加 DB query及HTTP server關閉時間。角色／整數上限／production secrets 錯誤會 fail-closed。已 sealed monitor/resource/environment envelopes 也在 bootstrap 驗證。

DB連線預算：一般 Prisma 預設6／process，worker control client另3（官方adapter-pg＋實際destroy socket的query3s／connect與pool2s，statement2s/lock1s／idle transaction5s），API 的健康／state／bootstrap也使用control client；每 API LISTEN另1。兩API+兩worker約 2×10+2×9=38 條配置上限，還需 migration／管理／測試額度。Bruno使用一般client保留120秒 atomic transaction，不套短worker timeout。數字是起點，必須依本機負載實測調整；參考 [timeout 說明](PRISMA_TIMEOUT_REFERENCE.md)。

升級：備份 → **停止舊 scheduler/process** → apply expand migrations → 部署新 binary → 啟動 API/worker roles → readiness 與小量功能／故障驗證。不可混跑忽略 configVersion 的舊 setInterval scheduler。回復採相容版本前滾或停工後回復，保留新增欄位、密文、state/outbox；不要 drop table／將秘密解回明文當一般 downgrade。

平台管理員可在 Settings → Cluster Nodes 的 PostgreSQL workers 區檢查 instance/role/lastSeen/inflight/outbox。workspace owner/editor 不具平台管理權；不可將 worker HTTP port暴露為一般API Service。API 間必須共享 session password、encryption key、database，NUXT_PUBLIC_APP_URL 與 APP_ALLOWED_ORIGINS 設為實際公開 origins。

驗證證據見 [分散式排程報告](validation/distributed-scheduler.md)。使用者於2026-11-14取消4000活躍負載／容量驗證；既有500 smoke僅保留歷史 bounded correctness 證據。K8s多節點設定與單節點demo限制見 [部署流程](KUBERNETES_DEPLOYMENT.md)，實際完成狀態見 [證據索引](validation/EVIDENCE_INDEX.md)。

## 看懂 Settings → Nodes（2026-11-15）

API 與 worker **沒有綁定關係**：API Pod 只服務 UI／REST／WebSocket，不跑檢查；每個 worker 各自從 PostgreSQL 佇列領到期的 monitor，所以「一個 API 有幾個 worker」的答案永遠是「全部 worker 服務所有 API」。同時檢查上限＝存活 worker 數 × `WORKER_CONCURRENCY`（預設 2 × 32 = 64）。

頁面上方的拓樸（API → PostgreSQL queue ← Workers）與統計卡直接回答這件事：

| 欄位 | 來源 | 怎麼判讀 |
| --- | --- | --- |
| due now／Oldest waiting check | `monitors` 中到期且未被租走的列（同 claim 查詢條件） | 長期 >0 且等待時間增加＝worker 不夠，加 worker replicas |
| Check slots in use | 各 running worker 的 `inflight / concurrency` 加總 | 接近上限＝滿載；遠低於上限而 due 仍累積＝看 per-origin 限制或 DB |
| Pod／Node | 心跳 metrics 的 `host`（Pod 名＝HOSTNAME）與 `node`（downward API `NODE_NAME`） | 同一 node 上的 replicas 只防 process crash，不防 node 故障 |
| Stopped in the last 24 hours | `worker_instances` 30 秒沒心跳或 draining | 每次 rollout／重啟都會產生新 UUID，舊列 7 天後清除 |

`WORKER_PER_ORIGIN` 是**每個 worker** 的上限：2 個 worker 時，同一個目標主機最多同時 16 個檢查。若被測 API 有 rate limit，要以「worker 數 × WORKER_PER_ORIGIN」估算。
