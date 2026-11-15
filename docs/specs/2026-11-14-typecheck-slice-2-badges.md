# Spec：badge與TLS cache窄修復

狀態: 🔵

2026-11-14使用者continue；Astra規劃／唯讀審查，Sol唯一實作且僅/tmp staging；root正常require_escalated審查套回，兩切片累積後才build。無schema/migration/服務啟動，5demos不改，4000取消。

## 行為

六個badge routes共用query/ID/duration輸入白名單：query必scalar、label最多128 Unicode codepoints、style僅flat/flat-square/plastic/for-the-badge、colors只#RGB/#RRGGBB（大小寫hex）；未知key/重複值/非法style/color/duration400。duration整數1..9600h，支援無單位小時及h/d與1y=8760h。先維持published monitor404邊界；不得解密URL或新增網路I/O。generator再防禦內部caller，所有title/text escapeXML、去除XML非法控制字元、限制字數，color/style不可注入CSS/url或attribute。

avg-response使用既有rollup-aware calculateUptime.avgPing，無樣本N/A、真0ms保持。cert-exp僅讀TLS cache日期，不讀sealedURL、不tls.connect；驗version/validTo/checkedAt、future>5s拒、freshness min(24h,max(5min,2*interval+timeout))（interval/timeout秒，轉毫秒）。有效解析的過期證書顯Expired；valid:false不代表日期無效，不宣稱trust。fenced completion以DB now投影cache（ISO日期/checkedAt/configVersion及既有私有UI必要bounded cert metadata），不改TLS通知ledger。所有config fence清cache、clone不複製，缺失或不符回N/A。

UI移除不存在response/social選項；ping不拼duration，avg/uptime保留duration；用當前origin且SSR不讀window。複製HTML的src/alt escape，Markdown label逃逸。

## 受影響檔案

- `docs/specs/2026-11-14-typecheck-slice-2-badges.md`
- `docs/API_PLATFORM_PLAN.md`
- `server/services/badge/generator.ts`
- `server/services/monitor/completion.ts`
- `server/utils/monitor-mutation.ts`
- `components/monitor/BadgeGeneratorModal.vue`
- `server/api/badge/[id]/avg-response/[duration].get.ts`
- `server/api/badge/[id]/cert-exp.get.ts`
- `server/api/badge/[id]/ping.get.ts`
- `server/api/badge/[id]/status.get.ts`
- `server/api/badge/[id]/uptime/[duration].get.ts`
- `server/api/badge/[id]/uptime.get.ts`
- `server/utils/badge-input.ts`
- `server/utils/tls-cache.ts`
- `tests/badges.test.ts`
- `tests/badges.integration.test.ts`

## 驗收

/tmp Node24純函數：四style XML解析／惡意label/message/color/style、控制字元、長度、duration邊界、TLS cache invalid/mismatch/stale/future/expired/0；handler VM fixture驗N/A/0、SQL aggregate委派與public guard，不假稱HTTP證據。root套用build後隔離PG真HTTP：published badges200SVG/private404、非法query400、raw+rollup均值、TLS cache且零新增probe、所有fence/clone cache失效。僅記本次實測，不宣稱部署已更新。
