# Bruno 整合驗證（2026-11-14，phase3）

> 證據時間註記（2026-11-14 13:29 修訂）：以下為該階段當時結果，並非目前整個 working tree 的通過宣告。11:56 主機重啟後早期 `/tmp` logs 已遺失，保留歷史摘要但不可再聲稱原始 logs 可供查閱。最新狀態見 [證據索引](EVIDENCE_INDEX.md)。使用者已取消 4000 活躍負載驗證；既有相關 fixture 數字僅保留歷史意義。

已使用官方 @usebruno/lang 0.41.0 parser 完成 declarative subset；完整支援／拒絕矩陣見 ../BRUNO_COMPATIBILITY.md。匯入預覽不寫資料／不發網路請求，HMAC 綁定 scope、環境版本、source identity 與 monitor configVersion；commit 同一 PostgreSQL transaction 建立／替換 paused monitors。秘密以既有 AES envelope 封存，靜態變數拒絕 secret 降級。

- Node 24.22.0，真 PostgreSQL 16.14；fresh `npm ci` 成功，root postinstall 明確執行 Prisma generate 與 Nuxt prepare。log `/tmp/uptime-phase3-ci.log`。
- `npm test` 25/25 通過；包含官方 parser fixtures、宣告式斷言、scope 優先序、direct/indirect secret taint、opaque 既有秘密、placeholder export round trip。
- 全部 integration 共 40 項：其他 39 項通過（含 assertion Chrome）；唯一瀏覽器 locator 問題修正後，單獨重跑該真 Chrome 測試 1/1 通過。logs `/tmp/uptime-phase3-integration-final.log`、`/tmp/uptime-phase3-browser-final.log`。本輪未重複全套；合計涵蓋 auth/workspace/assertions/Bruno/migration/bootstrap 與兩條 browser 流程。
- 真 PG 覆蓋：preview 零寫入／零 outbound、保留身份 create/skip/replace、stale monitor edit/env/scope preview 拒絕、viewer/read key mutation 拒絕、251 筆中第二批 DB 故障使前 250 筆與環境變更全部 rollback、4,000 個同名異路徑 request 原子匯入且全部 paused。最後 4,000 筆耗時約 2,874ms，只有本機 fixture，非排程效能數字。
- Chrome 真實操作 collection directory → preview → import paused → editor 試跑同一 typed assertions，無 pageerror；截圖 `/tmp/uptime-phase3-bruno-preview.png`。這是本機 Playwright CLI 驗證，**未經 MCP 驗證**。
- Production Nuxt build 通過（34.8MB）；typecheck 當時記錄 114 個診斷（未完整分類 baseline 差異，不能全部稱為既有），新增 Bruno helpers/routes/UI 無診斷；不得宣稱全站 typecheck 通過。logs `/tmp/uptime-phase3-build.log`、`/tmp/uptime-phase3-typecheck.log`。

當時已知後續（歷史紀錄，後續進度見證據索引）：分散式 lease/fencing/outbox/4000 活躍排程仍待 phase4–6。Astra review05 揭露四類共用資源原始憑證 DTO，依 phase3.5 Spec 先修復，再接 scheduler。舊 email provider 仍是假傳送，下一階段必須明確拒絕或實作。
