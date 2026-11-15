# Spec：Bruno 深度整合（群組、單筆／多筆匯入匯出、可維護）

狀態：🔵 第 1 期實作中（本機驗證，未部署）。日期：2026-11-15。

使用者決定（2026-11-15）：群組＝**工作區內的群組**（方案 A）；匯出**照 Bruno 慣例**；含 script 的請求**匯入但標示**；本次**只做第 1 期**。
前一份：[Bruno 宣告式匯入與預覽](2026-11-14-bruno-integration.md)、[相容矩陣](../BRUNO_COMPATIBILITY.md)。

## 結論：需要，但只需要補四個缺口

現有的匯入本身是紮實的（先預覽、整批原子寫入、全部暫停、權限與 secret 都有守住），**不需要重寫**。
「深度整合」缺的是下面四件事，每一件都是使用者會直接碰到的：

| # | 缺口 | 現況 | 使用者碰到的問題 |
| --- | --- | --- | --- |
| 1 | 沒有群組結構 | 匯入後是一整排平的監測；Bruno 的 folder 只留在路徑字串裡 | 匯入 200 支 API 就是 200 筆平鋪，找不到、也無法整組操作 |
| 2 | 匯出不是 Bruno 能直接開的東西 | 匯出一份本平台自訂的 JSON；URL／header／body 全部換成 `{{monitor_12_url}}` 這種佔位符；上限 20 筆；要手打 ID | 拿到 Bruno 打開是一堆佔位符，等於不能用 |
| 3 | 沒有「單筆」入口 | 只能從「設定 → Bruno Import」整包進出 | 想把一支監測丟給同事、或貼一支 `.bru` 進來，都做不到 |
| 4 | 匯入後不能維護 | 沒有「我匯入過哪些 collection」的畫面；重新匯入只有「全部取代／全部略過」；來源刪掉的請求不會被發現 | collection 改版後只能憑記憶重匯，舊的監測變孤兒 |

另外有兩件格式上的落差：Bruno 現在預設的 **OpenCollection YAML**（`opencollection.yml`）不支援，也不能直接丟 **ZIP**。

明確**不做**：執行 Bruno 的 pre/post script 與 tests。那等於在排程器裡跑任意 JavaScript，安全與成本都不划算。
（但「遇到 script 整支拒絕」可以放寬成「匯入、標示、不執行」，見決策 3。）

## 概念對應（決策 1：這是最需要你選的）

Bruno 自己的階層是：**Workspace → Collection → Folder（可巢狀）→ Request**，另有 Environment。
本平台目前是：**Workspace → Environment → Monitor**（平的）。

| | 方案 A：工作區內的群組（建議） | 方案 B：工作區之上的群組 | 方案 C：兩層都要 |
| --- | --- | --- | --- |
| Bruno Workspace | 平台 Workspace | 新的 Workspace Group | 新的 Workspace Group |
| Bruno Collection | 群組（第一層） | 平台 Workspace | 平台 Workspace |
| Bruno Folder | 子群組（可巢狀） | 群組 | 群組 |
| 成員／權限 | 不變，仍以 Workspace 為單位 | 要多一層：群組層級的成員與繼承 | 同 B |
| 環境與 secret | 不變，同一 Workspace 共用 | 每個 collection 各自一套 | 同 B |
| 資料表異動 | 新增 1 張表＋1 個欄位 | 新增 2 張表，權限檢查全面改 | 新增 3 張表 |
| 適合 | 一個團隊管多個 collection | 每個 collection 屬於不同團隊、要各自授權 | 大型組織 |

建議 A 的理由：名稱與 Bruno 一對一（Workspace 對 Workspace），不動權限模型，風險最小；
之後真的需要跨工作區歸組，再往上加一層不會推翻 A。

### 方案 A 的資料模型

新增 `monitor_groups`：

| 欄位 | 說明 |
| --- | --- |
| `id`、`workspace_id` | 群組屬於工作區，不屬於環境 —— 同一個 collection 可以同時部署到 dev／staging／prod 三個環境 |
| `parent_id` | 可為空；空＝第一層（collection），非空＝子群組（folder） |
| `name`、`sort_order` | 顯示名稱與排序，可改名、可拖曳 |
| `source_kind` | `manual`（手動建立）或 `bruno` |
| `collection_id`、`source_path` | Bruno 來源識別；手動群組為空 |

