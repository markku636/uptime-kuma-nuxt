# SealWatch 新增「網頁跑版（visual-diff）」Monitor Type 計劃

**截止時間：2026-11-27 20:00 CST（Fri）** — 持續迭代至截止，到點收尾。
狀態：🟢 進行中（2026-11-27 00:22 核准）。已定：type=`visual-diff`；先做公開頁＋既有 basic auth；閾值先從嚴；每輪 commit + 部署 lab。

迭代紀錄：[`20261127-0022-visual-diff-iteration.md`](./20261127-0022-visual-diff-iteration.md)

## 1. 目標與不做的事

**一句話目標**：在 SealWatch（`uptime-iter-20261122`）新增一種 monitor type `visual-diff`，定期用真瀏覽器開啟目標網頁，以「版面規則 + 截圖像素比對」判斷有沒有跑版，並沿用既有的心跳／通知／狀態頁機制發出 DOWN。

**範圍內**

- 新增 type 定義、表單欄位、DB 設定、checker、結果呈現、基準接受流程。
- 目標網址是**每個 monitor 的欄位**（`url`），不是寫死在程式裡。你給的 `https://uptime.markkulab.net/dashboard` 用來辨識這份專案（該站登入頁標題就是 SealWatch），不是唯一的監控對象。

**範圍外（明確不做）**

- 不自動修復網頁、不自動 revert 部署；只偵測＋通知＋存證。
- 不改寫既有 `http` / `keyword` / `real-browser` 的行為（只共用底層 Playwright 與通知）。
- 不改 `uptime-kuma-nuxt-20261114`（看起來是前一版／來源 repo）。若要同步，另開計劃。
- 不做跨瀏覽器（Firefox/WebKit）與手機 real device；第一期只跑 Chromium。
- 不碰其他人的工作：目前工作樹有未提交的 `components/monitor/BrunoRequestEditor.vue`、`tests/bruno-*.test.ts` 等，禁止 `git checkout --` / `git stash` / `git reset --hard` / `git clean`；commit 只 add 自己改的檔。

## 2. 現況（查證結果）

### 2.1 專案與站台

- 專案：`/home/mark/projects/uptime-iter-20261122`（Nuxt + Prisma + worker 架構）。
- `https://uptime.markkulab.net/dashboard` 匿名載入的內容是 `SealWatch / Username / Password / Remember me / Login`，確認這就是 SealWatch 本站；dashboard 本身需要登入。
- 最近提交：`8765b36 docs(bruno)...`、`114a3a4 fix(worker): dispatch by monitor type` 等；repo 有 `docs/plans/doing/` 慣例（`20261124-2047-bruno-monitor-editor.md`）。
- **此 repo 沒有 `.codegraph/` 索引**，本次查證用 grep/read；規劃階段不跑 `codegraph init`。

### 2.2 新增一种 monitor type 要改的既有链路（精确档案）

| 环节 | 档案:行 | 现况 |
| --- | --- | --- |
| 前端型别枚举 | `types/monitor.ts:3-27` | `enum MonitorType`，已有 `REAL_BROWSER = 'real-browser'` |
| 后端 type 注册 | `server/services/monitor/types.ts:233-238`(`realBrowserMonitorType`)、`:296-337`(`monitorTypeList`)、`:343-352`(getter) | 只描述「支援哪些 condition 變數」，不是檢查邏輯 |
| 检查派工 | `server/services/monitor/checker.ts:42-135` | `checkMonitor()` 的 `switch (monitor.type)`；`:122` 走 real-browser |
| 检查实作 | `server/services/monitor/checkers/real-browser-checker.ts:1-171` | 用 `playwright-core`；`:126-138` 有截圖但**抓完就丟**，沒有比對、沒有存基準 |
| checker 导出 | `server/services/monitor/checkers/index.ts:12` | `export { checkRealBrowser, closeBrowser }` |
| worker | `server/services/monitor/worker.ts:56-80` | `resolveMonitorConfig → checkMonitor → retry → completeMonitorRun`；有 lease / abort / deadline，checker 必须遵守 `AbortSignal` |
| 结果结构 | `server/services/monitor/checker.ts:28-40` | `CheckResult { status, ping, msg, code?, assertionResults?, ... }` |
| 输入验证 | `server/utils/monitor-input.ts:4-71` | zod `createMonitorSchema`，`:57` 有 `remoteBrowserId` |
| 敏感栏位白名单 | `server/utils/monitor-secrets.ts:54` | `hydrateMonitor()` 只保留列出的欄位；**新欄位沒加進去就讀不到** |
| API 写入 | `server/api/v1/monitors/index.post.ts:57`、`server/api/v1/monitors/[id].put.ts:61` | 欄位／workspace 所有權檢查 |
| 备份 | `server/utils/backup.ts:73` | 還原monitor 時用同一個 zod schema |
| 表单 | `components/monitor/MonitorForm.vue:1208`(`form = reactive`)、`:1318-1342`(`monitorTypes`)、`:1367-1390`(`show*Field` computed)、`:1637`(`data.cacheBust`) | 型別下拉是寫死陣列，欄位用 `v-if` 條件顯示 |
| 筛选 | `components/monitor/MonitorListFilter.vue:167` | type 下拉也寫死 |
| 详情页 | `pages/monitors/[id]/index.vue`、`pages/monitors/[id]/edit.vue` | 顯示 heartbeat／詳情 |
| DB | `prisma/schema.prisma:48-197`(`Monitor`)、`:205-226`(`Heartbeat`) | 已有 `assertions Json?`(:68)、`remoteBrowserId`(:173)；Heartbeat 只有 `msg`/`checkCode`，沒有圖片欄位 |
| 相依 | `package.json:55` | 已有 `playwright ^1.48.0`；**沒有** `pixelmatch` / `pngjs` |

