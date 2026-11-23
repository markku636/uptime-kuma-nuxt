# 2026-11-15 Tenon 雙域 HTTPS 與登入驗收

雙域 HTTPS、帳密登入、session 持續性與 dashboard Live 功能驗收通過。兩域仍有未定位的 hydration mismatch；Tenon wizard 的 `rollback_failed` 狀態另行保留，不與入口功能結果混為一談。

## 部署與公開入口

API release revision 12 為 GitOps Healthy／Synced，API 2/2、worker 2/2。本次透過 V-TERMINAL admin MCP 建立 Tenon 公開入口，沒有產品 rollout，Secure cookie 設定維持。

| 公開入口 | Tenon route | Agent | 來源 | 公開 DNS |
| --- | --- | --- | --- | --- |
| https://uptime.226network.com | 71 | 2 | 127.0.0.1:32480 | A 161.33.213.93 |
| https://uptime.markkulab.net | 72 | 2 | 127.0.0.1:32480 | A 161.33.213.93 |

兩域均各連續三次通過可信 TLS 的 `/login` HTTP 200 檢查，回應包含 SealWatch 內容。公開 DNS／TLS／登入頁可達性、登入後 session 與瀏覽器 Socket.IO 分別驗證如下。

## 登入與 session 驗證

兩域各使用 Python 標準 `http.cookiejar` 完成登入 HTTP 200，確認 Set-Cookie 屬性為 `Path=/; HttpOnly; Secure; SameSite=Lax`。同一 cookie jar 後續請求 `/api/_auth/session` 均為 HTTP 200，且回傳包含 user。驗證沒有輸出 Cookie 值。

先前直接以 HTTP NodePort 瀏覽器登入出現循環，根因為 Secure cookie 不會隨 HTTP 請求送回。公開 HTTPS 上兩域登入與重載均已通過；沒有以降低 cookie 安全設定處理問題。NodePort HTTP 不作為本次已驗證的瀏覽器登入入口。

## CUA 瀏覽器驗證

| 項目 | uptime.226network.com | uptime.markkulab.net |
| --- | --- | --- |
| 一般帳密登入並進入 dashboard | 通過 | 通過 |
| Socket 顯示 Live | 通過 | 通過；reload hydration 後恢復 Live |
| 顯示原 5 筆 paused demos | 通過 | 通過；Monitors 5／Paused 5 |
| reload 後仍為已登入 dashboard | 通過 | 通過 |
| Hydration 訊息 | 出現 mismatch，未定位 | 同樣出現 mismatch，未定位 |

兩域均完成真 CUA 登入與重載。沒有建立或啟用額外 monitors，原 5 筆 demo 保持 paused。第二域空結果搜尋已清除，恢復完整 5 筆列表；使用者 tab 保留已登入 dashboard。

Hydration 訊息為 `Hydration completed but contains mismatches.`，記錄時間如下：

| 網域 | UTC | 台北時間 |
| --- | --- | --- |
| uptime.226network.com | 2026-11-14T16:22:09.914Z | 2026-11-15 00:22:09.914 |
| uptime.markkulab.net | 2026-11-14T16:24:16.864Z | 2026-11-15 00:24:16.864 |

功能通過不代表 hydration 已修復，不能宣稱 console 無 error。

## Tenon wizard 狀態

1. job `0ac6f36b-5b13-4861-b2bc-3e11956b5115` 的初始 LAN target 不在 `allow_targets`。僅清除本任務 route 71，再以 loopback `127.0.0.1:32480` 重建。
2. job `a1e4e085-4185-4b9c-8316-718542d58e6c` 在直連 TLS 通過後，因 Tenon 自動新增 A 記錄、wizard 的 DNS 檢查只接受 CNAME，最終記錄為 `rollback_failed`。該 job 缺少 `dnsAfter`，沒有據此盲目回滾或刪除 DNS。
3. 第二域透過正常 `tenon_create_route` 建立 route 72。preview `79b55da6-7085-4fed-b6db-476c512ea19e` 未 apply，不構成已執行的 DNS 或 route 變更。
4. Tenon 自動 A 記錄經審查屬正常結果，保留現有 A 記錄。公開 DNS、可信 TLS 與雙域 CUA 結果證明服務入口實際可用；wizard 的 `rollback_failed` 仍是未解的控制流程狀態，不能改寫為 wizard 成功，也不能單憑該狀態判定目前入口不可用。

## 截圖證據

- [第一域 dashboard](evidence/20261115-tenon/uptime-226-dashboard.jpg)
- [第二域 dashboard：完整 5 筆列表／Live](evidence/20261115-tenon/uptime-markkulab-dashboard.jpg)
- [第二域空結果搜尋](evidence/20261115-tenon/uptime-empty-search.jpg)

## 未解問題與限制

- **P2：hydration mismatch。** 兩域皆有上述訊息，尚未定位根因或修復。第二域 reload 後仍保留登入並恢復 Live，與 hydration 問題是否結案是兩個判斷。
- **P3：搜尋空結果文案。** 第二域搜尋 `no-match-tenon-verification` 時顯示 `0 on this page · 5 in environment`，卻提示 `No monitors yet. Click Add...`，容易誤解為尚未建立監測。搜尋已清除、原 5 筆恢復；本次沒有修正文案。
- wizard `rollback_failed`、缺 `dnsAfter` 的狀態缺口仍保留；沒有以盲目 DNS 回滾處理。
- 本次未新增 session 第三切片部署、4000 負載、跨實體 node failover 或 built-image runtime 驗收。Secure cookie 維持，沒有產品 rollout。
- 本輪公開入口已透過 V-TERMINAL admin MCP 完成，取代先前「缺 settings:write、網域未發布」作為目前狀態；舊紀錄保留為當時的阻擋與時間線，不改寫歷史。
