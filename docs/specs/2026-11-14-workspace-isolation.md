# Spec：Workspace、環境與公開投影

狀態：🔵 進行中。依 Astra 的 API_PLATFORM_PLAN.md 第1階段實作；此文件列本輪實際變更範圍與驗收，規劃審查仍由Astra負責。

## 行為

每位既有使用者遷移personal workspace及default environment，保留所有既有資源及userId。Workspace為Monitor、Tag、Notification、Proxy、DockerHost、RemoteBrowser、Maintenance、StatusPage、ApiKey的隔離邊界；Monitor另外綁environment。owner管會員及secret；editor管資源；viewer唯讀；platformAdmin僅管理全域入口，不自動繞過workspace。

所有REST principal解析已驗證scope（header/cookie選擇，不信任body userId），個別查詢明確scope where/data，不使用隱式Prisma攔截。關聯ID於transaction內驗同workspace；foreign ID與不存在ID皆404。API key綁workspace，可選environment與read/write scope，撤銷membership立即失效。新增workspaces、members、environments CRUD與UI；環境變數靜態值與AES256-GCM secret envelope分開，secret輸出僅名稱及已設定狀態，key由APP_ENCRYPTION_KEY部署環境提供。

Socket ticket綁workspace/environment；訂閱與每次私有事件發送重驗user/sessionVersion/membership/environment。切換UI重建頁面、socket與store，不保留舊scope資料。舊socket mutations沿用REST_REQUIRED。

公開status/badge/heartbeat/RSS僅published頁面及明確選入的同workspace monitor，使用白名單DTO，不出URL、headers、push token、request credentials及heartbeat原始錯誤。no_pagination限有權限editor/owner，匿名列表有上限。

修復本輪必要的既有schema drift（maintenance缺owner、關聯名稱錯誤、tags/maintenance/certificate全域查詢），保留現有API response envelope；backup/export只輸出可審閱安全投影，匯入只接受本workspace的已驗證欄位、paused且atomic。

## 受影響檔案

- `prisma/schema.prisma`、`prisma/init.sql`、新增`prisma/migrations/20261114000000_baseline/migration.sql`、`prisma/migrations/20261114010000_workspaces/migration.sql`、`prisma/migrations/migration_lock.toml`。
- 新增`server/utils/workspace.ts`、`server/utils/variables.ts`、`server/utils/resource-crud.ts`、`server/utils/public-status.ts`、`scripts/migrate.mjs`。
- `server/utils/request-session.ts`、`server/utils/serialize.ts`、`server/utils/socket-ticket.ts`、`server/utils/prisma.ts`、`server/middleware/auth.ts`、`server/middleware/api-key.ts`、新增`server/middleware/workspace.ts`。
- `server/services/socket.ts`、`server/services/socket/index.ts`、`server/services/maintenance/scheduler.ts`、`server/services/monitor/checker.ts`、`server/services/notification/sender.ts`。
- `server/plugins/00-auth-security.ts`、`server/api/auth/socket-ticket.post.ts`、`server/api/auth/setup.post.ts`。
- 所有`server/api/v1/**`、`server/api/badge/**`、`server/api/status/**`、`server/api/status-page/**`、`server/api/push/**`（逐入口授權/公開投影audit，不能代表全部實作完成）。
- 新增`server/api/v1/workspaces/**`、`server/api/v1/users/**`。
- 新增`composables/useWorkspace.ts`、`components/layout/WorkspaceSelector.vue`、`pages/settings/workspaces.vue`；`layouts/default.vue`、`pages/settings.vue`、`pages/settings/index.vue`、`plugins/socket.client.ts`、`composables/useProxies.ts`、`composables/useNotifications.ts`、`composables/useRemoteBrowsers.ts`、`types/**`、`shared/types/**`。
- `.env.example`、`package.json`、`package-lock.json`、`docker-entrypoint.sh`、`Dockerfile`（migration/package manager一致性，K8s仍後續階段）。
- 新增`tests/workspace.integration.test.ts`、`tests/variables.test.ts`、`tests/migration.integration.test.ts`、`tests/helpers/**`；既有`tests/auth.integration.test.ts`。
- 新增`docs/validation/workspace-isolation.md`、更新`docs/validation/baseline-auth.md`。

