# Astra 第六輪：phase3.5 複核與 phase4A 逾時設計

日期：2026-11-14。唯讀產品程式與 isolated unit；不修改產品程式／測試 DB。phase4A 仍在 Sol 實作中，不將 WIP 當完成宣告。

## Phase3.5 複核

讀取 `resource-secrets.ts`、`resource-input.ts`、`resource-probe.ts`、notification sender/transport/五個 provider、共用 resource UI、backup 與 consumer。前輪四資源 GET/POST/PUT 都已接 whitelist DTO，沒有再回傳 config/password/URL/envelope。row lock 後重讀合併、AAD type/workspace/id、sealed residue backfill、probe 安全分類均與 Spec 對應。email placeholder 現明確 `UNSUPPORTED_PROVIDER`。

獨立執行 `node --import tsx --test tests/resource-secrets.test.ts`：3/3 通過，覆蓋四資源清除明文與 DTO、AAD 換置拒絕、preserve/clear/replacement 語意。本輪未重跑 Sol 所報的 46/46 production/PG/browser suite；詳 [Sol 驗證](resource-secrets.md)。目前未發現新的確切 raw-secret 洩漏，不代表所有路徑已獨立全面驗證。

檢視 workspace 切換實作會 `window.location.assign('/dashboard')`，因此共用 resource editor 在正常切換時完整卸載；沒有把「未在該 component watch scope」直接當成已證實的跨 workspace 秘密殘留。

## Phase4A watchdog 建議

worker 已用 monotonic claim/renew send time、獨立 lease watchdog 與 HTTP AbortSignal，方向正確。已回報兩個 WIP 邊界：claim 回應時若安全期限已過應同步 abort，不留最少 1ms timer window；run finally 後 pending renew response 不應重新 arm timer，需 finished guard。是否修正與 fault integration 通過另待下一輪確認。

本機 Prisma 6.19.1 內建 connector 的官方逾時支援、單位、worker client 隔離與黑洞驗收已寫 [Prisma timeout reference](../PRISMA_TIMEOUT_REFERENCE.md)，避免將 pool_timeout、interactive transaction timeout 誤當網路分區時的 HTTP 中止保證。
