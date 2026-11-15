# Spec：status group拖曳只更新一次

狀態: 🔵

使用者已授權continue；Astra規劃與獨立審查、Sol唯一實作於/tmp，root以具體old/new SHA審核套回，不直接改產品。這是第一切片browser驗收衍生的正確性修復，不擴其他typecheck queue。

## 問題與契約

vuedraggable v-model在updatePosition後同步emit update:modelValue，localGroups setter已emit update:groups給父頁reorderGroups；下一tick的change又透過onGroupDragChange重排已更新props，兩group順序被還原。刪除重複change listener與handler，僅以v-model setter保留一次順序更新，父層持續負責weight/unsavedChanges。不改monitor拖曳或任何API。

## 受影響檔案

- `docs/specs/2026-11-14-group-reorder-single-update.md`（新增）
- `components/status/PublicGroupList.vue`
- `tests/typecheck-slice-1.integration.test.ts`

## 驗收

/tmp Node24真已安裝vuedraggable.methods＋真component setter驗拖曳0→1僅emit一次[2,1]，現行版兩次[2,1]→[1,2]。這是VM機制驗證；真browser仍須root新build後跑既有test，兩group拖曳/save/reload保持ID與monitor關聯。禁止只延長timeout或改預期掩蓋。

root focused browser已證實group drag checkpoint失敗；頁面只有一個StatusPublicGroupList，sidebar的group-name-input同class導致全頁query抓到隱藏/其他編輯欄。本次test一律限定.public-group-list，不讀sidebar欄位，保留全部checkpoint/有限timeout/HTTP200/儲存IDs＋links檢查。
