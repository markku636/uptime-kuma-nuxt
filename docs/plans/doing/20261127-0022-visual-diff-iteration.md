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

## R6 ✅ 排程缺口與周邊流程（00:44–00:50 CST）

- 做什麼：補上 **worker 認領SQL**、`supportedScheduledTypes`、runtime queue 查詢、兩個 serializer 的 `visual-diff`（漏掉這些 monitor 永遠不會被執行）；backup 匯出加 `visualConfig`；retention 一併清 `VisualCheckArtifact`；加 regression test 證明 `claimMonitors` 能認領 `visual-diff`。
- commit：程式碼被同時處理 DiskPressure 的 session 連同它的文件一起提交在 `1f73fa0 docs: record R97 DiskPressure incident and prune hardening`（內容已核對都在，訊息不是我下的）。
- 驗證：typecheck exit=0；`npm test` 176/176（含新測試）。
- clone/runtime：`clone.post.ts` 與 `resolveMonitorConfig` 都是整列展開，`visualConfig` 會自動帶過去，無需改；trial API 仍不支援 visual-diff（未做試跑按鈕）。

## R7 ✅ 檢查器健韌性（00:50–00:52 CST）

- 做什麼：checker 改用 `workerPrisma`（bounded pool，與 worker 一致）寫入基準／結果；`AbortSignal` 觸發時直接關掉 page，避免 lease 被佔到自然 timeout。
- commit：`dc42bba fix(visual-diff): use bounded worker DB and abort page on deadline`。
- 驗證：typecheck exit=0；`npm test` 176/176（含真 Chrome 流程測試）。

## R8 ✅ 執行環境（00:52–00:54 CST）

- 做什麼：Dockerfile runtime stage 安裝 Chromium 與共享函式庫、設 `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` 並讓 node 使用者可讀；否則上線後每次檢查都找不到瀏覽器。
- commit：`cef572a fix(visual-diff): ship Chromium in the runtime image`。
- 驗證：本機無 Docker，無法實際 build image；此項**未經映像建置驗證**，留待 CI 確認。
- lab 部署：仍未部署（blocked）。

## R9 ✅ 使用者文件（00:54–00:55 CST）

- 做什麼：Spec 狀態改 ✅；新增 `docs/visual-diff-monitor.md`（怎麼建、各欄位建議、怎麼看結果與接受基準、fullPage／動態內容的坑）。
- commit：`ecffe8a docs(visual-diff): mark spec implemented and add user guide`。

## R10 ✅ API 回應與接受基準收緊（00:55–00:56 CST）

- 做什麼：差異查詢只回每個 viewport 最近一筆（base64 圖片很大）；接受基準時驗證 viewport 確實在 monitor 設定中。
- commit：`a5a746f fix(visual-diff): bound artifact response and validate accept target`。
- 驗證：typecheck exit=0；`npm test` 176/176。

## R11 ✅ 不把壞頁存成基準（00:56–00:58 CST）

- 做什麼：版面規則失敗時略過基準建立／auto 更新，避免壞頁成為基準；新增真 Chrome regression test。
- commit：`086483f fix(visual-diff): do not baseline a page that fails layout rules`。
- 驗證：typecheck exit=0；`npm test` 177/177；`npm run build` exit=0。

---

## 目前狀態（2026-11-27 00:58 CST，截止 20:00）

**已完成（已 commit）**：設定 schema／DB migration、純規則與像素比對、真瀏覽器 checker、派工與排程註冊、基準接受／差異查詢 API、表單與詳情頁 UI、backup／retention、Docker runtime 的 Chromium、文件。共 12 筆 commit（`d4e0a2d` → `086483f`，另 `1f73fa0` 為並行 session 連帶提交）。

**驗證證據**：`npm test` 177/177、`npm run typecheck` exit=0、`npm run build` exit=0、`prisma validate/generate` 成功、真 Chrome 流程測試 2/2。

**未完成／阻塞（需使用者決定）**：

1. **lab 部署**：cluster 已由並行 session 修復為 Healthy，但 `uptime-api` chart 是 artifact 模式（`values.yaml` 無 `image.repository`），`deploy_delivery_status` 仍 blocked；可用 storage 上傳工具上限 1 MiB，無法上傳 runtime artifact。需要你指定這套 artifact 的建置／上傳流程或授權綁定專案。
2. **DB Backed E2E**：本機無 `.env`／Postgres，dev server bootstrap 失敗，無法登入後台用瀏覽器實際建立 monitor 並看差異頁；API／UI 只通過型別、build 與單元測試。
3. **audit log**：repo 沒有 audit 機制，接受基準未寫稽核。
4. **Docker image**：無 Docker 可實際 build，Chromium 安裝步驟未經映像建置驗證。
5. **Push**：`git push origin iterate/uptime-20261122` 失敗（`could not read Username for 'https://github.com'`），本機沒有 GitHub 憑證；目前 7 筆 commit 只在本機，未上遠端。未嘗試任何其他方式繞過。

