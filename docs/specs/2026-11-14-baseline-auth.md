# Spec：可驗證基線與統一認證

狀態：🔵 進行中／待 Sol 實作。日期：2026-11-14。規劃：Astra。上層計畫：[API_PLATFORM_PLAN.md](../API_PLATFORM_PLAN.md)。

## 問題

現有系統的 Socket 初始化將使用者指定為 user 1；API key middleware 與 schema 欄位不同、後續 handler 仍強制 session；存在兩套 socket service 與重複授權。這些問題阻擋任何可信的多 workspace 實作。現有 migration 文件的完成百分比不能替代 build 與整合測試。

## 變更行為

1. 建立可重現 npm 安裝、Prisma generate/validate、build 與 typecheck baseline；記錄舊錯誤，修新增功能必要的 schema drift，不刪使用者資料。
2. 引入唯一 principal helper，session 與有效 API key 共用 downstream handler。拒絕 invalid/expired/inactive key，驗證 user.active；API key 不可由 client 指定 userId。
3. 統一 Socket.IO server 入口，真正驗證 cookie session；移除 mock user、無驗證 authenticate、任意 monitor subscription 及 global private data room。
4. owner-scoped resource guard 先保護既有單 user 資源，下一階段延伸 workspace membership；所有 REST/socket 修改走同一 policy。公開路由採精確 method/path 白名單，不用 `/api/cluster/` 全公開前綴。
5. cluster node mutation、global settings、Cloudflared 控制只有平台管理者，不能只檢查「登入了」。若尚無安全管理員來源，先拒絕危險管理入口並在 UI 表示停用，後續 owner migration 定義 admin。
6. 列表及 socket DTO 明確 whitelist，不能直接 spread Prisma monitor 的 credential 欄位。既有 private monitor 的 public badge/status/RSS 查詢須先驗證被 published status page 明確公開。
7. 建立 auth integration fixture（兩個使用者），執行並保存通過／失敗證據。不要呼叫外部通知或 production API。

首輪切片可先完成 principal/API-key、Socket ticket、owner subscription、production session secret fail-closed、lockfile/build，將公開投影與 workspace 全面 audit 放入下一個獨立切片。未完成的 checkbox 保持 pending，不因第一輪 build 過就將整份 Spec 標完成。Socket 可採 cookie-auth API 發行有效期最多 60 秒的簽署 ticket，handshake 驗證簽章、expiry、active user、origin；ticket 不放 URL，不把它當長期 session。logout/member revoke 的既有 socket 也須失效。下一階段以 explicit scope helpers 實作，避免隱式 Prisma middleware 改寫查詢。

## 受影響檔案

以下路徑授權本階段修改；若需要額外檔案，先補本清單再改。範圍以完成本規格為限，不代表要求全面重寫。

