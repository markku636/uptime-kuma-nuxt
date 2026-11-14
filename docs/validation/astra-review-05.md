# Astra 第五輪審查：共用資源秘密

日期：2026-11-14。Sol 要求在 phase4 前檢查同 workspace viewer 的 notification/proxy/docker-host/remote-browser GET。只讀產品檔與執行隔離 handler fixture，沒有修改 DB、沒有外部 HTTP、沒有修改產品程式。

## 確切發現

`server/middleware/workspace.ts` 對 GET 使用 viewer 最低權限。以下四個 GET handler 只確認登入及 workspace filter，然後直接回傳 Prisma rows，沒有 secret DTO：

| 路徑 | 洩漏欄位 | 例子 |
| --- | --- | --- |
| `/api/v1/notifications` | config 整份 | bot token、SMTP password、webhook Authorization／URL |
| `/api/v1/proxies` | username、password、host | 帳密與 legacy host URL userinfo/query |
| `/api/v1/docker-hosts` | connectionUrl、dockerDaemon | URL 帳密／token、私有 socket path |
| `/api/v1/remote-browsers` | url | CDP access token／capability URL |

這是同 workspace 讀取權限內的秘密外洩，不是跨 workspace 查詢未加 scope；跨 workspace 過濾本身存在。read API key 也走可讀路徑。四資源 POST/PUT 回應同樣直接回 row，會回顯既有或新配置，故不能只修 GET。

## 獨立重現方法與結果

以 repo `tsx` 執行 stdin ES module，提供 `/tmp/astra-resource-review-tsconfig.json` 僅解析 Nuxt `~/*` alias。直接 import 四個真 `index.get.ts`，在該獨立 process 中 stub `prisma.<model>.findMany` 回傳包含 sentinel 的 row，stub `requireRequestSession` 為 viewer principal；其他 handler 邏輯保持原檔。沒有修改 repo test／產品檔，也不連資料庫。

四個結果皆 `rawSecretReturned: true`；returnedFields 分別包含 config、password、connectionUrl、url。這是 handler projection 的獨立證據；middleware 最低權限由讀碼確認，不把 mock principal 稱為真 production 登入測試。修正後仍須由 Sol 的 PG/HTTP integration 覆蓋 viewer/read-key/owner/editor。

## 相鄰錯誤回應與通知問題

- notification test、Docker test 將 `error.message` 拼接到 HTTP 回應，可能包含輸入憑證或 provider 回應；應用安全分類取代。
- remote-browser test 成功回傳遠端 `webSocketDebuggerUrl`，可能是持有即可存取的能力網址；失敗也回原始 message。成功只需連通性／安全版本資訊，不能回 capability URL。
- 現有 email provider 只是 console.log 並 resolve，sender/test 會把它當成功。phase4 dispatcher 不可將 placeholder 標為 delivered；需真正支援或明確 unsupported。
- webhook provider 的 `$fetch` 沒有 explicit timeout；phase4 bounded send 需處理，不能將 Promise.race 逾時視為底層傳輸已取消。

新增 [共用資源 secrets 🔵 Spec](../specs/2026-11-14-resource-secrets.md)，已交 Sol 作 phase3.5：安全 DTO、欄位 preserve/clear、AES envelope/AAD、securityReady backfill、consumer hydrate 與 UI。不把此文件當成上述修正已完成。