### 2.3 別人怎麼做（業界做法，2026 現況）

- **工具三分類**：Pixel-diff（Playwright `toHaveScreenshot`、BackstopJS、Percy、Chromatic）本身便宜直觀，但動態內容（時間、廣告、動畫）會誤報；AI 比對（Applitools、Percy Visual Review）能分「真 bug / 故意改版」但要付費；DOM 結構比對適合抓結構變化，抓不到 CSS／破圖。
- **共通架構**（webclaw / Visual Sentinel 等）：Scheduler → Fetcher（真瀏覽器）→ Normalizer（去雜訊）→ Diff engine → Classifier → Notifier → Storage。跟 SealWatch 的 scheduler/worker/completion/notification 幾乎一一對應。
- **多斷點是必須**：XICTRAQ 明確用 desktop 1440 / tablet 768 / mobile 375 分開比對；跑版常只發生在單一 breakpoint。
- **baseline 放在 CI repo 的陷阱**：Playwright 官方建議用 Docker 統一字型與渲染，baseline 由 CI 產生；但那是給「自家程式碼 PR」用的。對「監控外部正式站」而言，每次對方改版都要 commit 新圖片不適合，應該把 baseline 存成服務端狀態並提供「接受為新基準」。
- **降低審查負擔的真痛點**：業界普遍反應不是截圖難，而是「每次字型／瀏覽器更新全紅，沒人想看」。所以要有 ignore region、閾值、以及「相同 diff 重複出現才升級」的機制（Argos 的 recurring-change ignore）。
- **結論**：SealWatch 適合「DOM 規則 + 像素比對」混合，baseline 存 DB，不引入雲端付費服務。

## 3. 架構與關鍵決策

| 決策 | 選了什麼 | 為什麼 | 放棄了什麼 |
| --- | --- | --- | --- |
| Type id / 標籤 | `visual-diff` / `視覺跑版 (Visual Diff)` | 符合現有 kebab-case（`real-browser`、`json-query`）；語意比 `layout-watch` 更貼近「跑版」 | 在 `real-browser` 上加 flag（會污染既有 type 的欄位與條件）；独立新服务（用不到 SealWatch 通知／心跳） |
| 偵測方式 | 兩層：① DOM/版面規則 ② 截圖 pixel diff | 規則層可解釋、免基準、直接抓水平捲軸／元素消失／破圖；像素層抓 CSS 漂移 | 純像素（誤報高、無法說明哪裡壞）；純 DOM（抓不到 CSS 與破圖） |
| 截圖引擎 | 既有 `playwright` + 新增 `pixelmatch`、`pngjs` | server-side Scheduled check 不能用 test-runner 的 `toHaveScreenshot`；直接對 Buffer 比對最輕 | 雲端 Percy/Chromatic（付費、外部依赖）；`sharp`（較重，第一期不需要） |
| Baseline 存放 | Postgres `Bytes`，一個 monitor × 一個 viewport 一筆 | 跟 monitor 同生命週期、好備份、無需雙系統；量體可控 | Git 提交 PNG（適合 PR 不適合外部站監控）；物件儲存（多一套憑證／清理邏輯） |
| 設定存放 | Monitor 新增單一 `visualConfig Json?` | 新增 10+ 個欄位不值得逐欄 migration；與既有 `assertions Json?` 模式一致 | 每欄一個 DB column；塞進 `assertions`（語意混在一起） |
| 基準更新 | 預設**手動接受**（API + UI 按鈕）；可選自動接受 | 對方改版是常態，自動更新會把真跑版洗掉 | 每次檢查都自動覆蓋 baseline（永遠不會告警） |
| 基準失效 | 綁既有 `configVersion`：設定一改，舊 baseline 標 stale，要求重新接受 | 避免拿新 selector 比舊圖，產生假 DOWN | 忽略設定變更（難以解釋的誤報） |
| 執行環境 | 固定 Chromium + 固定容器； launch 參數沿用/抽出共用 | 跨平台字型與 anti-alias 會讓像素比對全紅（業界共通坑） | 在本機 Mac 產生基準給 Linux worker 用 |
| 通知 | 沿用既有 notification / heartbeat，`msg` 寫「跑版百分比＋哪個 viewport＋哪條規則」，DOWN 才通知 | 不用新建通知通道 | 另接 Slack/Email webhook |
| 自動修復 | 不做 | 超出範圍，且外部站不在我們權限內 | 自動開修復卡 |