- `package.json`、`package-lock.json`、`nuxt.config.ts`、`tsconfig.json`、`.env.example`
- `prisma/schema.prisma`、`prisma/init.sql`、`prisma/seed.ts`；新增 `prisma/migrations/**`（每個 migration 實際路徑須在驗收紀錄列出）
- `server/middleware/auth.ts`、`server/middleware/api-key.ts`、`server/middleware/rate-limit.ts`
- 新增 `server/utils/auth.ts`、`server/utils/authorization.ts`、`server/utils/serialize.ts`、`server/utils/socket-auth.ts`
- 新增 `server/utils/request-session.ts`、`server/utils/socket-ticket.ts`、`server/api/auth/socket-ticket.post.ts`、`server/api/auth/socket-token.post.ts`（ticket endpoint 二選一，報告記實際檔名）
- `server/utils/prisma.ts`、`server/plugins/socket.ts`、`server/services/socket.ts`、`server/services/socket/index.ts`
- `server/api/auth/login.post.ts`、`server/api/auth/setup.post.ts`、`server/api/auth/logout.post.ts`、`server/api/auth/session.get.ts`
- `server/api/auth/profile.get.ts`、`server/api/auth/profile.put.ts`、`server/api/auth/change-password.post.ts`、`server/api/auth/toggle-auth.post.ts`、`server/api/auth/sessions.get.ts`
- `server/api/auth/2fa/disable.post.ts`、`server/api/auth/2fa/setup.post.ts`、`server/api/auth/2fa/verify.post.ts`、`server/api/auth/2fa/status.get.ts`
- `server/api/cluster/nodes.get.ts`、`server/api/cluster/current.get.ts`、`server/api/cluster/switch.post.ts`、`server/api/node-info.get.ts`
- `server/api/v1/monitors/index.get.ts`、`server/api/v1/monitors/index.post.ts`、`server/api/v1/monitors/[id].get.ts`、`server/api/v1/monitors/[id].put.ts`、`server/api/v1/monitors/[id].delete.ts`
- `server/api/v1/monitors/[id]/clone.post.ts`、`server/api/v1/monitors/[id]/heartbeats.get.ts`、`server/api/v1/monitors/[id]/uptime.get.ts`、`server/api/v1/monitors/[id]/certificate.get.ts`、`server/api/v1/monitors/[id]/pause.post.ts`、`server/api/v1/monitors/[id]/resume.post.ts`
- `server/api/v1/api-keys/index.get.ts`、`server/api/v1/api-keys/index.post.ts`、`server/api/v1/api-keys/[id].put.ts`、`server/api/v1/api-keys/[id].delete.ts`
- `types/socket.ts`、`types/index.ts`；新增 `types/auth.ts`
- `composables/useSocket.ts`、`composables/useAuth.ts`、`plugins/socket.client.ts`（如檔名不同先更新清單）
- 新增 `tests/auth.test.ts`、`tests/auth.integration.test.ts`、`tests/socket.integration.test.ts`、`tests/helpers/**`、`vitest.config.ts`（如採 Node test 則先列實際檔名）
- 新增 `docs/validation/baseline-auth.md`

統一 request-session helper 會機械性替換以下既有 handlers 的 getUserSession 呼叫；此變更只統一認證，不代表該 route 已有完整 workspace isolation：

- `server/api/settings/appearance.get.ts`、`server/api/settings/appearance.post.ts`、`server/api/settings/general.get.ts`、`server/api/settings/general.post.ts`
- `server/api/v1/backup/import.post.ts`、`server/api/v1/backup/export.get.ts`、`server/api/v1/settings/tls-expiry.put.ts`、`server/api/v1/settings/tls-expiry.get.ts`
- `server/api/v1/nodes/index.get.ts`、`server/api/v1/nodes/index.post.ts`、`server/api/v1/nodes/[id].get.ts`、`server/api/v1/nodes/[id].put.ts`、`server/api/v1/nodes/[id].delete.ts`
- `server/api/v1/proxies/index.get.ts`、`server/api/v1/proxies/index.post.ts`、`server/api/v1/proxies/[id].put.ts`、`server/api/v1/proxies/[id].delete.ts`
- `server/api/v1/status-pages/index.get.ts`、`server/api/v1/status-pages/index.post.ts`、`server/api/v1/status-pages/[slug]/index.get.ts`、`server/api/v1/status-pages/[slug]/incidents.post.ts`、`server/api/v1/status-pages/[slug]/index.put.ts`、`server/api/v1/status-pages/[slug]/upload-logo.post.ts`、`server/api/v1/status-pages/[slug]/incident.delete.ts`、`server/api/v1/status-pages/[slug]/index.delete.ts`、`server/api/v1/status-pages/[slug]/monitors.get.ts`
- `server/api/v1/notifications/index.get.ts`、`server/api/v1/notifications/index.post.ts`、`server/api/v1/notifications/[id].put.ts`、`server/api/v1/notifications/[id].delete.ts`、`server/api/v1/notifications/test.post.ts`
- `server/api/v1/remote-browsers/index.get.ts`、`server/api/v1/remote-browsers/index.post.ts`、`server/api/v1/remote-browsers/[id].put.ts`、`server/api/v1/remote-browsers/[id].delete.ts`
- `server/api/v1/tags/index.get.ts`、`server/api/v1/tags/index.post.ts`、`server/api/v1/tags/[id].delete.ts`
- `server/api/v1/maintenance/index.get.ts`、`server/api/v1/maintenance/index.post.ts`、`server/api/v1/maintenance/clear-statistics.post.ts`、`server/api/v1/maintenance/clear-events.post.ts`、`server/api/v1/maintenance/[id].delete.ts`、`server/api/v1/maintenance/clear-heartbeats.post.ts`
- `server/api/v1/maintenances/index.get.ts`、`server/api/v1/maintenances/index.post.ts`、`server/api/v1/maintenances/[id].get.ts`、`server/api/v1/maintenances/[id]/resume.post.ts`、`server/api/v1/maintenances/[id]/pause.post.ts`、`server/api/v1/maintenances/[id].put.ts`、`server/api/v1/maintenances/[id].delete.ts`
- `server/api/v1/docker-hosts/index.get.ts`、`server/api/v1/docker-hosts/index.post.ts`、`server/api/v1/docker-hosts/[id].put.ts`、`server/api/v1/docker-hosts/[id].delete.ts`、`server/api/v1/docker-hosts/test.post.ts`

