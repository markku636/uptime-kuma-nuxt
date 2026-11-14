# Spec：共用資源憑證封存與安全編輯

狀態：🔵 待實作。日期：2026-11-14。Astra 規劃／審查，單一 Sol 實作。phase3.5，接在 Bruno 穩定點後、distributed scheduler/outbox 前。此項修復 workspace viewer 可從四種共用資源列表讀到憑證的缺口，不增加新的角色。

## 目標與邊界

notification、proxy、docker host、remote browser 的所有 API 回應採白名單 DTO，既有秘密不回傳給 viewer、editor、owner 或 API key。viewer 可選擇／查看資源名稱與狀態，但不能讀原始設定。editor 維持可信操作者，可使用既有憑證測試、修改目的地與替換設定；這不構成對惡意 editor 的秘密使用隔離。跨 workspace ID 仍一律 404，viewer/read key 的 mutation/test 403。

| 資源 | 封存內容 | 可公開給同 workspace 的欄位 |
| --- | --- | --- |
| Notification | 整份 config（包含 provider URL、token、帳密、headers、custom body） | id/name/type/active/isDefault/configured |
| Proxy | host、username、password；host 舊資料可能是帶 userinfo/query 的 URL | id、protocol、port、auth、active、isDefault、configured；如需顯示 name 由安全欄位提供 |
| DockerHost | connectionUrl、dockerDaemon（socket path 也作設定而非公開 metadata） | id/name/dockerType/active/configured |
| RemoteBrowser | url 整欄（可能是 CDP capability URL） | id/name/active/configured |

允許 configured 為欄位布林 map；不以秘密字串前綴／後綴、mask 長度或 hostname 洩漏實值。createdAt/workspaceId 等必要識別可加入白名單。避免 `...row` 後刪幾個欄位；POST/PUT、list、關聯 include、backup/export、socket 與錯誤回應都必須查。

## 儲存、更新與讀取

四表各增加 nullable `resource_secrets`（Prisma `resourceSecrets`）或等價 envelope 欄位，採既有 APP_ENCRYPTION_KEY/AES-GCM，AAD 為 resource type + workspaceId + resourceId + envelope version。不同資源類型即使數字 ID 相同也不能互換 envelope。只在 server consumer／試跑執行前解密，secret holder 不進 client serialize/log。

封存後 legacy sensitive 欄位清空：nullable 欄位 null；Notification.config 可改預設空物件；目前 Proxy.host/RemoteBrowser.url 是 NOT NULL，保留空字串作無秘密佔位或 migration 改 nullable，決策需一致並測。不要把密文直接塞到使用者可讀 host/url/config 欄而讓 DTO 當普通設定回傳。新增資源先 reserve/create ID 再 seal，同一 transaction 完成，沒有裸秘密 row 的可觀察時間窗。

缺欄位表示 preserve；明確 clear 指令清除；顯式 replacement 表示使用新值。clear+replace 同欄採與 monitor 相同的 replacement wins，或 schema 明確拒絕，保存與 test 必須共用 merge helper。空字串／空物件不得被 UI 編輯名稱的預設表單意外當成清除。

Notification 可將 config 作整份 atomic replace：畫面明確「保留已儲存設定」或「替換設定」，只改 name/active/isDefault 時不送 config；切換 provider type 必須提供新設定或明確清除，不把舊 provider 憑證交給另一 provider。不能用 placeholder `******` 作真值保存。若採逐欄 merge，需由共用 schema 明確定義 null/absent/clear 語意與 nested key 上限，不能任意 deep merge。

PUT 在 transaction 內鎖定目標 row、重讀 current envelope 後合併，避免並發 rename 把另一人的新憑證覆蓋回舊值。create/update 需有限 name/config 字串長度、最多 keys／JSON bytes、合法型別及 unsupported provider 行為。任意 config 不能無限制 `z.any`。

測試既有資源以 resource ID + 可選 overrides，由 server 同 scope 查詢／hydrate／套共同 merge，前端不用先讀秘密再送回。通知、Docker 與 remote browser 測試回傳安全結果分類，不能輸出原始 provider exception、response body、webSocketDebuggerUrl 或輸入 URL。local mock failure 回傳帶秘密的 error 也不能洩漏。所有 test I/O 有 total timeout、有限回應 bytes、並發限制，且 viewer/read key 不可啟動 I/O。保留可信 private-location/loopback 用例，不以一刀禁止內網代替權限及資源限制。

## Backfill 與 DB 回復

新增 `prisma/migrations/20261114035000_resource_secrets/migration.sql`，只 expand schema；secret backfill 共用 `securityReady`，在 API/背景工作啟動前完成。以有限批次與既有 advisory/init 機制防多 process 競態；鎖 row 並在 transaction 內將 plaintext seal + clear，重跑冪等。已 sealed rows 若仍有遺留敏感欄位，依確定優先序修復／fail-closed，不忽略裸秘密殘留。

缺 key、錯 key、錯 AAD、損壞 envelope 時不開放配置 API、不啟動通知/監測 side effects；不要以空值繼續運行並宣稱 configured。不得 log 原始 row／config／secret value。fresh DB、legacy plain、已 sealed + plain residue、backfill interrupted/retry 都驗收。

回復先停止相關工作並保留新增欄位／表與密文，不提供一般降級解密回明文 migration。舊 binary 不懂 envelope，不能直接回退後將空欄位當正常設定啟用；採相容版本前滾或 maintenance。備份仍只輸出 placeholders／safe metadata，不備份解密 secrets。

