# 共用資源秘密驗證（2026-11-14，phase3.5）

四表新增 resource_secrets AES-GCM envelope；AAD 綁定版本、資源類型、workspace、ID。建立前 reserve ID 並在 transaction 封存，legacy 欄位只留 null／空字串／空物件。DTO 使用明確白名單，只回安全 metadata 與 configured flags。更新鎖 row 後重讀／合併，省略保留、明確 clear、replacement wins；test 與 save 共用同一 helper。

通知整份 config atomic replace，改 provider 要新 config 或 clear。五個實際 provider 共用有 10 秒總 deadline、1MiB 回應上限、DNS pin、零 redirect 的原生 HTTP transport。既有假 SMTP provider 明確 UNSUPPORTED_PROVIDER，不會宣稱 delivered。新 UI 僅提供實際支援的五種傳輸；既有其他 provider 可看 metadata，測試不會假成功。四 settings pages 與 dialogs 共用 write-only editor，通知 TLS 全域設定區保留。

驗證環境 Node24.22.0／PostgreSQL16.14，本機 production build + loopback fixture，沒有真外部通知。

- Unit **28/28** 通過（新增 envelope/AAD/clear-preserve-merge）。log `/tmp/uptime-resource-unit.log`。
- 完整 integration **46/46** 通過，約23.8秒。log `/tmp/uptime-resource-integration-final.log`。包含全部既有 auth/workspace/assertions/Bruno/migration/bootstrap，以及四資源 owner/editor/viewer/read-key DTO／mutation／cross-workspace matrix。
- 新真 PG 測試驗證 create/update 回應及 raw DB 無 plaintext sentinel／密文 DTO；by-ID 真通知/Docker/browser local I/O；錯誤 body/CDP capability 不回傳；rename、並行 rename+replace、clear+replace、provider change、backfill idempotence/residue/missing-key/AAD。
- 兩類 bootstrap 壞 envelope（monitor/resource）都實際啟獨立 process：HTTP503 且零 outbound check。fresh/legacy migration 都用宣告 SQL，不用 db push。
- 真 Chrome：notification 與 browser create → rename → reload → test-by-ID → replace → clear，viewer 四頁均無 add/edit/test/delete，沒有 pageerror。截圖 `/tmp/uptime-resource-browser.png` 已目視檢查；Playwright CLI，**未經 MCP 驗證**。
- Nuxt production build 通過（32.3MB）；typecheck **110 個既有診斷**，本輪新增 helpers/DTO/UI 無診斷；不宣稱全站 typecheck 通過。logs `/tmp/uptime-resource-build-final.log`、`/tmp/uptime-resource-typecheck-final.log`。

第一次完整 suite 因測試共用 loopback IP 累積超過預設 login20/min 而收到429；未修改產品預設，改以既有 LOGIN_RATE_LIMIT=200 環境設定重啟本機測試 server 後，完整46項通過。此 override 僅本機測試，不是 production 部署建議。第一輪 browser clear case 是測試在前次保存尚未完成便再次點 Edit，已加 UI saving guard 與等待表單關閉後重跑通過。

限制：editor 是可信的秘密使用者，可改目的地／執行請求，封存與 write-only 並不保證秘密無法由惡意 editor 外送。新 lease/outbox 尚待 phase4；不可混跑舊 binary，回退不得直接將封存後空欄當有效設定。
