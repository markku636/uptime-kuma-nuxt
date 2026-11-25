# Bruno 風格編輯器交付摘要（2026-11-26）

## 做了什麼

把 SealWatch 的 Bruno monitor 編輯頁從單一 `.bru` 文字方塊，升級成與 Bruno app 相近的網頁編輯器：

- 預設為 **UI editor**，可切回 `Raw (.bru)`；空的 `.bru` 會直接顯示空白表單。
- 十個分頁：Params / Body / Headers / Auth / Vars / Script / Assert / Tests / Docs / Settings。
- Params 支援 query/path 類型、Bulk Edit（`name: value`，`~` 停用）；Body 支援 none/json/text/form-url-encoded。
- Vars 可直接列出並插入環境變數；任何欄位輸入 `{{` 有自動完成；secret 只顯示 `••••••`。
- `Ctrl/⌘+Enter` 送出；結果面板顯示 status/elapsed/Headers/Body/Assertions（含 actual）。
- Raw 模式可 Copy / Download `.bru`、Reset 回已儲存版本；有 Unsaved changes 提示。
- 支援 30 種 assert operator（含安全的 `matches` 比對）與最多 50 條規則；path params 會代入 URL。
- Bruno monitor 可匯出為單檔、ZIP 或 redacted manifest；字面憑證會轉 secret placeholder。
- Bruno `.bru` 原文只對互動式 editor+ session 可讀；API key 維持 write-only。

## 部署

- .repo：`uptime-iter-20261122`，branch `iterate/uptime-20261122`，HEAD `70186c7`（截至本摘要）。
- 正式站：`uptime-api-demo-20261114/uptime-api` rev300，Healthy / Synced。
- 最後一個 runtime artifact：`fb7d51d26464ff68c4ac3ab77b27c9d1e3c5d6141b0f6f1b98e126fa3f848880`（source `56db886`，203,7xx KB bundle）。

## 驗證

| 項目 | 結果 |
| --- | --- |
| `npm run test:bruno` | 109 unit pass |
| `npm test` | 157 pass / 0 fail |
| `npm run typecheck` | 0 errors |
| `npm run build` | 成功 |
| `npm run verify:bruno` | 全綠 |
| 完整 `npm run test:integration` | 105 pass / 0 fail / 1 skip |

Bruno 相關測試包含：unit round-trip、畸形輸入、operator 語意與效能、API 權限／跨 workspace、browser 全流程（Params/Auth/Docs/Script/Tests/Settings、Bulk Edit、自動完成、Send、Save、reload、mobile 寬度）。

## 待持有人確認

正式站 `https://uptime.markkulab.net/monitors/61/edit` 需登入後人工確認畫面；自動化只驗證到登入頁，不冒稱已人工驗收。