`monitors` 新增可為空的 `group_id`；`bruno_sources` 新增 `group_id` 與 `source_format`（`bru`／`yml`）。
全部是**只加不刪**的 migration，既有監測 `group_id` 為空，行為不變，可直接回滾程式不必回滾資料。

既有的 `monitors.parent`（舊 Uptime Kuma 的「群組型監測」）目前前端是空殼（選單永遠是空陣列）。
不沿用它：群組型監測會被當成一筆監測排程、算進數量與可用率，語意不對。保留欄位不動。

## 匯入／匯出：一筆和多筆

| 動作 | 入口 | 行為 |
| --- | --- | --- |
| 匯入一筆 | 新增監測頁「從 Bruno 貼上／上傳」；群組上的「匯入到這裡」 | 單一 `.bru` 或 `.yml`，預覽後建立一筆，落在選定的群組 |
| 匯入多筆 | 設定 → Bruno；群組頁 | 資料夾、ZIP、或整個 Bruno workspace（`workspace.yml` 內的多個 collection 一次進來） |
| 匯出一筆 | 監測詳細頁的「匯出為 Bruno」 | 下載單一 `.bru`／`.yml` |
| 匯出多筆 | 監測列表勾選 → 匯出；群組上的「匯出整個群組」 | 下載 ZIP，解開就是標準 Bruno collection（`bruno.json` 或 `opencollection.yml`、folder、environments），Bruno 可直接開 |

匯出內容（決策 2）：照 Bruno 自己的慣例 —— URL／header／body 保留真實內容與 `{{變數}}` 參照，
環境變數寫進 `environments/<環境>.bru`，**secret 只寫名稱不寫值**。
現在的「全部換成佔位符」保留成一個選項（要把檔案給外部的人時用）。

平台才有、Bruno 沒有的設定（間隔、重試、通知、標籤）寫進 ZIP 內的 `.uptime/monitors.json`。
Bruno 會忽略它，重新匯入時本平台讀回來，來回一趟不掉設定。

## 維護：collection 管理頁

設定 → Bruno 改成兩個分頁：「Collections」與「匯入」。Collections 列出每個群組：

- 監測數、來源格式、最後匯入時間、由誰匯入
- **重新匯入**：預覽變成逐筆差異 —— 新增／有變更／未變／來源已移除，逐類決定怎麼處理
  （來源已移除的預設「暫停並標示」，不直接刪）
- 改名、搬移、匯出、解除與 Bruno 的連結（變成手動群組）
- 刪除群組：可選「連同監測」或「只刪群組、監測留下」

取代時**只更新 Bruno 管得到的欄位**（URL、method、header、body、auth、assertions），
間隔、通知、標籤、啟用狀態保留。現在的取代會強制暫停，改成：請求內容真的有變才暫停。

## 程式的可維護性

現有 Bruno 程式集中在 5 個檔，每行數百字元、匯出是手寫字串拼 `.bru`，之後要加 YAML 會很難改。重整成：

```
server/services/bruno/
  model.ts          中立的資料模型：Collection → Folder → Request（與檔案格式無關）
  read-bru.ts       .bru → model（沿用現有 @usebruno/lang 解析與安全檢查）
  read-yaml.ts      OpenCollection YAML → model
  write.ts          model → .bru／YAML（改用官方 @usebruno/filestore 的 stringify，不再手寫）
  archive.ts        ZIP 進出（entry 數、解壓大小、路徑穿越檢查）
  to-monitor.ts     model → 監測設定（變數優先序、assertion 轉換）
  from-monitor.ts   監測設定 → model
  diff.ts           重新匯入的逐筆差異
  importer.ts       交易、鎖、digest（邏輯不變，只是變短）
```

`@usebruno/filestore@0.14.0`（MIT）依賴的正是目前已鎖定的 `@usebruno/lang@0.41.0`，
同一套官方實作同時處理兩種格式的讀與寫，Bruno 改版時只要升版本、不必追語法。
採用前要確認：它不會執行任何 script、不讀寫檔案系統（只用字串進出的函式）。

測試以「來回一趟」為主：每個 fixture 匯入 → 匯出 → 再匯入，設定必須相同；`.bru` 與 YAML 各一套。

