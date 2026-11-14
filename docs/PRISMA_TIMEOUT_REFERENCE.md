# Prisma 6／PostgreSQL 逾時與租約 watchdog

日期：2026-11-14。Astra 官方文件查核與設計建議。目標 repo 本機 `@prisma/client` 為 **6.19.1**，schema 使用 `prisma-client-js` ；初版採內建 PostgreSQL connector。2026-11-14 黑洞實測後，短控制 client 改用 `@prisma/adapter-pg@6.19.1`，一般 API／Bruno 保留 native client。不要套用 Prisma 7 預設值，或將 `pg` 設定誤當 native URL 參數。

## 官方支援與單位

| 設定 | 單位與範圍 | 不涵蓋的保證 |
| --- | --- | --- |
| URL `connect_timeout` | 秒；建立 DB 連線等待；0 表示無 timeout | 不保證已連線查詢或租約工作停止 |
| URL `pool_timeout` | 秒；等待 pool connection；0 停用 | 不取消已在執行的 SQL |
| URL `socket_timeout` | 秒；內建 PG connector 單次 query 等待上限 | 不應推論一定中止所有 server 工作，亦不能替代租約 watchdog |
| URL `options` | PostgreSQL connection startup options | 不是任意 JavaScript/Prisma constructor options |
| interactive transaction `maxWait` | 毫秒；取得 transaction 的等待上限 | 不等同 query socket timeout |
| interactive transaction `timeout` | 毫秒；transaction 執行時間限制 | 不能單靠 await rejection 決定 HTTP abort 時點 |
| PostgreSQL `statement_timeout` | 毫秒（未寫單位時）；server 執行 statement 上限 | 網路斷線時 error 可能無法立即送回 client |
| PostgreSQL `lock_timeout` | 毫秒（未寫單位時）；各次 lock acquisition 上限 | 不限制非等待鎖的其餘 query 時間 |

