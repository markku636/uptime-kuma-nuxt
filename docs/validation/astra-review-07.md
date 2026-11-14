# Astra 第七輪：分散式 runtime 與 phase5 邊界

日期：2026-11-14。唯讀 phase4A/B/C、push commit-result、state bridge、歷史／uptime consumers；未修改產品程式，未對共用 DB 跑寫入或中斷測試。

## 優先交 Sol 的可靠性缺口

lease/outbox 使用短逾時 `workerPrisma`，但 `MonitorWorker.run` 仍 `await isMonitorUnderMaintenance(...)`，後者使用一般 `prisma.maintenanceMonitor.findMany`，不接受 AbortSignal。若 DB 連線成為不 close 的 blackhole，lease watchdog 可 abort controller，但該 await 不會因此結束，run 進不了 finally，slot 與 drain 仍可卡住。這是讀碼證據，沒有在共用 production 人為造成黑洞。

同類旁路：runtime heartbeat／drain 最後的 WorkerInstance 寫入、ready probe 的 SELECT 1、StateBridge resync 都使用沒有 socket timeout 的一般 client。ready probe 可依 ingress/K8s timeout 被外部判失敗，但 server pending 工作並未因此自動取消；shutdown 不能無限等待。

要求短控制／health／maintenance queries 使用 bounded client 或同等實際 I/O timeout，保留 Bruno/migration 長工作 client。新增「黑洞發生在 maintenance read、ready、drain」案例，不能只用「HTTP 已送出後 renew 黑洞」的既有測試代表這些路徑也通過。

## 讀碼確認的修正機制

- claim/renew 使用 DB 時間、owner/token/run/configVersion；expired reclaim 沿用 runId，completion 鎖 monitor、原子 heartbeat/state/outbox，transaction 尾端再次檢查 lease。
- 前輪的 claim 晚回已同步 abort；pending renew 成功不在 finished 後重設 watchdog。Sol 回報另有真 PG process 與 blackhole cases，本輪沒有獨立重跑。
- outbox 使用 fenced claim/renew/ack，dispatch 前同 workspace 查 active channel，provider 收 AbortSignal，失敗分類與 retry 有上限；TLS 用 semantic dedupe key。
- push 寫入共用 commitMonitorResult，monitor row lock 保證狀態序列一致；API role不開worker，worker role僅允許probes。StateBridge使用hint+定期resync，授權在發送時重驗。

上述為讀碼確認，不取代 Sol 所報62/62 integration、unit30與多process socket/故障驗收；各結果應由 Sol 的分散式驗證報告記錄。

## 已重現的 phase5 計算錯誤

獨立 stdin module import 真 `calculateUptime`，只 stub `prisma.heartbeat.findMany`：UP 在 t=0（duration0）、DOWN 在 t=60秒（duration60），查詢前60秒。函式實際回 uptime=0、upMs=0、downMs=60000；正確前60秒是UP。原因是 heartbeat.duration 指距上一筆的時間，舊calculator卻把它配給當前狀態。這是既有read模型問題，不能直接把其結果做成永久rollup。

phase5 Spec採半開time segments、前置anchor、freshness上限與無觀測N/A，統一private/public/badge，而非繼續讓private時間、daily樣本比例、public LEAD時間三套結果不同。

## Phase5 必修的資料生命週期

1. `clear-heartbeats`只delete raw，MonitorState仍指舊heartbeatId；bridge找不到raw row就跳過。state必須自足，clear/retention後仍能回目前安全狀態。
2. TLS dedupeKey存在outbox；cleanup90天後刪除就會忘記同certificate/threshold已通知。支援365天threshold時，應另保留semantic dedupe或按certificate生命週期清理。
3. 列表全量50心跳、public row_number內層全掃、history offset+count、全scope socket掃描與picker全量依賴，不能只改API take上限。完整方案已寫 [phase5 🔵 Spec](../specs/2026-11-14-scale-read-retention.md)。
