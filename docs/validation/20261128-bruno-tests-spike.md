# Spike：Bruno 整合測試可行性（2026-11-28 11:45 CST）

對應計劃：[20261128-1140-bruno-integration-tests.md](../plans/doing/20261128-1140-bruno-integration-tests.md)。

## 1. `vars:post-response` AST

以 `@usebruno/lang@0.41.0` 的 `bruToJsonV2()` 解析：

```bru
vars:post-response {
  token: res.body.token
  status: res.status
  header: res.headers.x-request-id
}
```

實際輸出：

```json
{"vars":{"res":[
  {"name":"token","value":"res.body.token","enabled":true,"local":false},
  {"name":"status","value":"res.status","enabled":true,"local":false},
  {"name":"header","value":"res.headers.x-request-id","enabled":true,"local":false}
]}}
```

結論：**可用平面 name/value pairs 做白名單萃取**，不需要 platform 專用 `docs {}` metadata。
`bru.setVar("token", res.getBody().token)` 會原樣成為 value，會被白名單拒絕；
`res.body.data.token`、`res.body.items[0].id` 形式可直接交給既有 `parseSelector('$.…')` 驗證。

## 2. Postgres partial unique index

在臨時 DB 建立 `runs(suite_id,status)` 與
`CREATE UNIQUE INDEX … ON runs (suite_id) WHERE status='running'`：

- 第二筆 `status='running'` 插入回 `23505`（阻止）。
- 同 suite 已有 `running` 時仍可插入 `status='pass'`（允許）。

結論：**DB 層單飛可行**，可用於兩個 API pod 同時收到 run 請求的場景；stale run 以 `started_at` 逾時標 `error` 清理。

## 3. `executeHttpRequest` 重用

`server/services/monitor/checkers/http-request.ts:163` 的 `executeHttpRequest(monitor,start,signal)` 是純函式式呼叫，
不依賴 worker 生命周期；整合測試可直接呼叫並沿用 DNS/private IP/allowlist、origin、body/timeout 限制。

## 決定

- 萃取語法：直接用 `vars:post-response` 的白名單子集（不需改 `.bru` 格式）。
- 並發控制：DB partial unique index + stale timeout。
- 不新增環境變數；secrets 用既有 `APP_ENCRYPTION_KEY`。