前四項由 [Prisma v6 PostgreSQL connector](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql) 列明；`pool_timeout` 的 queue 語意另見 [Prisma v6 connection pool](https://www.prisma.io/docs/orm/v6/prisma-client/setup-and-configuration/databases-connections/connection-pool)。transaction 選項及單位見 [Prisma v6 transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions)。server timeout 的行為見 [PostgreSQL 16 client defaults](https://www.postgresql.org/docs/16/runtime-config-client.html)。

`statement_timeout` **不是**上述 Prisma URL 清單中的獨立 connector option。透過支援的 `options` 傳 `-c statement_timeout=2000 -c lock_timeout=1000`，或採 transaction 內 `SET LOCAL`／部署 DB role 設定。不要假設在 URL 加 `&statement_timeout=2000` 就已生效；必須用相同 client `SHOW statement_timeout` 驗證。

## 本專案建議值與隔離

下列數字是本專案的起始調校值，**不是官方預設或未經負載測試的 SLO 承諾**：

```ts
const workerUrl = new URL(process.env.DATABASE_URL!)
workerUrl.searchParams.set('connection_limit', '6')
workerUrl.searchParams.set('connect_timeout', '3')
workerUrl.searchParams.set('pool_timeout', '2')
workerUrl.searchParams.set('socket_timeout', '3')
workerUrl.searchParams.set(
  'options',
  '-c statement_timeout=2000 -c lock_timeout=1000 -c idle_in_transaction_session_timeout=5000',
)
```

使用 URLSearchParams 編碼，保留原本經檢查的 TLS/schema/options 等必要設定；實作若合併已有 `options`，需明確優先序及驗證，不可默默丟掉既有安全設定。不能將完整 URL 打進 log。

worker claim/renew/completion 是短控制 transaction，應維持小 statement 與有限 pool wait；若 completion 的合法批次超過以上 server timeout，先量測並調整 query/batch 或專用設定。lease 與 renew interval 要大於正常控制 I/O 延遲並留安全 margin，但不因慢 query 無限延長 lease。

**不要**全域把所有工作改成 `socket_timeout=3`／`statement_timeout=2000`：Bruno 4,000 筆匯入、120 秒 atomic restore 與 migration 的合法工作範圍不同。可用 worker 專用 client 或 APP_ROLE=worker 專用 DB URL；`APP_ROLE=all` 仍需可區分長 transaction 與短控制 query。每 process 新增 client 就新增 pool，文件要計算總連線上限，不能每次 renew 建一個 client。LISTEN 使用獨立固定連線，不占每個 run 一條連線。

## 本機 monotonic watchdog 不變條件

此段是安全設計推論，資料庫官方文件不提供跨 process lease 保證：

1. 發送 claim/renew **之前**記錄 `performance.now()`。只有 query 成功且仍在安全時間內，才將已確認租約的本機最晚期限更新為 `requestStarted + leaseMs - margin`；不能使用「收到 response 時刻 + leaseMs」，因 response 可能已延遲大半租期。
2. claim 返回時若此本機預算已耗盡，立即同步 `AbortController.abort()`，不發任何 outbound I/O。`setTimeout(..., 1)` 不能代替當下檢查。執行前也檢查 signal。
3. watchdog timer 與 `await renew` 分離；DB 黑洞、pool 飽和或 query 卡住時，timer 仍會 abort HTTP/socket/retry sleep。single pending renew 不重入；不要每個 timer tick 堆一個永遠 pending 的 query。
4. 一旦 lost/expired/aborted/finished，晚回 renew 成功不能恢復工作或重新 arm watchdog。`finally` 設 finished 再清 timers；pending renew callback 需檢查 finished。
5. `Promise.race` 可限制 caller 等待，但不代表 DB SQL/socket 已取消。不得據此釋放所有容量、建立無限新查詢或把 unknown commit 判斷為失敗後重複寫入。結果以 DB runId/fence/idempotency 查核。
6. process 暫停／event loop 長停頓時 JS timer 也會延後，故 DB fencing 是最終 accepted-result 權威。watchdog 主要縮短失去租約後還在進行的外部 I/O，無法保證 exactly-once HTTP。

## 必須驗證的故障

- 同一 worker client `SHOW statement_timeout`、`SHOW lock_timeout`，以及短 `SELECT pg_sleep(...)` 的觀察時間與錯誤；不可只看到 URL 裡有參數。
- 本機 TCP proxy 正常完成登入後停止雙向轉送，保留 TCP 不 close，模擬真正 blackhole；不能只測立即 ECONNREFUSED。觀察 local HTTP fixture 的 socket 在 lease watchdog deadline 內關閉，即使 renew promise 尚未 settle。
- pool 排隊、row lock、慢 query、server restart 分開測；確認數字用秒或毫秒正確。測試對獨立連線／測試 fixture 操作，不 ALTER 全域 DB 設定、不停止共用 PostgreSQL。
- 暫停 worker A／延遲 claim 或 renew 回應，讓 B reclaim；A 恢復後零新 outbound，零 accepted stale result，晚 renew 不重設 timer。
- drain 時若 DB 控制 query 卡住，readiness 立即 false，停止新 claim，HTTP 在有限 grace 內 abort；程序最終退出策略不能無限 await `$disconnect()`／relinquish。

本文件初版為官方查核與讀碼設計，尚未把上述 PG/blackhole 故障全部實測；實際數字與環境另記驗證報告。

## 黑洞查核更新：native prepare 不受完整 deadline 保護

Astra 獨立最小測試（2026-11-14，本機 PostgreSQL、唯讀 SELECT、Prisma6.19.1、pool1/socket_timeout3）結果：warm 同一 SQL 在3003ms拒絕P2010；cold新SQL在8003ms仍未settle，直到實際destroy proxy sockets才結束。此測試正常連線後才停止雙向傳輸，沒有關閉TCP或修改共用資料。原始輸出 `/tmp/astra-native-timeout-audit.log`；臨時腳本不屬產品交付。

[Prisma6.19.0官方engine原始碼](https://github.com/prisma/prisma-engines/blob/6.19.0/quaint/src/connector/postgres/native/mod.rs#L607) 的 `execute_raw` 先 await statement cache／prepare，再進 `perform_io` 的 socket timeout。這與6.19.1實測吻合；不能把換raw方法或預熱查詢當完整解法，pool新連線／新SQL仍會觸發。

短控制 client 現採專用 `pg.Pool`（connect/pool2秒、max3），`BoundedPgClient` 對實際query持有3秒timer，逾時destroy該client stream並等待真正query callback/promise settle；adapter設定disposeExternalPool。不要只設pg.query_timeout或Promise.race後清timer，這會留下未中止操作。保留server statement2秒、lock1秒與idle transaction5秒。完整readiness／maintenance／registry／drain／LISTEN要各驗證。

Astra亦獨立透過實際新helper+adapter做cold-query黑洞，3013ms真正settle；錯誤為 `PrismaClientKnownRequestError`、`code=CONTROL_QUERY_TIMEOUT`、無meta。transient啟動重試必須辨識已知adapter transport錯誤，不能只接受舊native P1xxx；同時auth、schema、cipher錯誤保持fail-closed。驗收需黑洞恢復後自動ready、單一runtime啟動、不留下重複interval／worker／listener。
