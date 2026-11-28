# Security scan（網站弱點／滲透檢查）

SealWatch 的 bounded 網站弱點檢查。設計參考 [`markku636/ai-security-monitor`](https://github.com/markku636/ai-security-monitor) 的
website scan（兩層 profile、擁有權驗證、統一 finding 格式），並重用本專案 site-audit 的 SSRF-strict HTTP 執行器。

> **授權**：只掃你擁有、或已取得書面授權的網站。對別人的系統做主動探測可能違法。
> 被動模式也會對目標送出 HTTP 請求；active_light 會另外要求你先證明擁有權。

## 兩種掃描層級

| Profile | 需要做什麼 | 會檢查什麼 |
| --- | --- | --- |
| `passive`（預設） | 登入並有 editor 權限 | 與一般瀏覽器相近的少數請求：HTTP／重新導向、TLS 憑證狀態、security headers、cookie 屬性、DNS SPF／DMARC、技術指纹與舊版特徵 |
| `active_light` | 先取得驗證碼並放到 DNS TXT 或 `/.well-known/sealscan-verify.txt` | 上述全部，再加上 6 條固定路徑的 **HEAD** 探測（`/.env`、`.git/config`、`.DS_Store`、`/server-status`、`/actuator/env`、`/phpinfo.php`） |

不做注入、模糊測試、暴力破解或 DoS；不執行遠端程式碼；不把目標資料送給第三方。

## 證明擁有權

1. 在 `/security-scan` 選擇 **Active light**，按 **Get verification code**。
2. 選一種方式放置驗證碼（有效 90 天，重新取得會輪替舊碼）：
   - **DNS TXT**：`_sealscan-verify.<host>` 的值設為 `sealscan-verify=<token>`。
   - **驗證檔**：`https://<host>/.well-known/sealscan-verify.txt` 的內容為 `<token>`（可含結尾換行）。
3. 選對應方式、貼上 token，再執行掃描。

驗證碼存在既有 `Setting` 表（`securityScan.verifyTokens`），不需要資料庫 migration；只比對完全相等的 token，且綁定 workspace 與 host。
伺服器端如果驗證失敗，引擎會自動把 `active_light` 降級成 `passive`，並在報告的 `warnings` 註記 `OWNERSHIP_UNVERIFIED`。

## 檢查項目

| 類別 | 規則範例 | 嚴重度 |
| --- | --- | --- |
| `headers` | 缺少 CSP／X-Frame-Options／X-Content-Type-Options／Referrer-Policy／Permissions-Policy、HSTS max-age 過短、CSP `unsafe-inline` | info–medium |
| `cookies` | 工作階段 cookie 缺少 Secure／HttpOnly／SameSite | medium–high |
| `tls` | 憑證過期／即將過期、SAN 不含該 host | high–critical |
| `dns` | 缺少 SPF／DMARC | low–medium |
| `fingerprint` | `Server`／`X-Powered-By` 等版本揭露、舊版 jQuery（CVE-2020-11022／11023） | info–high |
| `redirect` | HTTPS 降級至 HTTP、過長的重新導向鏈 | info–high |
| `exposure` | 固定路徑回 200 且非 HTML（active_light 限定） | high |

每筆 finding 的格式仿 OCSF：`rule`、`key`（去重用）、`severity`、`title`、`detail`、`recommendation`、
`location`、`evidence`、`cwe`、`refs`、`tags`。分數從 100 扣分（info 0／low 2／medium 6／high 14／critical 30），
grade A–F，並回傳最高嚴重度 `riskLevel`。

## 安全護欄

- 所有 HTTP 請求都經過 `strictPrivate` guard；DNS 解析與實際連線都擋 loopback／RFC1918／link-local／雲端 metadata，
  也擋 DNS rebinding（兩次解析都檢查）。
- 內建版本目錄只收錄能從公開文件查到、且可從被動指紋可靠判定的舊版本；其餘只陳述「看到什麼」，不憑空給 CVE。
- 主動探測只用固定 allowlist 的 6 條路徑、HEAD、次數可調（0–6），不看回應內容、不跟大量重新導向。
- 單次報告最多 100 筆 finding；API 限制每使用者 5 次/分、全域 2 個並行。
- on-demand 掃描不會寫入歷史；點報告上的 **Schedule hourly** 會建立 `security-scan` monitor（每小時）。
  排程一律用被動檢查（背景沒有即得擁有權驗證），分數進心跳、低於 `minScore`（預設 60）發 DOWN 通知；
  最近 20 份去敏感報告可由 `GET /api/v1/monitors/{id}/security-reports` 取得，監控詳情頁也有面板與 JSON 下載。

## API

```sh
# 取得驗證碼（editor）
curl -b cookies.txt 'https://uptime.markkulab.net/api/v1/security-scan/verify-token?url=https%3A%2F%2Fexample.com'

# 被動掃描
curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com"}' \
  https://uptime.markkulab.net/api/v1/security-scan

# 主動輕量掃描（需先放好驗證碼）
curl -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"url":"https://example.com","profile":"active_light","verify":{"method":"dns-txt","token":"sealscan-…"},"maxProbes":3}' \
  https://uptime.markkulab.net/api/v1/security-scan
```

完整欄位見 `/api/swagger-json` 的 `SecurityScanRequest`、`/v1/security-scan` 與 `/v1/security-scan/verify-token`。

## 限制

這是一套**輕量、可自動化、可重複**的檢查，不是完整滲透測試：沒有 nuclei／testssl.sh 的大型模板庫、沒有port scan、
沒有登入後或需要身分的檢查，也不保證涵蓋所有 CVE。需要正式弱掃報告時，仍應使用專業工具與人工驗證。
