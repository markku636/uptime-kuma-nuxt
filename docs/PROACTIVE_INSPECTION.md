# 主動網站尋檢（Website audit / Browser flows）

這兩個功能對應 Supercheck 的 website/SSL monitor 與 Checkly 的 Synthetic／Browser Check，
但刻意只做**有界、可預期、不執行任意程式碼**的子集。

## 1. Website audit（按需網站健檢）

入口：Dashboard →「Website audit」。API：`POST /api/v1/site-audit`（需 workspace editor）。

```json
{ "url": "https://example.com", "keyword": "Example Domain" }
```

回傳 `data`：

| 欄位 | 說明 |
| --- | --- |
| `score` / `grade` | 0–100 分與 A（≥90）／B（≥75）／C（≥60）／D（≥40）／F |
| `finalUrl` / `checkedAt` / `durationMs` | 實際檢查的 URL（最多手動跟 2 跳）、時間與耗時 |
| `checks[]` | 每項 `id`／`label`／`status`（pass/warn/fail/skip）／`summary`／`detail[]` |

檢查項目：

1. `http`：HTTP 狀態與耗時；明確拒絕 HTTPS→HTTP 降級、URL 內帳密與 metadata host。
2. `tls`：信任、剩餘天數、hostname／SAN 比對；非 HTTPS 顯示 N/A。
3. `dns`：A／AAAA 筆數；私網與Metadata位置一律視為阻斷。
4. `headers`：HSTS、CSP、X-Content-Type-Options、X-Frame-Options、Referrer-Policy、Permissions-Policy。
5. `meta`：title、description、viewport、`lang`、`robots noindex`；非 HTML 跳過。
6. `links`：最多 8 個同站連結做 HEAD 檢查，並標記混合內容（`http:` on HTTPS）。
7. `keyword`：選填，檢查回應內文是否包含指定字串。

限制：每次最多 10 次/分鐘/使用者、全域同時 3 次；單一回應 1 MiB、單步 10 秒。
**不寫資料庫、不進心跳、不發通知**，純粹是按需報告。

## 2. Browser flows（合成瀏覽器流程）

入口：Dashboard →「Browser flows」→ `/browser-flows`。建立的流程就是 `type=browser-flow` 的 monitor，
走既有排程、心跳、通知與權限，與 HTTP monitor 一樣可在 `/monitors/:id` 查看。

設定存放在 monitor 的 `body`（JSON），欄位：

```json
{
  "startUrl": "https://example.com",
  "steps": [
    { "action": "goto" },
    { "action": "fill", "selector": "#email", "value": "me@example.com" },
    { "action": "click", "selector": "#submit" },
    { "action": "waitFor", "selector": "#dashboard" },
    { "action": "assertVisible", "selector": "#welcome" },
    { "action": "assertText", "selector": "#welcome", "value": "Hello" }
  ],
  "viewport": { "width": 1280, "height": 800 },
  "waitTimeoutMs": 8000,
  "ignoreTls": false
}
```

| action | 用途 |
| --- | --- |
| `goto` | 導向 `value`（若填）或 `startUrl`／monitor URL；`value` 也走 public-destination guard |
| `click` / `fill` | CSS selector 操作；`fill` 需 `value` |
| `waitFor` | 等待 selector 可見 |
| `assertVisible` | 元素存在且可見 |
| `assertText` / `assertValue` | 包含指定文字／input 值完全相等 |

安全邊界：未知欄位、未知 action 一律拒絕；最多 20 步，selector ≤512 字、value ≤4096 字、
`waitTimeoutMs` ≤30000。**不執行 JavaScript**、不支援登入態 cookie 注入、不做截圖比對
（跑版請用既有 `visual-diff` monitor）。每一步結果（行動／耗時／狀態／錯誤碼）會出現在
Test draft／Test now 面板；排程檢查的心跳只保留 `FLOW_OK`／`FLOW_STEP_FAILED` 代碼。

部署前提：artifact 必須包含 `.playwright/chromium_headless_shell-*` 與 `.playwright/lib/*.so*`，
且 pod 需有 `PLAYWRIGHT_BROWSERS_PATH=/app/.playwright`、`LD_LIBRARY_PATH=/app/.playwright/lib`。
這兩個 env 已寫進 deploy repo chart；一般 Docker image 模式則由 Dockerfile 的
`npx playwright install chromium` 與系統函式庫負責。
