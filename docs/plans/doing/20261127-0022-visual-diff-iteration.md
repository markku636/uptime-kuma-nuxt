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
