# Spec：網頁跑版監控（visual-diff monitor type）

狀態：🔵 待實作。日期：2026-11-27。規劃／實作：OpenCode。依 [主計劃](../plans/doing/20261125-2356-visual-diff-monitor-type.md) 與 [迭代紀錄](../plans/doing/20261127-0022-visual-diff-iteration.md)。

## 行為契約

新增 monitor type `visual-diff`：以真瀏覽器（Chromium）載入 monitor 的 `url`，先跑版面規則、再跑截圖像素比對，將結果寫入既有 heartbeat／通知鏈。目標頁仅限公開頁或既有 basic auth／headers 可存取的頁面；cookie/session 登入不在本期。

設定存放在 `Monitor.visualConfig`（JSONB）：至少 1、最多 4 個 viewport（`label` 唯一，width 320..3840、height 400..4320）；可選 `waitForSelector`／`waitTimeoutMs`／`settleMs`／`fullPage`；`requiredSelectors`（selector、minCount、可選 minWidth/minHeight）；`maxHorizontalOverflowPx`；`detectBrokenImages`；`ignoreSelectors`；`diffThreshold`（0..1）；`maxDiffPixels`；`baselineStrategy`（manual/auto）。未知欄位一律拒絕（`strict`），避免拼錯設定被靜默忽略。

基準（baseline）每個 monitor × viewport 一筆，存 PNG bytes + sha256 + 建立時的 `configVersion`。設定變更會讓 `configVersion` 递增，舊基準視為 stale，必須重新接受，避免拿新 selector 比舊圖。首次檢查沒有基準時建立基準並回 UP（訊息標明「待確認」），不直接判定跑版。手動接受基準需 workspace 成員，並寫 audit log。

檢查結果：規則失敗回 DOWN、`code='LAYOUT_RULE'`，訊息列失敗項；像素差異超閾值回 DOWN、`code='VISUAL_DIFF'`，訊息含 viewport、diff% 與規則摘要，並寫入 `VisualCheckArtifact` 供詳情頁比對。DOWN 沿用既有通知機制，不另建通道。checker 必須尊重 `AbortSignal`（worker 的 lease/deadline 會 abort）。

## 受影響檔案

- `prisma/schema.prisma`；新增 `prisma/migrations/20261127003000_visual_diff/migration.sql`。
- 新增 `shared/types/visual-config.ts`、`server/utils/visual-config.ts`、`tests/visual-config.test.ts`。
- `server/utils/monitor-input.ts`、`server/utils/monitor-secrets.ts`（DTO 白名單與 `scheduleSupported`）。
- `server/api/v1/monitors/index.post.ts`、`server/api/v1/monitors/[id].put.ts`（URL 必要驗證）。
- `types/monitor.ts`（`MonitorType.VISUAL_DIFF` 與 `Monitor.visualConfig`）。
- 後續階段：`server/services/monitor/checkers/visual-*.ts`、`checkers/index.ts`、`checker.ts`、`types.ts`、`components/monitor/MonitorForm.vue`、`components/monitor/MonitorListFilter.vue`、`pages/monitors/[id]/index.vue`、`server/jobs/clear-old-data.ts`。

## 驗收

- [ ] `visualConfigSchema` 接受合法設定並補上預設值；拒絕重複 viewport label、超界 width、過多 viewport、未知欄位。
- [ ] `normalizeVisualConfig(null/undefined)` 回預設值且為深拷貝。
- [ ] POST/PUT `visual-diff` 沒有 `url` 時 400；其他 type 不受影響。
- [ ] `monitorEditorDTO` 回傳 `visualConfig`，且 `scheduleSupported` 含 `visual-diff`。
- [ ] `prisma validate` 通過；migration 可套用且已有 monitor 資料不需回填。
- [ ] 提交只包含本 Spec 列出的檔案，不影響共用工作樹上別人的變更。