### 3.1 資料形狀（建議）

`Monitor.visualConfig Json?`：

```ts
{
  viewports: [
    { label: 'desktop', width: 1440, height: 900 },
    { label: 'mobile',  width: 375,  height: 812 }
  ],                                   // 最多 4 個，label 唯一
  waitForSelector?: string,             // 例如 '[data-ready="true"]'
  waitTimeoutMs?: number,               // default 5000
  settleMs?: number,                    // 等字型/動畫，default 300
  fullPage?: boolean,                   // default true
  requiredSelectors: [                  // 規則層
    { selector: 'header', minCount: 1, minWidth: 200, minHeight: 24 }
  ],
  maxHorizontalOverflowPx?: number,     // default 2
  detectBrokenImages?: boolean,         // default true
  ignoreSelectors?: string[],           // 遮蔽動態區塊（時間、廣告、rand id）
  diffThreshold?: number,               // 0..1，default 0.02
  maxDiffPixels?: number,               // 絕對值閾值，二選一或 AND
  baselineStrategy?: 'manual' | 'auto', // default manual
}
```

新表（精簡版，2 張）：

```prisma
model VisualBaseline {
  id            Int      @id @default(autoincrement())
  monitorId     Int
  viewportLabel String
  width         Int
  height        Int
  image         Bytes
  sha256        String
  configVersion Int
  createdAt     DateTime @default(now())
  @@unique([monitorId, viewportLabel])
}

model VisualCheckArtifact {
  id            BigInt   @id @default(autoincrement())
  monitorId     Int
  viewportLabel String
  checkedAt     DateTime @default(now())
  status        Int      // 0 DOWN / 1 UP
  diffRatio     Float?
  diffPixels    Int?
  diffImage     Bytes?
  metrics       Json?    // overflow / required / brokenImages / pageErrors
  @@index([monitorId, checkedAt(sort: Desc)])
}
```

> 取捨：若想再少一張表，可把 `diffRatio`/`diffImage` 放回 `VisualBaseline.last*` 並把摘要寫進 `Heartbeat.msg`；但基準與最近結果生命週期不同，分開比較好做 retention。

### 3.2 檢查流程（checker 內部）

1. `page.goto(url, waitUntil: 'networkidle')`， respect `signal`（worker 會 abort）。
2. 等 `waitForSelector` / `settleMs`。
3. **規則層**：水平溢出、必要元素存在且尺寸 > 0、破圖、`pageerror`/console error、HTTP >= 400。任一失敗 → DOWN，`code = 'LAYOUT_RULE'`，msg 列出失敗項。
4. **像素層**：依 viewport 逐一截圖；查 `VisualBaseline`（且 `configVersion` 相符）。
   - 無基準 → 建立基準，回 UP + msg「已建立基準（待人工確認）」。
   - 有基準 → `pixelmatch` 比對（先對 `ignoreSelectors` 遮蔽），超過閾值 → DOWN，`code = 'VISUAL_DIFF'`，寫入 `VisualCheckArtifact`。
5. 回 `CheckResult`，由既有 `completeMonitorRun` / notification 鏈接手。

## 4. 分階段（每階段可獨立交付與驗證）

### Phase 0 — 規格定稿與基準校準（~0.5 天）

- 選定 type id、預設閾值、預設 viewports；實際用一個公開頁跑 3~5 次量測，訂出「正常波動」與「跑版」的分界。
- 產出：`docs/specs/visual-diff-monitor-type.md`（本文設計決策的規格版）。
- 交給子代理：可（只讀研究與量測，不碰程式碼）。

