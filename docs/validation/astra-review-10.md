# Astra 第十輪：5A 狀態頁、訂閱順序與 SSR 邊界

日期：2026-11-14，約台北 12:15–12:25。以共享工作樹最新 source 為準；Sol 在本輪同步修正，以下區分初次 finding、後續讀碼覆核及實測。Astra 沒有改產品碼、另起 build、重啟服務或修改共用 DB。本輪不宣告 5A／完整 regression 完成。

## 前輪三項逐項核對

1. **Socket 上限／最新頁順序**：single 與 batch mutation 的 per-socket queue 已使 200-ID 上限在序列化區段內檢查；但初讀仍發現 `socket.use` 先 `await validSocket`，之後才進 handler queue，兩次授權查詢可後發先完成。Astra 用本機臨時 HTTP＋真 Socket.IO（隨機 port、結束即關閉）重現同樣控制流程：arrival=`old-page,new-page`，故意讓第一個授權慢 80ms、第二個慢 5ms，commit=`new-page,old-page`，最後落在舊頁。已交 Sol，最新 `server/services/socket.ts` 在 await 前加入 bounded `SerialQueue`，再交 mutation queue，讀碼已關閉此重排入口。Astra 獨立執行 `node --import tsx --test tests/serial-queue.test.ts`，延遲首授權與 bounded queue/recovery **2/2 通過**。既有真 socket 200-ID／page replacement 測試仍需隨最新 production build 重跑。
2. **Bruno replace 暫停 coverage**：`server/services/bruno/importer.ts` 在 monitor row lock 後讀 `{id,interval,active}`，把真 row 傳入 `fenceMonitorData`。既有 active 替換為 paused 可建立 PAUSED heartbeat／state revision 邊界；不再傳缺 active 的合成 row。讀碼修復確認；本輪未獨立跑 Bruno＋uptime 跨功能 fixture。
3. **Dashboard STALE 恢復**：`pages/dashboard/index.vue` 由最新 heartbeat 重新計算 viewStatus；不再優先使用 fetch 時舊 stale 值。summary/events 以 15 秒 bounded refresh 更新，沒有逐 heartbeat 打 summary API。讀碼修復確認；這表示摘要可能延遲最多一個 refresh 週期，不能描述為每筆事件即時更新。

## 本輪追加的實際問題與修復

- **已連線 socket 的頁面導航**：detail unmount 僅 unsubscribe，plugin `connect()` 會重用已連線 socket。Dashboard 原本只在未來 `connect` event 設 Live／訂閱，而 immediate watch 在 mounted 前 socket 仍 null；detail→dashboard 可顯示 Offline 且等到 15 秒刷新才訂閱。已交 Sol；最新 mounted 立即設定 `socketConnected=socket.connected`，對已連線 socket 立即訂閱 visible IDs。讀碼修復確認，待 browser 導航驗收。
- **Status page list raw Prisma BigInt**：root 獨立查看 `server-ssr-fixed.log` 發現 `GET /api/v1/status-pages` 500 `Do not know how to serialize a BigInt`。原 handler 回傳 `groups.monitors.monitor: true`，不僅造成序列化失敗，也違反安全 DTO／bounded monitor read 原則。最新 `server/api/v1/status-pages/index.get.ts` 只讀 page metadata 並用 `statusConfig` 白名單，不再 include monitor。此項為 root 的 runtime finding、Astra 的 source 覆核；不能把原 browser 單項 PASS 當列表 API 已成功。保存後需驗 list HTTP 200 且實際看到該頁，而非僅 waitForURL/pageerror 為空。
- **舊測試契約**：審查時 `tests/workspace.integration.test.ts` 的 foreign public-heartbeat IDs 仍期待 200＋空集合；新 `publicHeartbeatHandler` 明確回 404。已通知 Sol 修改為 404 負例，並保持其他公開欄位／secret 不外洩斷言；這是測試需同步，不要求放寬新 handler。

## Private status-page config 與 300 選擇

`server/api/v1/status-pages/[slug]/config.get.ts` 不符合 auth/workspace middleware 的公開路由 regex，handler 另外要求 editor。Page 以 slug＋workspace 查找，links 也限制 monitor.workspaceId；回傳 monitor 僅 id/name。最多 100 groups／4000 links，查到上限外一筆即 413，不靜默截斷。

狀態頁是 workspace 級資源，既有跨 environment 關聯是有效情境。Config 回完整既有 metadata；`useMonitorPicker` 的可搜尋 options 仍限當前 environment，selected ID 不會被當頁 options 覆寫，缺少 lookup metadata 也保留 ID。Editor 的 payload 由 original groups 保留已選集合，把新增 ID 放入第一組；PUT 在 transaction 內驗 group ownership 與 workspace monitor IDs，跨 workspace 混入會整批拒絕。未發現新 config GET 的 raw secret／BigInt 投影或 300-ID 截斷。

待整合測試確認的具體邊界：匿名 config 401、viewer 403、foreign workspace/slug 404；published page 也不能繞過 config 授權；300 個既有 ID＋1 個新 ID 保存後以**精確集合**比對，並保留其他 environment 的既有 ID；foreign group／monitor 混入需拒絕且原關聯不變。Browser 的 `count=301` 單獨不足以證明原有 300 個未被替換。

## SSR 與 visible-page heartbeat bars

Dashboard 的 socket 操作在 mounted，client-only plugin 不會在 SSR 強制連線；picker／recent-history watch 有 `import.meta.server` guard，SSR 的 `useFetch` 帶 request cookie。100 rows 的 recent-heartbeats 請求使用 visible IDs，回應同時檢 `historySequence` 與當前 ID 集合，避免舊頁 history 覆蓋新頁；合併先保留 live beats 再去重。有此 source guard 不等於瀏覽器競態已實測，後續 fresh SSR／快速翻頁的 production browser 結果由 Sol 報告。

## Root MCP／health 證據及限制

- `.data/validation-logs/root-health-setup.json`，時間 `2026-11-14T04:13:30.368Z`：live 200、ready 200（role=all）、已初始化 setup POST 400。
- `.data/validation-logs/root-mcp-monitors-mobile-before.jpg`：早期 mobile 版面問題的來源。
- `.data/validation-logs/root-mcp-dashboard-desktop.jpg`：root MCP 1280×900 最新桌機畫面，5 個 paused demo；events 收合且移至 list 後。
- `.data/validation-logs/root-mcp-monitors-mobile-after.jpg`：root MCP 390×844 最新手機畫面；root 量得 document/body scrollWidth=375≤390、type 改選單且 row type 分行、mobile navigation→Monitors 可用。

上述是 root 實際 MCP 操作與已存在的檔案，Astra 沒有重新操作瀏覽器。它們證明 demo／版面／health，不是 4000 活躍 monitor 效能。Root console 有舊 build 12:12:27 hydration mismatch；12:21 新操作未見新增錯誤，不能宣稱所有歷史 console 無錯。舊 68/68 與這次局部證據皆不能取代最終新 build 全套驗收。

### 後續 root 驗證補記

Root 後續以 MCP 確認 Dashboard 顯示 Live，從 monitor detail 返回 Dashboard 的訂閱／連線狀態正常；此項把前述「待 browser 導航驗收」補為 root MCP 已驗。另有 `.data/validation-logs/root-mcp-dashboard-after.jpg` 留存後續畫面。Root 也回報獨立 Origin／SerialQueue 單項 **3/3 通過**；本補記引用 root 的執行回報，不把它混同 Astra 前述 SerialQueue 2/2 或舊完整 suite 數字。這些結果仍不代表 5B／phase6 或所有歷史 console 已通過。