補充實際檔案：`pages/settings/api-keys.vue`、`tests/setup.integration.test.ts`、`pages/dashboard/index.vue`、`pages/monitors/[id]/index.vue`、`components/monitor/MonitorForm.vue`、`components/monitor/MonitorList.vue`、`server/utils/monitor-input.ts`、`server/utils/backup.ts`、`scripts/migration-preflight.mjs`。

## 驗收

真PG遷移保留既有user/monitor/heartbeat；兩user/兩workspace/兩env讀寫與關聯ID negative；owner/editor/viewer矩陣；API-key read-only、membership撤銷；socket撤銷/停權/切換無越權事件；public status/badge/alias不出secret；環境secret加解密、篡改與未配置key；build和新增檔型別檢查。瀏覽器驗收如無MCP明列限制。

## Astra 補充：遷移與關聯驗收（2026-11-14）

遷移不能僅憑 `users` table 存在就宣告 baseline 已套用。先確認所有必要 tables、columns、FK 及 schema 版本；未知 partial schema 必須拒絕並輸出差異。備份與 migration fixture 使用專用 DB；成功後核對 user、monitor、heartbeat 數量與內容不變，既有 API key caller credential 仍可用但 DB 不再存明文。初次 setup 以 transaction lock 將「沒有 user」與建立唯一 platform admin 原子化，並行兩次匿名 setup 只能成功一次。

跨 owner legacy relations 預設先 preflight 掃描並中止遷移，提供不含 secret 的 source/row ID repair report；不得靜默刪除關聯或將資源歸給任意 workspace。若產品決策採 quarantine/unlink，需獨立記錄此決策、精確受影響 rows、恢復命令、原子性及驗收，不能宣稱既有功能完全保留。migration rollback 依總Plan：保留 additive schema，停 worker，workspace sharing 開始後不可直接讓舊 userId-only 版本對外。

關聯覆蓋矩陣：monitor→environment/proxy/parent/remoteBrowser/dockerHost/tags/notifications；maintenance→monitors/statusPages；statusPage→groups→monitors；incident→statusPage；apiKey→workspace/environment。每個寫入／clone／import 都須測同workspace成功、跨workspace拒絕、不存在ID拒絕；bulk中混入一個外部ID整批rollback。owner userId不同但workspace相同應成功，避免仍依userId拒絕共享；同user擁有兩workspace仍不可跨scope寫入，避免只測跨user而漏掉workspace。

- [ ] 新安裝及原snapshot schema migration各跑一次；再次執行不增加workspace/member/default env或重複hash API key。
- [ ] 未知partial schema、orphan user_id、跨owner legacy join均有可預測失敗，transaction沒有半套變更。
- [ ] 同user兩workspace＋每workspace兩env；切換列表、詳情、history、test、clone、export、socket都不殘留舊scope。
- [ ] 同workspace不同user共享資源，viewer不能POST/PUT/PATCH/DELETE/試跑/匯入；editor不能更改會員/secret；owner不能操作global cluster。
- [ ] read API key、write API key及environment-scoped key覆蓋允許與拒絕案例；不能用workspace header/body/route逃出key scope。
- [ ] 同時移除／降級最後兩位owner後仍至少一owner；授權檢查與membership變更於鎖內重驗，不使用transaction外過期role。
- [ ] 移除membership、停用user、logout/sessionVersion提升後，idle socket也收不到下一筆事件；API立即拒絕。
- [ ] viewer/API list/public APIs/socket/backup的response body不含植入fixture的sentinel secret（header、URL query、body、basic auth、DB connection、secret env及raw heartbeat msg）。
- [ ] environment secret envelope綁workspace/environment/name AAD；複製ciphertext至另一context、改tag、缺key均fail-closed；secret不能經普通variable API重分類後讀出。
- [ ] resource foreign key無環境跨workspace漏洞；禁止更新workspaceId/userId以搬移歸屬；resource移動若未實作則明確拒絕。

Pagination不可因 `no_pagination` 就允許任一角色無上限取全資料；如為管理匯出需求，採有最大筆數／streaming的獨立export。列表全workspace統計與當前environment統計需明確標示，不能把一頁的數量當全域。

Astra確認同user不同workspace的default notification曾跨界：修`server/services/notification/sender.ts`只選monitor workspace，linked也顯式核對scope；通知不含URL/userinfo/query/raw checker msg。新增`tests/notifications.integration.test.ts`以兩local sinks及故意跨workspace舊關聯負例驗證。
