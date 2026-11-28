# 2026-11-28 主動網站尋檢驗收摘要

目標：參考 Supercheck／Checkly，擴充 `uptime.markkulab.net` 的主動網站尋檢能力。
迭代範圍：`docs/plans/doing/20261128-1258-site-audit-until-2000.md`（R119–R148）。

## 交付功能

| 功能 | 入口 | 支援 |
| --- | --- | --- |
| 單站健檢 | Dashboard → Website audit | HTTP／TLS／DNS／6 項 security headers／metadata／同站連結／混合內容／關鍵字；分數 0–100＋A–F；選擇性檢查可關閉 |
| 批量健檢 | Dashboard → Bulk audit → `/site-audit` | 1–20 URL、併發 3、保留順序、逐筆錯誤隔離、CSV 下載 |
| 排程健檢 | 健檢對話框 → Schedule (hourly) | `site-audit` monitor；分數進心跳、低於 minScore 發 DOWN；最近 20 份去敏感報告＋JSON 下載＋分數差異 |
| 合成瀏覽器流程 | `/browser-flows` | 11 種宣告式 action、逐步計時／斷言、每小時間隔、失敗截圖＋trace；不執行任意 JS |
| 多步驟 API 測試 | `/bruno-tests` | Bruno collection suite、跨步驟白名單變數萃取、手動執行、JSON／CSV 報告（另一條 session 交付） |
| 失敗自動事件 | Settings → General | DOWN 時在已發布狀態頁自動開事件，UP 時 resolved＋unpin |
| 憑證到期概覽 | Dashboard → Certificate expiry | 依到期日排序的 HTTPS monitor 清單 |
| 告警內文 | 既有通知渠道 | `AUDIT_*`／`FLOW_*` 事件附分數／失敗步驟，寫入 outbox 前移除 URL userinfo/query |

## 部署與驗證

- 本日共 25+ 輪，每輪只 commit 自己修改的檔案，走 v-terminal GitOps
  `uptime-api-demo-20261114/uptime-api`：loader → migration → application。
- 最終版本 artifact `53f5013a53d3e94260ae3a9995591ee38aaf3f9ce14208ef02c062cdcaf76778`
  （331,688,777 bytes；source `6b25e6a`）；release **rev467**、Healthy／Synced，
  `uptime.markkulab.net`／`uptime.226network.com` 皆 200。
- 測試：unit **231 pass / 0 fail**；typecheck **0 error**；完整整合
  **117 pass / 0 fail / 1 skip**。
- 瀏覽器實測：site-audit（example.com 80/B）、batch（兩筆）、browser-flow（Trial／Save／Test now、
  失敗截圖 89,648 bytes）、Bruno 兩步驟 suite（pass／萃取 `status`／CSV）、自動事件
  （DOWN 建立／UP 隱藏）、390px 手機版無水平溢出、console errors 0。
- OpenAPI **43 paths**，包含 `/v1/site-audit`、`/v1/site-audit/batch`、
  `/v1/monitors/{id}/audit-reports`、`/v1/monitors/certificates`、7 個 Bruno test path。

## 安全性（對抗式審查後修補）

1. browser-flow 原本只驗證起點 → 改為每次請求都驗 destination（`page.route`＋每步後重驗），
   强制 deny RFC1918／loopback／metadata；`flow-*` 截圖只給 editor+ session。
2. `timeoutMs=0` 在 Playwright 代表不逾時 → 改為最小 1ms，且 trial 加上 deadline，
   避免永久佔住全域 8 個 slot。
3. site-audit 的 DNS rebinding → `strictPrivate` 貫穿 `resolveDestination`／`rawSingleRequest`，
   audit 的每次請求與 link HEAD 都用同一輪嚴格解析。
4. checker 的原始 msg 不可直接進 outbox（可能含敏感字串）→ 只對 `AUDIT_*`／`FLOW_*`
   携带去 URL userinfo/query 的 detail。既有 outbox 整合測試抓到並驗證此修正。

## 已知限制

- browser-flow 的 Chromium 由 Playwright 自行做 DNS 解析，目的地 guard 是「每次請求重新解析」，
  無法把 IP pin 到連線；DNS rebinding 屬殘餘風險。
- 不執行 Bruno／browser-flow 的任意 JS；不做 k6 load test、多地點探測、Real Browser screenshot
  （失敗截圖僅記錄已發生的頁面，不是主動截圖監控）。
- artifact 模式需隨附 Chromium 與 bookworm 系統函式庫（已在 chart 設
  `PLAYWRIGHT_BROWSERS_PATH`／`LD_LIBRARY_PATH`）；PVC prune CronJob 保留 2 個 release。
