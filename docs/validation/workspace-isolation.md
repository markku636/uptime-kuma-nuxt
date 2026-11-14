# Workspace / Environment 驗收（2026-11-14）

狀態：核心API、DB遷移與Socket隔離已驗收；環境變數實際HTTP插值接續API assertions階段；瀏覽器與完整負載在後續整合驗收。未經MCP驗證。

測試環境：Node24.22.0、Prisma6.19.1、PostgreSQL16.14；本機隔離DB localhost:55464，沒有正式環境變更。

- `npm run build`：production build成功，33.8MB。
- `tests/auth.integration.test.ts` + `tests/workspace.integration.test.ts` 對production HTTP / Socket.IO：17/17通過。
- `tests/migration.integration.test.ts`：4/4通過。真正新建/移除 disposable databases；fresh migrations、legacy user/monitor/heartbeat/tag保留與personal/default回填、partial未知schema拒絕、跨owner關聯fail-closed且原關聯及資源不變。
- `tests/setup.integration.test.ts`：2/2通過。production子process兩個匿名setup競爭只建一個admin；公開default session password同步阻止啟動。
- `tests/auth.test.ts` + `tests/variables.test.ts`：3/3通過。ticket簽章/TTL、AES-GCM密文/AAD防篡改與缺key拒絕、安全靜態變數替換。
- 全庫typecheck目前117個既有診斷（原始453）；新增workspace/principal/crypto/public-status/backup/UI檔無診斷。未宣稱全庫typecheck通過。

17個HTTP/Socket案例涵蓋同user兩workspace、同workspace兩environment、monitor所有detail/mutation/history/uptime/certificate入口、tag/notification/proxy/parent跨scope關聯拒絕且transaction無部分寫入、status-page group跨scope與title rollback、maintenance關聯與pause/resume、viewer/editor/owner/platform admin、最後owner保護、read-only API key與workspace/environment pinning、停用/expired key、env secret sentinel、公開status/badge及三種heartbeat alias、backup export去secret、import外部ID原子rollback、同user socket跨workspace/env隔離，以及會員撤銷後idle socket零事件且舊key被撤銷。

實際遷移檔：`prisma/migrations/20261114000000_baseline/migration.sql`、`prisma/migrations/20261114010000_workspaces/migration.sql`。`node scripts/migrate.mjs`先驗legacy核心欄位/型別/外鍵，再baseline resolve；未知partial schema不猜測。跨owner/懸空關聯只輸出ID修復報告並中止，不自動刪除。請先備份，由管理者明確修復資料後再遷移。DB schema不由每個app replica執行db push。

本輪修復過程曾抓到兩個會被單純build漏掉的錯誤：Prisma queryRaw無法讀取PostgreSQL advisory lock的void欄位，改用executeRaw；Nitro2不等待async plugin的throw，改同步secret檢查及明確bootstrap request gate。上述2個production子process測試可防回歸。

已加入workspace/environment selector、members/env變數管理、新account管理（platform admin）、viewer監測修改控制與API key read/write/env選擇。切換scope執行完整頁面重建，清除舊socket/store。舊socket mutation明確REST_REQUIRED；現有頁面使用的subscribe/unsubscribe保留。

備份為安全且paused的restore：不匯出headers/body/secret或URL query原值，restore不重建這些credentials，需使用者另行配置；overwrite明確409，避免不明確覆寫同名資源。Bruno有獨立preview/create/replace/skip流程於下一階段處理。

本機log摘要來源：`/tmp/uptime-phase1-{build,production-integration,migration-test,setup-test,typecheck}.log`。沒有外部API/通知壓測。
