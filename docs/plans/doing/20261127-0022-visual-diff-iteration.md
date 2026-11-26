# SealWatch visual-diff 持續迭代紀錄

- 截止時間：**2026-11-27 20:00 CST**
- 交付定義：每輪 commit + 部署 lab（共用工作樹，只 `git add` 自己動的檔；保留 hooks，不用 `--no-verify`）
- 核准預設：`visual-diff`／先公開頁＋既有 basic auth／閾值先從嚴
- 主計劃：[`20261125-2356-visual-diff-monitor-type.md`](./20261125-2356-visual-diff-monitor-type.md)

格式：`R<n> ✅/❌ 標題 — commit／lab 映像／驗證證據`

---

## R0 ✅ 開工設定（2026-11-27 00:22 CST）

- 把截止時間與核准條件寫進主計劃第一行，狀態改 🟢。
- 建立本紀錄。
- 確認工作樹：只有主計劃檔未追蹤，別人的 Bruno 變更已提交；`git log` 最新 `8baf0c2 docs(bruno): record R65 final verification`。
- 驗證：`date` = 2026-11-27 00:22:56 CST；`git status --short` 如上述。
- commit：無（文件與 R1 一起提交）。

## R1 ✅ 資料模型與 API 基礎（00:30–00:45 CST）

- 做什麼：`visualConfig` JSONB + `VisualBaseline` / `VisualCheckArtifact` 兩表與 migration；zod 設定驗證（strict、viewport label 唯一、安全預設）；串進 `monitor-input`／DTO 白名單／`scheduleSupported`／POST+PUT 的 URL 必要檢查；`MonitorType.VISUAL_DIFF`；Spec 🔵。
- commit：`d4e0a2d feat(visual-diff): add config schema and database foundation`（12 檔）。
- 驗證：`node --import tsx --test tests/visual-config.test.ts` 6/6 pass；`DATABASE_URL=... npx prisma validate` valid；`npm run typecheck` exit=0；`npx prisma generate` 成功。
- 修過的失敗：首輪 unit test 抓到 `maxDiffPixels` / `waitForSelector` parse 後是 `undefined` 而非 `null`，已加 `.default(null)` 修正後全綠。
- lab 部署：❌ 阻塞，未部署。`deploy_get_status` = Degraded（api/worker 都 0/2 ready）；`deploy_diagnose` 顯示 pod Pending、`uptime-worker` ContainerStatusUnknown、node `testing-machine` DiskPressure；`deploy_delivery_status` = blocked（release 無關聯專案、values 無 image repository）。依規則不繞過、不在故障中的 lab 硬推上線，留待使用者決定。

## R2 ✅ 版面規則與像素比對純函式（00:28–00:31 CST）

- 做什麼：`visual-layout-rules.ts`（可解釋規則失敗）、`visual-pixel-diff.ts`（pixelmatch + ignore rect + 尺寸不符判定）；新增 `pixelmatch`/`pngjs`/`@types/pngjs`；11 個 table-driven 測試。
- commit：`067aa3a feat(visual-diff): add pure layout-rule and PNG diff evaluators`（6 檔）。
- 驗證：兩個測試檔 11/11 pass；`npm run typecheck` exit=0。
- 修過的失敗：測試自己的 viewport（100×100）低於 schema 下限（320×400），改測試設定後全綠；`npm install` 誤改 `yarn.lock`（Dockerfile 實際用 `npm ci`），已從 HEAD 還原，只留 `package.json` + `package-lock.json`。
- lab 部署：沿用 R1 阻塞，未重試（同一故障，不空等）。

## R3 ✅ Checker 接上真瀏覽器與派工鏈（00:31–00:36 CST）

- 做什麼：`visual-diff-checker.ts`（每 viewport 量測版面／截圖／基準建立與失效／artifact 寫入，可注入 DB 與 browser，尊重 AbortSignal）；註冊到 `checkers/index.ts`、`checker.ts` 的 switch、`types.ts` 的 condition 定義；真 Chrome 整合測試跑完整流程。
- commit：`9ee3322 feat(visual-diff): wire real-browser checker into monitor dispatch`（5 檔）。
- 驗證：真 Chrome 流程測試 1/1 pass；`npm test` 全套 175/175 pass；`npm run typecheck` exit=0。
- 修過的失敗：Prisma Bytes 需 `Uint8Array`（不是 Buffer）、server 端 typecheck 無 DOM lib（改走 `globalThis as any`）、`metrics` 需 `Prisma.InputJsonValue`；都已修正。
- lab 部署：沿用阻塞，未重試。

## R4a ✅ 基準接受與差異查詢 API（00:36–00:39 CST）

- 做什麼：`VisualCheckArtifact.currentImage` 欄位＋migration；`GET /api/v1/monitors/[id]/visual-artifacts`（bounded limit、base64 current/diff/baseline、stale 旗標）；`POST .../visual-baselines/accept`（workspace 限定、sha256、configVersion 對齊）。
- commit：`cd94fbe feat(visual-diff): add artifact read and baseline accept APIs`（5 檔）。
- 驗證：`prisma validate`、`prisma generate`、`npm run typecheck` exit=0、`npm test` 175/175。
- 偏差：repo 沒有 audit log 機制，接受基準未寫 audit；如實記錄，需使用者決定是否另建。
- lab 部署：沿用阻塞，未重試。

## R4b ✅ 表單與篩選（00:39–00:44 CST）

- 做什麼：`MonitorForm.vue` 加 `visual-diff` 選項（標為 scheduled）、URL 欄位、viewport／必要元素／忽略區塊／各閾值／基準策略表單與客戶端檢查；`MonitorListFilter.vue` 加篩選選項。
- commit：`3fec193 feat(visual-diff): add monitor form fields and filter option`（2 檔）。
- 驗證：`npm run typecheck` exit=0；`npm run build` exit=0（`.output` 33.7 MB）。
- 修過的失敗：`v-for` 的 index 是 `string | number`，移除函式改接受聯集並 `Number(index)`。
- 瀏覽器驗證：❌ 本機無 `.env`／Postgres，dev server 的 security bootstrap 因缺 `DATABASE_URL` 失敗（log: `logs/dev-server.log`），無法登入後台看表單；此為環境限制，不是 build/型別失敗。已停止我啟動的 dev server。
- lab 部署：沿用阻塞，未重試。
