# Bruno 支援度與功能持續迭代紀錄

**截止時間：2026-11-26 08:00 CST（台北）** — 來源：使用者「持續優化迭代 bruno 的支援度及功能，直到早上 8am」（2026-11-25 23:53 CST 下達）。
**起始時間：2026-11-25 23:53 CST。**

## 範圍與邊界

- 目標：`uptime-iter-20261122`（`iterate/uptime-20261122`）的 Bruno monitor 編輯器與 parser，部署到 `https://uptime.markkulab.net`。
- 參考：GitHub `usebruno/bruno`（RequestPane / Assertions / QueryParams / Vars）與 `@usebruno/lang@0.41.0`。
- 禁區：不改其他平台共用 chart／套件／secret／DB；共用工作_tree 不 stash／reset --hard／clean／切分支；部署前已由使用者授權（2026-11-25「Commit 並部署正式站」），不再每輪重問。
- 每輪：只 commit 自己動的檔 → 走 v-terminal GitOps 部署 → 記錄 commit／artifact／revision／驗證證據。

## 差距清單（會隨 Round 更新）

| # | 差距 | 來源 | 優先 | 狀態 |
|---|------|------|------|------|
| G1 | 編輯器預設應為 UI editor（目前 Raw），空 `.bru` 按 UI 會報 `HTTP_BLOCK_REQUIRED` | 使用者 2026-11-25 | 高 | 🔵 R1 |
| G2 | 不同參數／斷言組合的自動化測試不足 | 使用者 2026-11-25 | 高 | 🔵 R1 |
| G3 | 嵌套 JSON body 的 `}}` 被 parser 誤判為 `UNSUPPORTED_VARIABLE` | 本輪查證 | 高 | ⬜ R2 |
| G4 | 官方支援但本平台尚未支援的 assert operator（in/notIn/matches/startsWith/endsWith/between/isJson…） | GitHub Bruno 原始碼 | 中 | ⬜ |
| G5 | 路徑參數（`:id`）與 path params 分頁 | GitHub Bruno 原始碼 | 中 | ⬜ |
| G6 | Params/Headers Bulk Edit（官方有） | GitHub Bruno 原始碼 | 低 | ⬜ |

## 迭代紀錄

格式：`R<n> ✅/❌ 標題 — commit／映像／驗證證據`
