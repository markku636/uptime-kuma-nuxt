# Bruno 配置體驗持續迭代紀錄

**截止時間：2026-11-27 20:00 CST（台北）** — 來源：使用者「優化完善 bruno 配置體驗 直到晚上 8pm」（2026-11-27 11:45 CST 下達）。
**起始時間：2026-11-27 11:45 CST。**

## 範圍與邊界

- 目標：`uptime-iter-20261122`（`iterate/uptime-20261122`）的 Bruno monitor 編輯器／parser，正式站 `https://uptime.markkulab.net`。
- 延續：[20261126-2353-bruno-iteration.md](./20261126-2353-bruno-iteration.md)（R65 結束，rev300）。本輪專注「配置體驗」（UI 編輯器、表單、錯誤提示、變數與憑證輸入），不重做已完成功能。
- 禁區：不改其他平台共用 chart／套件／secret／DB；共用工作樹不 stash／reset --hard／clean／切分支；commit 只 add 自己動的檔，不用 `--no-verify`。
- 每輪交付定義：只 commit（使用者本次未要求每輪部署）。部署前先問一次；若沿用舊授權需明確記錄。lab/prod 部署走 v-terminal GitOps，遇 cluster／artifact 阻塞時記下來換下一項，不硬推。
- 驗證：`npm run test:bruno`、`npm run typecheck`、`npm run build`、Bruno 相關整合測試；畫面改動要跑 browser 整合或如實標註未驗證。

## 差距清單（會隨 Round 更新）

| # | 差距 | 來源 | 優先 | 狀態 |
|---|------|------|------|------|
| U1 | 空白 Bruno monitor 在 UI editor 填完 URL 後 Send 按鈕仍 disabled（`rawSource` 空白），無法頁內試送 | 2026-11-27 code review | 高 | ✅ R1 |
| U2 | Auth 的 Password / Token 用 `type=text` 明文顯示，無顯示/隱藏切換 | 2026-11-27 code review | 高 | ✅ R2 |
| U3 | `savedSource` 只在 mount 時設定，Save 後 props 更新時 Reset 會退回舊內容 | 2026-11-27 code review | 中 | ⬜ |
| U4 | Operator 下拉沒有操作數格式提示（`between` 需 `min max` 等），易填錯 | 2026-11-27 code review | 中 | ✅ R3 |
| U4b | Bulk Edit 無效列被靜默丟棄 | 2026-11-27 code review | 高 | ✅ R4 |
| U5 | Raw 模式 Copy / Download 兩顆按鈕沒有間距；busy/parse 中缺少視覺回饋 | 2026-11-27 code review | 低 | ⬜ |
| U6 | 正式站 Bruno monitor（monitor 61）人工驗收仍需持有人登入 | 延續 N3 | 中 | ⬜（需使用者） |

## 迭代紀錄

格式：`R<n> ✅/❌ 標題 — commit／映像／驗證證據`

R1 ✅ UI editor 置左 + 空白請求可頁內 Send（11:45–11:51 CST）— commit `f99b38b`：
- 依使用者要求把分頁切換順序改成 `UI editor | Raw (.bru)`；按名稱定位的既有測試不受影響。
- `canSend` 改為依目前模式判斷：UI 模式有 URL 即可 Send（parent 的 `sync()` 會先序列化），Raw 模式仍有 `.bru` 才行；Ctrl/⌘+Enter 也遵守同一規則；URL 空白時顯示「Enter a URL to enable Send.」。
- 新增 browser 測試：空白 monitor → UI 填 URL → Send → fixture 收到 1 次請求且回應面板出現 Status 200 → 切 Raw 驗證 `.bru` 已序列化。
- 驗證：`npm run typecheck` exit=0、`npm run test:bruno` 109/109、`npm run build` 成功、Bruno editor browser 6/6（新測試包含在內）。
- 測試環境：kubectl port-forward `uptime-postgres-0` → 127.0.0.1:55464，隔離 DB 自動建立/銷毀，未動正式資料。
- 部署：未部署（本次交付定義為只 commit）。

R2 ✅ Auth 憑證預設遮罩 + 顯示切換（11:51–11:56 CST）— commit `5c96fee`：
- Basic Password / Bearer Token 改為 `type=password`，新增「Show credentials」核取方塊切換；補 `for/id` 與 `autocomplete=off`，並說明值存放在 `.bru`、API 不回傳。
- browser 測試：basic password 與 bearer token 預設為 password、勾選後變 text、getValue 仍保留、取消勾選再遮罩。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R3 ✅ Assert 值格式提示（11:56 CST）— commit `8c76112`：
- Value 輸入框依 operator 顯示不同 placeholder（between → `200 299`、in/notIn → `[200, 201]`、regex → `safe regex literal` 等），表格下補一段格式說明（含 unary 不需值）。
- browser 測試驗證切到 between / in 時 placeholder 正確，再切回 eq 不影響後續存檔流程。
- 驗證：`npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

R4 ✅ Bulk Edit 無效列提示（12:00–12:06 CST）— commit 待填：
- 原本 `name: value` 解析會 silently 丟掉沒有冒號/空名稱的列；現在顯示 `Skipped line N: use "name: value" (prefix ~ to disable).`，切回表格前就能看到。
- 為避免 computed setter 在 Vue 重新渲染時把草稿正規化（第一次跑測試時警告被清掉、文字被吞），改為 textarea 有自己的 `bulkDraft`，watch 後解析進 model。
- browser 測試：`token: demo2\n~off: no\nbroken line\n: empty` → 警告列出 3、4 行 → Table Edit 只剩 2 列；後續 Raw/Save 流程不變。
- 驗證：第一次跑 5/6（警告被吞）→ 修正後 `npm run typecheck` exit=0、`npm run build` 成功、Bruno editor browser 6/6。
- 部署：未部署。

