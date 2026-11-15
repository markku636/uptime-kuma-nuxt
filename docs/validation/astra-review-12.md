# Astra 第十二輪：5B clear／background／TLS ledger

日期：2026-11-14，台北約 12:38–12:44。本輪唯讀審查產品 source，補文件與兩個獨立小 PG probe；沒有改產品碼、build、重啟或修改 app DB。Sol 仍唯一實作者。

## 新 finding：aggregator 也必須鎖後重讀 checkpoint

首讀 `rollupBatch` 是一個 statement 同時 JOIN checkpoint／first heartbeat 並 `FOR UPDATE OF m SKIP LOCKED`，然後直接以回傳的 joined metadata 規劃桶。即使所有 writer 都鎖 monitor，該 statement snapshot 仍可在 late transaction commit 前建立；late 在實際 LockRows 前已提交時，monitor 可被鎖到，但 joined checkpoint 仍是舊 snapshot。Late trigger 只更新 checkpoint，不改 monitor row，因此不能期待 monitor 的 locking recheck 自動刷新 joined row。

Astra 已以獨立全 migration DB、兩個連線、一個 monitor 重現：在隔離 DB 的 SELECT 加 200ms delay predicate 固定先後順序；另一 transaction 持 monitor lock 把 sealed 由 12:00 降至 10:00，在 SELECT 取得鎖前提交。locking SELECT 仍回 **12:00**，同 transaction 鎖後下一 SELECT 回 **10:00**。這是對 query snapshot／lock 順序的定向 probe，並非整個 aggregator 的負載測試。[astra-rollup-snapshot-probe.json](./astra-rollup-snapshot-probe.json) 記錄結果與 `cleaned=true`。

已交 Sol；本輪末最新 `rollup.ts` 改為 locking query 僅拿 IDs，再用下一 statement 重讀 checkpoint／first heartbeat／clearing 與 target，讀碼確認對症。完整 rollup race integration 仍由 Sol 收束。

## Clear／background 的讀碼結果

- `createClearHistory` 在同一 transaction 捕捉 workspace 的 cutoff 與 maxMonitorId；已有 pending/running job 時回既有 job。
- `processClearHistory` 使用共用 advisory lock、job lock、monitor lock；每 chunk 最多 1,000 raw 與 1,000 hourly rows。只刪 cutoff 前資料；新 observations 保留，current MonitorState 不刪除／不重設 revision。
- clearing flag／checkpoint generation、chunk delete、job progress 在同 transaction；未清完的 monitor 不前移 cursor。Rollup 在 clearing 時跳過，late trigger 拒絕已清區間的回填。
- POST 與 GET job API 均 require owner，GET 限 workspace；deletedRows 轉字串，不直接輸出 BigInt。UI 顯示非同步 job progress。
- 背景服務僅 worker/all role 啟動，API role 不跑 history maintenance；drain 等待 `history.stop()` 的既有 pending DB 工作。
- Root 已指出原每 5 秒只清 1 monitor 太慢。最新 background 每 tick 最多 32 chunks 且 loop 預算 2 秒，再做 rollup／retention；停止時不開始下一 chunk。本輪沒有重報舊問題，也沒有將該 bounded loop 推論成 4,000 清除時間或持續 ingestion 下 throughput 已驗。

本輪讀碼未發現 clear 會刪新資料或把 current state 損毀的確切漏洞；跨 worker、crash rollback、clear/retention/rollup 競爭的完整測試仍以最終 suite 為準。`tests/retention.integration.test.ts` 最新已有四項，涵蓋 raw/rollup 邊界、retention anchor／未 seal 不刪、first/existing late race、clear 保 current/new data、reader RepeatableRead 與並發 seal/retention。留存 `phase5B-retention-pass.log` 是早先 **3/3**，不能拿它宣稱最新四項均通過。

## TLS ledger 獨立小 PG 驗證

直接執行真 `commitMonitorResult` 與 `cleanupRuntime`，使用唯一 disposable DB 與 inactive monitor；不啟動 dispatcher、不發任何通知：

1. 365 天 threshold、certificate 尚有 300 天時建立一個 TLS outbox＋ledger。把 outbox 設已完成 100 天後 cleanup 刪掉 outbox；相同 certificate/threshold 再 commit，ledger 仍保留、沒有重建 outbox。
2. 新 certificate 在 completion transaction 最後故意 throw；heartbeat count、current-state revision、ledger、outbox 全數保持 rollback 前數值。
3. 隨後正常重試相同新 certificate，成功新增一個 ledger＋outbox，證明失敗交易沒有留下阻擋重試的 dedupe key。

三項斷言均通過，證據 [astra-ledger-rollback-probe.json](./astra-ledger-rollback-probe.json)。DB 連線已關閉、獨立 DB 已 DROP；沒有使用 app DB。此測試確認 durable 去重／原子性，不取代 provider delivery/retry/failure tests。

## 5C 路徑與數字來源

已把 `server/utils/origin-hint.ts`、`20261114052000_origin_hint` 及實際 worker/lease/completion/mutation 路徑補進 🔵 Spec。Hint 使用 HMAC，config/environment fence 清空；最終 concurrency gate 仍在 worker。

Source log 有兩個不同結果，不混寫：`phase5C-origin-benchmark.log` 為 500 monitors、claimed 1,570、deferred 1,070；較後 `phase5C-origin-fairness.log` 為 500 monitors、claimed **933**、deferred **433**（0.866/completed）、實際 inflight/TCP max **8**，16 秒左右完成。雖然檔名有 fairness，該 log 的可見測項仍是 **500 local monitors**；不能據此宣稱多 workspace／混合快慢 origin fairness 或完整 4,000 active 驗收已完成。