workspace 隔離下一階段必須擴充範圍至全體 `server/api/v1`、public APIs、socket resource relations 與 UI；不可只改上述 monitors routes 後就宣稱 workspace 完成。

補充實際檔案：`server/plugins/00-auth-security.ts`、`tests/auth.test.ts`、`tests/auth.integration.test.ts`（Node test + tsx），`shared/types/auth.d.ts`。

## 可驗收條件

- [ ] npm 安裝與 Prisma validate/generate 可重現；build 成功，typecheck 結果及既有錯誤有紀錄。
- [ ] 未登入 REST/private socket 被拒；偽造 userId、無效 key、過期 key、inactive user 均不能通過。
- [ ] A 使用者不能 GET/PUT/DELETE/clone/pause B 的 monitor，也不能以 socket 訂閱／修改 B 資源。
- [ ] API key 可在沒有 cookie 的情況依 scope 存取允許的 REST API；cookie 不會被 invalid key 靜默升權。
- [ ] Socket 不再有 mock user 1 或 anonymous authenticated=true；connection/subscription/mutation 都有驗證。
- [ ] 首頁 monitor DTO／socket frame 不含 password/token/headers/database connection string。
- [ ] public status page 仍可讀 published 的安全摘要，private monitor ID 不可透過 badge/history/RSS 外洩。
- [ ] 真正 PostgreSQL + HTTP + socket 整合測試通過；沒有只測 mock implementation。

## 回滾與相容性

使用 additive migration，先保留既有 userId 與 session 登入方式；schema 變更不執行 destructive reset。若舊 socket API 不再安全則明確回傳 unsupported/auth error，前端改用已授權 API。測試使用獨立 DB，不更新既有正式部署。實作完填入驗收證據再將狀態改為完成。

Seed相容修正：`prisma/seed.ts` 不再建立硬編密碼admin與未綁workspace/sample外站notification；初次管理者需顯式SEED_ADMIN_PASSWORD（≥12字），建立platform admin及personal workspace/default environment，既有使用者不自動提升權限。不輸出明文密碼。受影響`.env.example`文件seed項與migration驗收fresh seed。

雙測試域名：新增`server/utils/allowed-origins.ts`與`.env.example APP_ALLOWED_ORIGINS`精確origin allowlist（含primary、最多8個、拒萬用字元／userinfo／非http(s)／path）；`server/services/socket.ts` CORS與handshake檢同名單；`plugins/socket.client.ts`連current window origin保留host-local session，`server/plugins/00-database.ts`啟動時驗設定。新增`tests/allowed-origins.test.ts`。不接受任意來源。
