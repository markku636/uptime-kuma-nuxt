# Astra 第十一輪：5B rollup／retention 鎖定契約

日期：2026-11-14，台北約 12:25–12:32。審查共享工作樹中的 5B WIP。Astra 僅修改文件並操作自己建立、最後刪除的極小測試 DB；沒有改產品碼、build、重啟服務或接觸 `uptime_kuma` app DB。Sol 是唯一實作者。

## 已發現並交付修正的三個 race

### 1. Late insert 在 seal 期間漏掉 invalidation

原 `20261114051000_hourly_rollups` trigger 先無鎖讀 checkpoint，只有 `NEW.time < 舊 sealed_before` 才取得 monitor lock。Aggregator 已鎖 monitor 並計算／寫入至 11:00、尚未提交；另一 transaction 插入 10:30 時，看到舊 sealed=10:00 或根本看不到新 checkpoint，就跳過 invalidation。FK 等待 monitor lock 在 BEFORE trigger 之後發生，不會補跑已跳過的判斷。

Sol 追加 `20261114051500_history_lock_contract`，先鎖 monitor，再讀／鎖 checkpoint，並在同鎖內判斷 rawDeletedBefore 與 sealedBefore；保留已套用的舊 migration 不改 checksum。

**Astra 獨立真 PG 對照**：以任務授權的 localhost:55464 admin 另建唯一 `uptime_astra_*` DB，完整 migrate；兩個工作連線、4 monitors／4 heartbeats。只在這個拋棄 DB 切換 repository 中原 51000 與新 51500 的真 function，讓第一連線持有 monitor lock／未提交 seal，第二連線插入 10:30，最後放行第一連線。

| Function | 已有 checkpoint | 首次建立 checkpoint |
| --- | --- | --- |
| 51000 原版 | sealed 留在 11:00、generation=1，漏失效 | sealed 留在 11:00、generation=1，漏失效 |
| 51500 修正版 | sealed 降至 10:00、generation=2 | sealed 降至 10:00、generation=2 |

證據：[astra-rollup-race-probe.json](./astra-rollup-race-probe.json)。兩次獨立小 DB 均在 finally 關閉連線並 DROP；最終報告 `cleaned=true`。此結果直接驗證 trigger 競態修復，不等同整個 rollup／clear lifecycle 已通過。

### 2. Reader 混用不同 snapshot，跨 raw／rollup 接縫漏資料

原 `uptimeWindows` 分別讀 checkpoint、raw、hourly。若讀到 sealed=10:00 後，另一 transaction seal 至 11:00 並 retention 刪掉 11:00 前 raw，reader 仍把 10:00–11:00 當 raw 區，會缺資料；clear 在多段讀之間進行也有相同一致性問題。

最新 `rollup-reader.ts` 將全部讀取放進同一 `RepeatableRead` transaction（timeout 10 秒、maxWait 2 秒），讀碼確認使用同一 tx client。raw 與完整 sealed buckets 的切分仍互斥；左右不足整點部分讀 raw，已刪 raw 的舊範圍向外整點對齊並回 `precision/rangeStart/rangeEnd`。此項本輪為讀碼覆核；尚未獨立安排 reader 與 retention／clear 的競態 integration。

### 3. Retention 未與 late invalidation 使用同一 monitor lock

原 retention 只有與 rollup 共用的 advisory lock＋heartbeat row locks。它可先依舊 sealed=12:00 選中並刪 cutoff=11:00 以前資料，再等待 late-insert transaction 釋放 checkpoint；late 已把 sealed 降到 10:00，retention 仍直接設 rawDeletedBefore=11:00，使必須重建的區間失去 raw。

最新 `retention.ts` 先取得最多 32 個 monitor locks，鎖後在 DELETE 候選 SQL 再驗 sealedBefore／clearing，並使用 `GREATEST(raw_deleted_before, cutoff)`。後者也避免 partial backlog 尚在時調高 rawHours，令已刪除邊界倒退而錯誤允許無法完整重建的 late insert。讀碼確認修正；真 late／retention／clear 互鎖測試待 Sol checkpoint。

## 本輪未當作完成的部分

初讀時 `clear-history.ts`、`background.ts`、runtime 接線及 TLS ledger 消費尚在實作中，沒有將未完成接線列作新漏洞，也不宣稱已驗收。下一穩定點仍需核對：clear generation／cutoff、crash rollback 後 checkpoint 連續性、durable TLS ledger 與 outbox 同 transaction、cleanup 不重新通知、背景工作 bounded stop/drain。具體路徑已補至 phase5 🔵 Spec。

## Root 576 萬筆讀取量測來源與邊界

Root 已完成獨立 fixture 並確認其 DB 刪除；Astra 讀取了 [read-path-benchmark.json](./read-path-benchmark.json)，沒有重跑大型 fixture。

- 4,000 paused monitors × 1,440 samples，共 5,760,000 raw rows。
- 20 次 warm samples：list 100 rows p95 **5.12 ms**；recent 100×20 p95 **8.48 ms**；raw 24h／100 monitors p95 **304.73 ms**。
- DB 約 **1.298 GB**；heartbeat table 約 **536 MB**、indexes 約 **751 MB**。這是 minimal synthetic payload，沒有完整 assertion detail／runId 等真實 row 負載。
- EXPLAIN recent 走 `(monitor_id,time,id)` index，每 monitor LIMIT 20，100 loops／2,000 rows；history LIMIT 50。報告 Node 為 v20.20.0，並非尚未部署的 Node24 cluster runtime。

這是直接 DB helper／SQL 的 warm 讀取結果，沒有 HTTP、並發 workload 或 active 4,000 scheduler，不能拿來替代 phase6 的 API latency、4000 active steady/fault、實際儲存容量與 K8s 證據。原始 log：`.data/validation-logs/root-read-path-benchmark.log`；JSON `cleanup.dropped=true`，root 另有獨立刪庫確認。
