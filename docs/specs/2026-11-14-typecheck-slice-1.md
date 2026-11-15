# Spec：typecheck 第一切片

狀態: 🔵

2026-11-14 17:22使用者明確continue，root授權本次continuation。Astra負責窄規劃／唯讀審查、Sol為唯一實作者且僅在/tmp staging修改；root審查具體old/new SHA後才以正常require_escalated套用與後續部署。目標repo現有dirty內容原樣作baseline。不啟PG、不build、不改部署。

## 契約

- 新增PUT /api/v1/tags/:id，workspace editor或write key可改該workspace tag；viewer/read key403、外workspace或不存在404、匿名401。正安全整數ID；strict JSON只容name/color，兩欄均可省略但空patch/未知key400；name trim後1–100字，color沿既有#RRGGBB（大小寫hex），省略=保留。單一scoped atomic update，P2025映404，不能先find後unscoped update。回{ok,data}安全metadata。
- 公開status頁進edit mode的group拖曳必須使用composable既有reorderGroups，保存reload後順序與monitor IDs保持；只補漏destructure，不新增平行排序實作。
- legacy /api/cluster/nodes lastCheck使用資料庫真lastSeen毫秒，缺值null，不以Date.now()冒充舊row最近活性。無legacy rows時既有current-process fallback維持；不改新worker lease runtime，也不改legacy健康probe。

## 受影響檔案

- `docs/specs/2026-11-14-typecheck-slice-1.md`（本檔，必先套用）
- `server/api/v1/tags/[id].put.ts`（新增）
- `pages/status/[slug].vue`（只補reorderGroups destructure）
- `server/api/cluster/nodes.get.ts`（lastCheck nullable／lastSeen）
- `tests/typecheck-slice-1.integration.test.ts`（新增）

## 驗收

在/tmp以真Zod＋轉譯真handler的VM fixture驗partial/validation/scoped atomic update/P2025與固定lastSeen/null，標明不是HTTP/PG權限證據。後續root套用後以隔離PG harness驗tag editor/viewer/readkey/foreign404與reload，以及Chrome兩group拖曳→save→reload IDs不丟；legacy固定lastSeen/unknown真HTTP。不得用any掩蓋新診斷，不碰badge/session/TLS或4000。原5 demos維持paused。

/tmp apply.py只允本清單，驗所有old SHA或must-not-exist與staging new SHA、拒絕路徑穿越／symlink；任何漂移在首筆寫入前整批拒絕。寫入順序Spec先，無git/network/process操作。
