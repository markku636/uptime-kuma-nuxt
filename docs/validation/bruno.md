# Bruno 整合驗證（2026-11-14，phase3）

已使用官方 @usebruno/lang 0.41.0 parser 完成 declarative subset；完整支援／拒絕矩陣見 ../BRUNO_COMPATIBILITY.md。匯入預覽不寫資料／不發網路請求，HMAC 綁定 scope、環境版本、source identity 與 monitor configVersion；commit 同一 PostgreSQL transaction 建立／替換 paused monitors。秘密以既有 AES envelope 封存，靜態變數拒絕 secret 降級。

- Node 24.22.0，真 PostgreSQL 16.14；fresh `npm ci` 成功，root postinstall 明確執行 Prisma generate 與 Nuxt prepare。log `/tmp/uptime-phase3-ci.log`。
- `npm test` 25/25 通過；包含官方 parser fixtures、宣告式斷言、scope 優先序、direct/indirect secret taint、opaque 既有秘密、placeholder export round trip。
- 全部 integration 共 40 項：其他 39 項通過（含 assertion Chrome）；唯一瀏覽器 locator 問題修正後，單獨重跑該真 Chrome 測試 1/1 通過。logs `/tmp/uptime-phase3-integration-final.log`、`/tmp/uptime-phase3-browser-final.log`。本輪未重複全套；合計涵蓋 auth/workspace/assertions/Bruno/migration/bootstrap 與兩條 browser 流程。
- 真 PG 覆蓋：preview 零寫入／零 outbound、保留身份 create/skip/replace、stale monitor edit/env/scope preview 拒絕、viewer/read key mutation 拒絕、251 筆中第二批 DB 故障使前 250 筆與環境變更全部 rollback、4,000 個同名異路徑 request 原子匯入且全部 paused。最後 4,000 筆耗時約 2,874ms，只有本機 fixture，非排程效能數字。
- Chrome 真實操作 collection directory → preview → import paused → editor 試跑同一 typed assertions，無 pageerror；截圖 `/tmp/uptime-phase3-bruno-preview.png`。這是本機 Playwright CLI 驗證，**未經 MCP 驗證**。
- Production Nuxt build 通過（34.8MB）；typecheck 尚有 114 個既有診斷，新增 Bruno helpers/routes/UI 無診斷；不得宣稱全站 typecheck 通過。logs `/tmp/uptime-phase3-build.log`、`/tmp/uptime-phase3-typecheck.log`。

已知後續：分散式 lease/fencing/outbox/4000 活躍排程仍待 phase4–6。Astra review05 揭露四類共用資源原始憑證 DTO，依 phase3.5 Spec 先修復，再接 scheduler。舊 email provider 仍是假傳送，下一階段必須明確拒絕或實作。