## 受影響檔案

- `prisma/schema.prisma`、新增 `prisma/migrations/20261114035000_resource_secrets/migration.sql`。
- 新增 `server/utils/resource-secrets.ts`、`server/utils/resource-input.ts`（可依責任合併）、`server/utils/security-bootstrap.ts`、`server/plugins/00-auth-security.ts`、`server/middleware/00-auth-ready.ts`、`server/utils/variables.ts`。
- `server/api/v1/notifications/index.get.ts`、`index.post.ts`、`[id].put.ts`、`[id].delete.ts`、`test.post.ts`。
- `server/api/v1/proxies/index.get.ts`、`index.post.ts`、`[id].put.ts`、`[id].delete.ts`。
- `server/api/v1/docker-hosts/index.get.ts`、`index.post.ts`、`[id].put.ts`、`[id].delete.ts`、`test.post.ts`。
- `server/api/v1/remote-browsers/index.get.ts`、`index.post.ts`、`[id].put.ts`、`[id].delete.ts`、`test.post.ts`。
- `server/services/notification/sender.ts`、`server/services/notification/providers/**`、phase4 新增的 `outbox.ts`/`dispatcher.ts`（建立後套相同 consumer 契約）；不得讓 provider 直接讀裸 Prisma config。
- `server/services/monitor/checker.ts`、`server/services/monitor/checkers/docker-checker.ts`、相關 HTTP/proxy/browser consumers；`server/utils/backup.ts`、`server/utils/serialize.ts`、必要 resource 關聯 include DTO。
- `pages/settings/notifications.vue`、`proxies.vue`、`docker-hosts.vue`、`remote-browsers.vue`；`components/notification/NotificationDialog.vue`、`NotificationForm.vue`、`components/notification/providers/**`、`components/proxy/ProxyDialog.vue`、`components/docker/DockerHostDialog.vue`、`components/remote-browser/RemoteBrowserDialog.vue`、`components/settings/RemoteBrowserCheck.vue`。
- monitor form／resource picker 實際使用檔案（如 `components/monitor/MonitorForm.vue`）、共用 resource type/composable：`types/notification.ts`、`types/proxy.ts`、`types/docker.ts`、`types/remote-browser.ts` 或 `shared/types/**`；按 repo 真實檔名選擇，無需為未使用檔名建立空殼。
- 新增 `tests/resource-secrets.test.ts`、`tests/resource-secrets.integration.test.ts`、必要 browser test；`tests/notifications.integration.test.ts`、`tests/workspace.integration.test.ts`、`tests/migration.integration.test.ts`、`tests/setup.integration.test.ts`／bootstrap tests、`scripts/test-unit.mjs`。
- 新增 `docs/validation/resource-secrets.md`、相關相容性文件與本 Spec。若必須新增依賴才改 `package.json`/`package-lock.json`，優先沿用已有加密/HTTP實作。

## 驗收

- [ ] 真 PG + HTTP：四資源分別帶獨立 sentinel，viewer/read key/editor/owner 的 GET 與 create/update 回應皆無 raw config/password/URL/密文；DB legacy 欄位無 sentinel，密文可由合法 consumer 正確解開。
- [ ] 同 user 兩 workspace、兩 user 同 workspace；前者拒外部 ID，後者 viewer 可安全讀列表、editor可使用既有設定測試；mutation/test 403 矩陣不退化。
- [ ] rename/toggle preserves secrets；replacement、clear、clear+replace、provider type 改變、並發部分更新、test+save 同語意；UI blank/password placeholder 不覆蓋既有值。
- [ ] AAD 跨 workspace／resource type／ID 換置失敗；fresh/legacy/residue backfill 冪等；bootstrap failure 零 I/O。
- [ ] provider failure message、Docker error、remote browser response 帶 sentinel 的情況，API/log/DTO 均無秘密；不回 CDP debugger capability URL。
- [ ] 真 local notification sink 在安全儲存後仍只收自身 workspace 的安全事件；tests 不寄真外部信。bounded timeout/response/body 故障不洩漏原文。
- [ ] Browser 至少 notification 與 URL 類資源各一條：建立→編輯名稱→重載→test-by-id→替換／清除；viewer頁無秘密或編輯/test按鈕，server仍獨立守權限。

通知 provider 的成功必須表示真的執行受支援傳輸。現有 `providers/email.ts` 僅 console.log 的 placeholder 不能回傳「已寄送」或在 outbox 標 delivered；若本輪不做 SMTP，明確不支援並調整 UI／test 回應。無需為驗收使用真外部信箱。

Sol 實作檔案補充（仍🔵，先列再改）：`server/services/notification/transport.ts`（共用有限 HTTP transport）、`server/utils/resource-probe.ts`（test-by-id/merge/試跑容量與 socket ping），`server/services/monitor/cert-expiry-notification.ts`（既有通知 consumer 的 workspace 與 hydrate），`server/api/v1/monitors/[id].get.ts`（關聯通知 DTO），`composables/useRemoteBrowsers.ts`（既有 response envelope 解包）。

UI 實作補充：新增 `components/settings/ResourceEditor.vue` 與 `ResourceSettings.vue`，共用四資源 write-only 編輯／test-by-id 邏輯，settings pages 與既有 dialogs 複用，取代原本 provider UI 與 sender 欄位名稱不一致的表單。通知保留 TLS 全域設定區；不支援的 provider 保留既有 metadata，但不可選為新傳輸／宣稱已送達。
