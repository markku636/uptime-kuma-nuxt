# 雙網域交付狀態

更新：2026-11-14 16:17 Taipei。目標為 `uptime.226network.com` 與 `uptime.markkulab.net`，原計畫由既有production FRP導向本次隔離K8s API NodePort32480；不啟動舊lab frpc，不修改其他proxies。

root已嘗試既有MCP `frp_upsert_proxy`；第一個網域立即因 `mcp_agent` 缺少 `settings:write` 被拒。依root實際執行紀錄，這次拒絕沒有寫入DNS／FRP，第二個網域也尚未綁定。使用者已收到正常平台授權需求，目前等待回覆；**沒有授權不能改用其他工具、憑證或identity繞過**。此處是平台權限拒絕，不把它寫成已完成綁定。

已完成的是本機exact-origin contract：localhost與兩預定https origins可用socket ticket連線，惡意hostname suffix拒絕。它不證明公開DNS、TLS、hostname憑證或兩網域瀏覽器登入正常。服務在K8s私人入口有setupclosed與smoke證據，見 [K8s report](k8s.md)。

| 項目 | 目前狀態 |
| --- | --- |
| DNS／FRP寫入 | 權限阻擋，未完成 |
| 各hostname的TLS／憑證匹配 | 未執行，不能共用不匹配憑證充數 |
| 各HTTPS host登入／logout | 未執行 |
| scoped REST與WebSocket | 本機與K8s私人入口有證據；雙公開host未驗 |
| profile新版本 | 最終8d0593已部署K8s revision9，私人入口profile修改／還原通過；雙公開域名仍未發布 |

授權恢復後僅root沿既有MCP流程繼續：確認最新revision與setupclosed→新增本次兩proxy/DNS/TLS→逐host HTTPS/auth/REST/WS驗收→保存去秘密metadata。若17:00前仍未授權，最終回報此阻擋與已部署私人入口，不宣稱網域已可用，也不改動既有服務。