### Phase 1 — 資料模型與 API（~1 天）

- `prisma/schema.prisma`：加 `Monitor.visualConfig`、`VisualBaseline`、`VisualCheckArtifact`。
- migration（`prisma migrate dev` 產生；部署用 `migrate deploy`）。
- `server/utils/monitor-input.ts`：加 `visualConfig` 的 zod（含上限：viewports ≤ 4、width 320..3840、selector 長度上限）。
- `server/utils/monitor-secrets.ts:54` 白名單加 `visualConfig`（**漏了就讀不到**）。
- `server/api/v1/monitors/index.post.ts` / `[id].put.ts`：接受並驗證新欄位。
- 新增 API：`POST /api/v1/monitors/:id/visual-baselines/accept`（body: `viewportLabel` + `sha256` 或 `acceptCurrent: true`），僅 workspace 成員、寫 audit log。
- 詳情頁 API：`GET /api/v1/monitors/:id/visual-artifacts`（分頁，回傳 base64 diff 圖或另行下載）。
- **可平行**：Phase 2 與 Phase 3 在 Phase 1 的型別定稿後即可開始。

### Phase 2 — Checker 核心（~1.5 天，可拆兩子代理平行）

- 新增 `server/services/monitor/checkers/visual-layout-rules.ts`（純函式，吃 DOM 量測結果，回規則判定）— 子代理 A。
- 新增 `server/services/monitor/checkers/visual-pixel-diff.ts`（純函式，吃兩個 PNG Buffer + ignore 設定，回 `{ diffRatio, diffPixels, diffImage }`）— 子代理 B。**與 A 不碰同一檔案**。
- 新增 `server/services/monitor/checkers/visual-diff-checker.ts`（組合兩者、Playwright、DB 讀寫baseline/artifact、尊重 `AbortSignal`）。
- `checkers/index.ts` 導出；`checker.ts` import 並加 `case 'visual-diff'`（**不要**再寫一個 inline 函式；現有 checker.ts:148 那個 inline `checkRealBrowser` 是歷史遺留，不要複製它的模式）。
- `server/services/monitor/types.ts` 註冊 `visualDiffMonitorType`（conditions 先給 `response_time` 與 `diff_ratio`）。
- `types/monitor.ts` 加 enum `VISUAL_DIFF = 'visual-diff'`。
- `package.json` 加 `pixelmatch`、`pngjs`（+ `@types/pixelmatch` 若需要）。

### Phase 3 — 前端表單與結果呈現（~1.5 天，可與 Phase 2 平行）

- `components/monitor/MonitorForm.vue`：`monitorTypes` 加選項；`form` 加 `visualConfig` 初始值和 `showVisualSettings` computed；模板加 viewports／requiredSelectors／ignoreSelectors／閾值／waitForSelector 輸入；送出時序列化（`:1637` 附近）。
- `components/monitor/MonitorListFilter.vue:167` 加 type 選項。
- `pages/monitors/[id]/index.vue`：顯示最近一次 diff（before/after/差異圖 + 百分比 + 失敗規則）；「接受為新基準」按鈕；基準 stale 時明顯提示。
- `pages/monitors/[id]/edit.vue`：能編輯 `visualConfig`（沿用表單元件即可）。
- 若型別標籤有 i18n 需求，補 `locales/*`（現況 `monitorTypes` 是寫死英文，先比照辦理）。

### Phase 4 — 通知、留存與清理（~0.5 天）

- 確認 DOWN 通知內文帶 viewport / diff% / 規則原因；沿用既有 notification providers，不改格式協定。
- `server/jobs/clear-old-data.ts`：加 `VisualCheckArtifact` retention（例如保留 30 天 / 每個 monitor 最近 50 筆）。
- 基準接受／拒絕寫 audit log。

### Phase 5 — 上線驗證（~0.5 天）

- 先在 lab 用一個公開頁建 monitor 跑 24 小時，觀察誤報率；再上 prod。
- 部署順序：`prisma migrate deploy` → worker（新 checker）→ web（UI）。
- 用一個故意改版的測試頁驗證「真的會 DOWN」以及「接受新基準後恢復 UP」。

**子代理分工建議**：Phase 2 的 A/B、Phase 3 的「表單」與「詳情頁」都可平行；但每個子代理要拿到自足說明（目標、檔案、完成標準、禁區），回來後由規劃者親自看 diff 與測試結果，不把子代理回報當證據。

## 5. 資料與部署

