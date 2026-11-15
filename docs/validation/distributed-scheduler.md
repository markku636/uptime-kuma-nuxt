# PostgreSQL 分散式排程驗證（2026-11-14，phase4）

> 證據時間註記（2026-11-14 13:29 修訂）：以下為該階段當時結果，並非目前整個 working tree 的通過宣告。11:56 主機重啟後早期 `/tmp` logs 已遺失，保留歷史摘要但不可再聲稱原始 logs 可供查閱。最新狀態見 [證據索引](EVIDENCE_INDEX.md)。使用者已取消 4000 活躍負載驗證；既有相關 fixture 數字僅保留歷史意義。

本輪以 PostgreSQL lease/fencing、有限 worker/outbox、API/worker role、跨 API 的安全 current-state resync 取代每 monitor 的 setInterval。僅 HTTP、keyword、JSON Query 進新排程；push 走同一 accepted-result transaction，其餘 legacy checker 配置保留但明示尚需 bounded worker adapter，不會偷偷回舊 scheduler。請配合 [runtime 操作文件](../CLUSTER_RUNTIME.md) 與 [Spec](../specs/2026-11-14-distributed-scheduler.md)。

環境 Node24.22.0、PostgreSQL16.14，獨立 loopback DB／HTTP／notification fixtures；沒有對外站壓測、正式部署或真外部通知。

- 首輪完整 integration **62/62**，log `/tmp/uptime-cluster-all-final.log`；追加 retry、UI、blackhole 後一次完整 **65/66**，唯一失敗為新發現的真 TCP blackhole drain，log `/tmp/uptime-cluster-control-all.log`。不可把後者說成66項通過。
- Unit **30/30** 通過；phase5 cursor 初步單元另1項，共31。最終整套結果待下方追記。
- 真多 process：SKIP LOCKED claim race、同run冪等、過期重領沿用runId並增加token、舊結果／TLS／續租零接受；claim後、HTTP後、completion transaction中、commit後各有 process crash 與 rollback／outbox接手。
- 真 HTTP：pause／environment修改／遠端 API pause/edit 廢止舊lease，實際hang socket關閉；有限重試3次只寫1 heartbeat；300ms總deadline關閉真socket後只接受1 TIMEOUT。claim延遲超租期零outbound，晚renew不復活finished run。
- 真 outbox：獨立process競爭、過期重領、stale ACK、有限timeout/backoff/deadletter、disable取消、workspace defaults隔離、TLS threshold去重。SMTP placeholder明確unsupported，不當成delivered。payload／heartbeat／socket無request/response sentinel。
- 真 production 兩API+一worker：API不執行checks，worker僅暴露probes；兩API socket均收到同一accepted state；終止本測試DB專用LISTEN後resync重連；idle viewer撤權不再收到資料，同user跨env隔離；push寫入任一API兩端皆收到。
- 500個本機200ms endpoints、兩個獨立workers：**15,057ms**完成，實際HTTP inflight max8、實際TCP sockets max8、每worker max slots≤8；claimed4,154、deferred3,654。這是bounded smoke，**不是4,000 active或steady-state效能驗收**。忙origin重複claim成本留phase5C。log `/tmp/uptime-cluster-control-all.log`。
- 真4,000 monitor／16 due／claim8的EXPLAIN見 `scheduler-queue-plan.json`：due partial index只讀8rows、8次PK lookup，planning0.218ms／execution0.241ms；不是大型歷史資料計畫的替代證據。
- Chrome runtime UI驗platform admin實際instance/role/inflight、workspace owner無cluster actions；截圖 `/tmp/uptime-runtime-browser.png`已目視檢查，**Playwright CLI，未經MCP驗證**。
- fresh/legacy migration與完整既有auth/workspace/assertion/Bruno/secrets回歸涵蓋；所有背景checks都在security bootstrap成功後啟動，壞sealed envelope 503且零outbound。

## 黑洞發現與修復

原native Prisma6.19.1 client即使設socket_timeout=3，registry的新raw UPDATE（含RETURNING）在本機真TCP黑洞仍超15秒不settle。沒有以Promise.race釋放尚未終止的操作。改用官方 `@prisma/adapter-pg@6.19.1` 控制client，專用pg pool預設3，connection/pool acquire2秒，query3秒deadline時**實際destroy自有socket**；同時server statement2秒、lock1秒、idle transaction5秒。一般API/Bruno native client保留長transaction能力。

LISTEN idle `client.end()` graceful FIN也可能等不到黑洞對端，shutdown/reconnect實際destroy專用listener stream再await end。runtime registry/heartbeat/drain、health、maintenance/config與socket/state permission讀取皆用bounded control client。

修後故障切片 **3/3** 通過，`/tmp/uptime-control-adapter-blackhole.log`：HTTP watchdog914ms關閉真socket；黑洞發生在maintenance query前，零outbound／零heartbeat，query與finally relinquish結束後6,250ms釋放slot；source runtime（API role）黑洞drain在4秒觀察時已complete（測試4,215ms）。production readiness/SIGTERM與整套回歸待下方最終追記。

限制：HTTP外部副作用不是exactly once，crash後可能重試同run，DB accepted result/outbox以fence與unique key保證。不能混跑舊scheduler binary；rollback不得刪除lease/state/outbox資料。大規模讀路徑、rollup/retention、K8s及4,000 active負載另有階段驗收。最新完整typecheck仍有110項診斷，包含legacy與新schema/DTO造成的consumer差異，不能全部稱既有；後續逐檔分類修正，未宣稱全站通過。

最終控制client回歸：`/tmp/uptime-control-adapter-all.log` **68/68 PASS**，89,873ms。包含production黑洞readiness/SIGTERM、source冷連線黑洞後自動恢復（3,241ms）、所有之前列出功能。`/tmp/uptime-control-adapter-build2.log` production build通過。pg pool的code-less三種已知connect/acquire timeout精確映射CONTROL_CONNECT_TIMEOUT，避免把所有Error重試；驗收顯示一次initialization failure後自動ready。一般auth/schema/constraint仍不重試。
