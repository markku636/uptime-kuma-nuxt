# Spec：最終部署 REST 驗收

狀態：🔵。root16:34授權；Sol唯一實作者。使用已部署8d0593，不改產品、不重build、不寫cluster DB。

`script/verify-deployed-rest.mjs`（實際路徑 `scripts/verify-deployed-rest.mjs`）僅以0600本機credentials登入REST。現無workspace DELETE，依root明確同意在既有workspace1新增兩個精確owned暫時environment，原default五筆paused demos前後id/name/active/scope快照必須相同。不建立無法完整清理的workspace。

驗收monitor CRUD、read/write env-bound keys、foreign env404、宣告式Bruno preview/import/export/test與typed assertions、manual active/pause/resume guard及真worker維護狀態。所有probe僅指向已部署task-owned uptime-fixture Service。只輸出聚合結果/非秘密IDs，不能輸出password/cookie/APIkey或原始response。每次建立即持久記錄owned IDs，finally按精確IDs清maintenance、monitors、keys、兩env；不靠名稱前綴刪除、不動其他資料。失敗也需完整cleanup並清楚保留結果，不能吞錯宣稱成功。

受影響：本Spec、`scripts/verify-deployed-rest.mjs`、`docs/validation/RELEASE_VALIDATION.md`（Astra更新）、去秘密結果 `.data/validation-logs/final-live-rest.json` 與ownership JSON。原始credentials及ownership不入交付archive。完成後全source bundle納所有tracked/untracked實作與docs/scripts但排除.env真值/.data/.git/node_modules/.output/generated，記commit/dirty/tree digest，逐member/path/link及實際credential值安全掃描，不commit/push。
