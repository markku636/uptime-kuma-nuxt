# Astra 第二輪審查與 Bruno 研究

日期：2026-11-14。範圍：phase1核心完成點、phase2施工版本及phase3 parser研究。產品程式未修改；本輪新增文件與Spec補充。

## 前次問題的讀碼確認

- setup現在以transaction advisory lock後重查users，避免並行建立多admin。
- membership POST/DELETE取得workspace row lock後重查actor owner role，關閉等待鎖期間降級的旁路。
- migration runner檢查baseline columns/types及constraint names，cross-owner關聯preflight失敗時中止，不再quarantine後unlink。這不是完整schema語意等價比較：未知同名constraint定義／額外indexes等仍需operator review。
- heartbeatSummary以狀態產生安全msg，已不回舊checker原始msg。
- phase1 production/PG migration/setup測試結果引用`workspace-isolation.md`，本輪沒有重跑該DB套件；不以單純讀碼宣稱跨pod或K8s通過。

## 獨立執行結果

Astra自行執行`tsx --test tests/assertions.test.ts tests/http-request.test.ts`：9/9通過。涵蓋typed比較、non-eval selector、all/any、JSON預算、HTTP總deadline、slow headers/drip/OAuth hang/cancellation、gzip解壓上限、metadata redirect及地址policy。

另以兩個一次性loopback HTTP servers做獨立重現：source回302至不同port，原request為PUT並帶`REVIEW_SENTINEL` body；target實際收到`{method:"PUT",body:"REVIEW_SENTINEL"}`。沒有對外API或production操作。

## 本輪高優先修正

`server/services/monitor/checkers/http-request.ts` 的cross-origin邏輯允許301/302/303，但只有POST遇301/302會改GET；因此PUT/PATCH/DELETE的body仍可跨origin轉送。要求對所有保留body的方法拒絕cross-origin redirect，或依明確標準變method並確實丟body；加入兩server回歸測試。同時確認GET跨origin移除Authorization/Cookie/X-Api-Key，303 HEAD保留HEAD。已直接回報Sol。

## Secrets 契約決策

monitor detail對所有角色不讀回既有request secrets；write-only欄位採configured flags，省略preserve，顯式clear，不能回寫遮罩字串。phase2加AES-GCM requestSecrets envelope封存敏感request配置，並驗證遷移無明文副本、AAD防搬移、save/reload/name-only update不破壞實際認證。細節與檔案範圍已補`api-assertions` Spec。

editor能控制request目的地，故本輪將其視為可使用workspace secrets的受信任操作者。write-only/AES不代表可對此類editor提供強秘密隔離；若要阻止其經自有endpoint取得秘密，需owner核准目的地／secret binding的額外設計。

## Bruno 實證交付

已在獨立`/tmp/astra-bruno-parser-review`安裝官方`@usebruno/lang@0.41.0`（ignore scripts），直接呼叫request、collection、environment parsers並比對官方包內fixtures。完整API/AST/相容陷阱記錄於`docs/BRUNO_PARSER_REFERENCE.md`，已直接交Sol。

需特別拒絕script/tests/post-response vars、unsupported settings/app、未知semantic fields；同檔多HTTP blocks會merge而不是報錯，必須額外阻擋；parse錯誤可能附原始secret行，不能原樣回UI/log。官方完整fixture有不支援scripts/auth/body，應當negative case，不可靜默丟欄位後當成功。
