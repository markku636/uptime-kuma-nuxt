# 2026-11-15 Bruno 群組／light 主題／節點拓樸部署

- 原始碼：`513de09`（乾淨工作樹）。Runtime artifact `def6fb789ae97695c4a58ebf364906db6cbbac0ad48d2dbedcde3b4b373d7526`，201945733 bytes。
- 傳輸：本機一次性單檔 HTTP（192.168.50.57:32491，只回 `/runtime.tgz`），loader 讀完即關閉。
- GitOps（V-TERMINAL MCP，只推本 chart）：`fbcbd97` 載入＋`NODE_NAME` env（revision 13）→ `eb9c5a2` migration（revision 14）→ `2239724` application（revision 15）。
- Loader Job：`Verified immutable artifact installed`。Migration Job：Node 24.22.0／Prisma 6.19.1 runtime check passed，套用 `20261115010000_monitor_groups`（只加不刪）。
- Rollout：API 2/2、worker 2/2 Ready，均在 testing-machine（單一實體 node）。
- 線上驗證：兩域 `/login` 200、`/api/v1/groups` 401（新路由存在）、兩域都送出含 `Runtime topology` 的新 bundle；登入頁 light 主按鈕 rgb(4,120,87)＋白字、dark rgb(92,221,139)＋深色字，無 hydration 訊息。
- 未驗證：登入後畫面（Groups、Nodes、Bruno 匯入匯出）未在線上實點 —— 正式網域不由 agent 輸入密碼；本機同版本已用瀏覽器自動化與整合測試驗過。
- 回滾：把 `values-lab.yaml` 的 `application.artifactSha`／`migratedSha` 改回 `edc53a0c…` 再同步；新增的表與欄位保留不影響舊版。
