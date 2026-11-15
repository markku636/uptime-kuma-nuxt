# 2026-11-14 18:13 continuation 部署驗收

- 測試站：http://192.168.50.57:32480；Helm revision 12，Healthy／Synced，2 API＋2 worker Ready，仍為單一實體 node。
- Runtime artifact：`edc53a0c1d3ec837b9c7970024709a461c1b7d1f1849dcaf23dc8f7282fd76f6`，201883328 bytes，68600 members；SHA／路徑／link／任務憑證排除檢查通過。
- GitOps：loader `0941e76f680f9353358c6256811b98d618f39be1`；migration `c07dbee75de1a69a888932a52a4dc365a4b96a88`；application `0dba7908289a78e0f4753e3b382bbf9677d18d21`。均經 v-terminal MCP，僅提交本 chart。
- Loader Job 成功，短命內網傳輸已關閉；migration Job 成功，Node24.22.0／Prisma6.19.1 native runtime probe通過，13 migrations無待套用。沒有 schema 變更。
- 內容：tag partial PUT／權限、真實 legacy lastSeen、六種 badge 參數與XML安全／有界聚合／TLS cache fencing，以及狀態頁群組拖曳重複更新修正。
- 驗證：unit 40/40；首次 full integration 80 pass／1 skipped／1 browser cancelled（保留失敗紀錄）。補修產品的double reorder及測試滑鼠手勢後，focused 3/3 pass，含真原生dragstart/drop/dragend、Save HTTP200、DB IDs／monitor links與reload。
- 線上 REST：tag partial/read403/write200、六badge/public-private/400d邊界/XML轉義、group REST保存全部通過。臨時1環境、1tag、2key、2paused monitors、1status page皆精確刪除；原5筆demo IDs1–5保持paused且快照不變。證據 `.data/validation-logs/continuation-1794651210334-022135.json`。
- 未經 MCP 瀏覽器驗證；本輪UI證據為隔離測試的Playwright。完整typecheck仍未宣告通過；session切片僅/tmp staging，未套用、未部署。
- 使用者改指定 Tenon 綁定 `uptime.226network.com` 與 `uptime.markkulab.net`。lab agent2在線，但tenon_binding_preview被平台拒絕：mcp_agent缺settings:write。沒有DNS／Tenon路由寫入；既有uptime-kuma.226network.com屬另一服務，未變更。
