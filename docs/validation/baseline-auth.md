# Baseline / Auth 驗收（2026-11-14）

範圍：Spec 首輪切片。公開 status/badge/RSS 投影與 workspace 隔離仍待下一階段，整份 auth Spec 未宣稱完成。

- 來源 SHA：896c4575f22bf58119b85792b929b6ecb30a1bbd；Node v24.22.0、Nuxt 4.2.2、Prisma Client 6.19.1、PostgreSQL 16.14。
- 原始 `npm ci` 失敗：lock 缺少 package.json 的 vuedraggable / sortablejs。預設 Node20 亦不符合 ping>=22。已更新 npm lock 並新增 tsx；yarn.lock 保留原樣，以 npm 為本次驗收包管理器。
- 原始 `npm run build`：成功，輸出48.4 MB；原始 `nuxt typecheck`：453個既有TS診斷（UI v4 colors、schema drift、缺型別等），未將全庫型別檢查標為通過。
- 修改後 typecheck：170個診斷（移除舊socket與認證型別漂移後減少283）；仍未全庫通過，新helper的一筆session user型別以shared宣告修正。
- 修改後 production build：成功，輸出33.8 MB。移除第二套未鑑權socket server，舊socket mutation明確回覆REST_REQUIRED，頁面現有訂閱流程保留。
- Prisma schema validate/generate/db push：成功；目前只在獨立本機測試DB `127.0.0.1:55464/uptime_kuma` 建表，正式遷移檔在workspace階段補齊，未改production。
- `tsx --test tests/auth.test.ts`：1/1通過（簽章、有效期、偽造identity、過長ticket）。
- `DATABASE_URL=... tsx --test tests/auth.integration.test.ts`：7/7通過；真PG + production HTTP `127.0.0.1:32510` + 真Socket.IO，沒有mock principal。

整合測試涵蓋：匿名/private/exact-path auth bypass；兩user的monitor GET/PUT/DELETE/clone/pause/resume越權；headers非空建立monitor；新API key只存hash且無cookie可用；stored hash不可當bearer；錯誤key不借cookie升權；expired/inactive key；列表不含URL query/basic password/header secret；匿名/偽造socket拒絕；socket foreign monitor拒絕；停權cookie與socket失效；logout撤銷既有socket和未過期ticket。

本輪未執行MCP瀏覽器驗證。無外站壓測、通知或production操作。原始工具log位於本機 `/tmp/uptime-kuma-baseline-{install,build,typecheck}.log`、`/tmp/uptime-phase0-{build,prisma,integration,server}.log`，此文件保存可審閱摘要，log本身不納入repo。