## 分期

| 期 | 內容 | 規模 | 交付後使用者能做的事 |
| --- | --- | --- | --- |
| 1 | 群組資料模型與 migration；folder → 群組；監測列表依群組收合；群組增刪改搬；單筆匯出；勾選多筆與整組匯出成 Bruno 可開的 ZIP；單筆貼上匯入 | 中 | 匯入後有結構；任何一筆或一組都能拿到 Bruno 打開 |
| 2 | OpenCollection YAML 讀寫；ZIP 匯入；整個 Bruno workspace 匯入；Collections 管理頁與逐筆差異；`.uptime/monitors.json`；程式重整 | 中偏大 | collection 改版後可以放心重匯；Bruno 新舊格式都通 |
| 3（選配） | 給 CI 用的同步端點（`POST /api/v1/bruno/collections/{id}/sync` 上傳 ZIP，用 API key）；從 Git repo 定時拉；含 script 的請求改成「匯入並標示」 | 中 | Git 是唯一來源，merge 後監測自動更新 |

每期都能獨立上線。第 1 期需要一次 migration（只加不刪）。

## 需要你決定的事

1. **群組概念**：A 工作區內的群組（建議）／B 工作區之上／C 兩層。
2. **匯出內容**：照 Bruno 慣例（真實內容＋secret 只留名稱，建議）／維持全部佔位符／匯出時每次選。
3. **含 script 的請求**：維持整支拒絕／匯入但標示「有未執行的 script」且預設暫停（建議）。
4. **這次做到哪**：只做第 1 期（建議先做完看手感）／第 1＋2 期／全部。

## 風險與未驗證

- `@usebruno/filestore` 的 YAML 解析行為尚未實測；若它在解析時碰檔案系統或執行程式碼就不採用，改為只用 `yaml` 套件自行對應欄位。
- 匯出真實內容代表下載檔含 URL 與 header 值，仍限 owner，並寫入稽核紀錄。
- 群組屬於工作區而非環境：同一群組在不同環境會各有一份監測，列表依目前選的環境過濾。
- 4000 筆的大量匯入歷史驗證是在平鋪模型下做的；加上群組後要重跑一次才算數。

## 第 1 期實作紀錄（2026-11-15）

| 項目 | 位置 |
| --- | --- |
| 資料表 `monitor_groups`、`monitors.group_id`、`bruno_sources.ignored_blocks`（只加不刪） | `prisma/migrations/20261115010000_monitor_groups` |
| 群組服務（樹、深度上限 8、防循環、刪除時只刪目前環境的監測） | `server/services/groups.ts`、`server/api/v1/groups/*` |
| folder → 群組、script／tests 標示、query 去重 | `server/services/bruno/parser.ts`、`importer.ts` |
| Bruno 慣例匯出（官方 writer）、ZIP | `server/services/bruno/collection-export.ts`、`server/utils/zip.ts`、`server/api/v1/bruno/download.get.ts` |
| 群組頁（樹、勾選、搬移、匯出、匯入到此群組、改名／搬移／刪除） | `pages/monitors/groups.vue`、`composables/useBruno.ts` |
| 匯入頁（資料夾／.bru／ZIP／貼上／manifest、目標群組、預覽群組樹與未執行標示） | `components/monitor/BrunoImport.vue` |
| 監測頁（群組路徑、Bruno 來源、未執行標示、Export .bru） | `pages/monitors/[id]/index.vue` |

與原規劃的差異：監測列表是游標分頁，在分頁中途收合群組會讓計數與排序失真，所以「依群組瀏覽」做成獨立的 Groups 頁（導覽列有入口），Monitors／Dashboard 列表維持不變；列表 API 多了 `groupId` 篩選（`none`＝未分組）。ZIP 匯入在瀏覽器解壓（DecompressionStream），伺服器仍只收 files[]，因此原本的路徑、大小、數量檢查不變。

測試：`tests/bruno-groups.test.ts`（解析標示、資料夾、query、匯出慣例、來回一趟、ZIP）、`tests/groups.integration.test.ts`（群組樹、跨環境共用、replace 保留手動搬移、權限、防循環、跨工作區隔離、owner-only 下載、依環境刪除）。