- **DB migration**：新增 1 欄 + 2 表；`VisualBaseline.image` / `VisualCheckArtifact.diffImage` 用 `Bytes`（Postgres bytea）。既有資料不受影響（`visualConfig` 可為 null），不需要資料回填。
- **向後相容**：舊 monitor 沒有 `visualConfig` → checker 用預設值；不影響既有 type。
- **secret / 環境變數**：第一期不需要新 secret。若目標頁需登入，沿用既有 `basicAuthUser` / `basicAuthPass` / `headers` / `authConfig`；**cookie/session 登入不在第一期**（見風險）。
- **相依套件**：`pixelmatch`、`pngjs`（server 端用）。Chromium 沿用目前 Playwright 安裝；Docker image 要包含瀏覽器與字型（跟既有 real-browser 一致）。
- **部署順序**：migration 先上 → worker 再上 → web 最後。worker 未更新前，新 type 的 monitor 不要建立，否則 `checkMonitor()` 會丟 `Unknown monitor type` 並轉成 DOWN。
- **共用工作樹**：本 repo 有別人未提交的 Bruno 相關變更；所有操作只針對本計劃列出的檔案，commit 只 add 自己的檔；`SPEC_PRECOMMIT=strict` 若適用則設定。

## 6. 驗證（每階段怎麼證明完成）

| 階段 | 驗證方式 | 通過條件 |
| --- | --- | --- |
| Phase 0 | 對公開頁連續截圖 5 次，記錄 diffRatio 分布 | 訂出可信閾值與 ignore 清單 |
| Phase 1 | `pnpm prisma validate` / `npm run typecheck`；unit test 验证 zod 接受與拒絕（欄位過多、viewport 超界） | schema 與 API Contract 測試通過 |
| Phase 2 | **unit（不需真瀏覽器）**：`visual-layout-rules`、`visual-pixel-diff` 用 table-driven 測試（乾淨圖、平移、局部色塊、超過閾值、ignore region）；**integration**：本地起一個含「正常版／故意跑版版」的 fixture page，用真 Playwright 跑 `checkMonitor()` | 正常版 UP、跑版版 DOWN 且 `code` 正確、`msg` 可讀 |
| Phase 3 | `npm test -- <新測試>`；用 in-app browser 在 `pages/monitors/add.vue` 建一筆 `visual-diff` monitor，儲存後重新編輯確認欄位還在 | 表單來回編集不丟設定；詳情頁看得到 diff 圖 |
| Phase 4 | 觸發 DOWN，確認通知內文；執行 retention job 後查 DB 筆數 | 通知有證據連結；舊 artifact 被清掉 |
| Phase 5 | lab 跑 24h 誤報率；prod 建一筆監控頁並人為改版驗證 | 誤報在約定範圍內；改版會 DOWN、接受基準後回 UP |

**build／部署／使用者流程分開列**：`npm run build` 成功 ≠ 部署成功；部署成功 ≠ 實際收到跑版告警。三者都要有獨立證據。

## 7. 風險與待決（需要你拍板）

1. **目標頁是否要登入？** 你給的 SealWatch dashboard 本身要登入。第一期只做公開頁（用 `url` + 既有 basic auth/headers），還是現在就做 cookie/session 登入？（建議先公開頁，登入頁靠既有 basic auth 或另外記録 cookie。）
2. **型別名稱**：用 `visual-diff` 還是你想要的別名（例如 `layout-watch` / `sealwatch`）？這會進 DB `type` 欄位，之後改要 migration。
3. **預設閾值**：建議 diffThreshold 0.02、maxHorizontalOverflowPx 2px；需要 Phase 0 實測校準，你可接受先從嚴（誤報多）還是先從寬（漏報多）？
4. **基準接受權限**：任何人（workspace 成員）都能接受，還是限定管理員？
5. **基準自動更新**：預設手動。若要自動，條件是「連續 N 次相同 fingerprint」還是「時間超過 N 天」？
6. **舊 repo 同步**：`uptime-kuma-nuxt-20261114` 要不要一起加？（建議不要，除非它是正式部署來源。）
7. **誤報來源**：時間戳、輪播、廣告、字型載入順序。需在 Phase 0 建立 ignore 清單；若目標頁動態性很高，純像素比對可能不適合，要改以規則層為主。
8. ** Flavored 環節**：Pixel diff 對字型／anti-alias 敏感，worker 容器一定要固定版本；若目前 prod worker 跑在不同 image，需先統一。

---

**核准後才進實作**（依 implementation-plan 流程）；實作時照 `project-development` 的 Spec／測試／證據要求。
