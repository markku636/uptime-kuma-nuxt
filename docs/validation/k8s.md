# Kubernetes 部署驗證

更新：2026-11-14 16:35 Taipei，Astra讀取root保存的GitOps／runtime／smoke證據。本文件記錄已發生的結果，與待實作Spec分開。執行部署者root；唯一產品實作者Sol。

## 目前部署結論

最終runtime為 `8d0593a9492538112988024e4b2c1ea9fdbcaf5a3e36164267a58df00075d4b4`，201885245bytes，revision9／GitOps commit `e43d6a2f3a9ba9e215435d4692370534d5678117`，Healthy／Synced。StageB/C/D與16:32新版雙API smoke已完成；下方a4134b與候選98eb511c為過程紀錄，不能當目前版本。

## 第一版部署與環境（歷史）

namespace `uptime-api-demo-20261114`、release `uptime-api`，lab RKE2單一Ready node。runtime bundle SHA256 `a4134b550a5ed1339af8b0c110c4a1677e90b39a2ec042cc918bbd9a07f0f353`，201895601 bytes；source基底977624b加dirty tree，workingTreeSha256 `95df364c18ae61940a6165d4ae100e71454c5556359570a24d9a3b8e4772c3e0`。這不是純977624b內容，亦不包含其後profile/manual/OpenAPI修正。完整manifest記錄在`deployment-frozen-package.log`。

官方Node24 base＋immutable SHA PVC是 **artifact runtime**。canonical Dockerfile 的 d6 context Kaniko no-push build 正在執行，尚無完成成功證據；built-image runtime 未執行；image模式／multi-node topology只完成靜態render，不能冒稱該image已在多node運行。

## 分階段執行結果

| 關卡 | 結果與證據 |
| --- | --- |
| A | commit2865d998，PG Ready、10Gi RWO/local-path PVC Bound。StatefulSet Retain不代表刪PVC仍保留，PV reclaim為Delete；不能清除此demo PVC |
| B | 首次loader因bytes科學記號失敗；修成int64字串與attempt後retry2成功SHA／bytes驗證、atomic install。GitOps commits0c17eb4／16b40bb，短命artifact HTTP server已停止。保留首次失敗，不稱一次成功 |
| C | commit9d124c0、migration Job `uptime-migrate-a4134b550a5e-1` Succeeded；Node24.22.0/linux/x64、Prisma6.19.1真native SELECT1成功、13 migrations完成。`deploy-stage-c-verification.json` |
| D | commit072cabe、兩API＋兩worker＋fixture＋PG曾全部Ready；login200/runtime200、4個runtime instances running、再次setup400。`deploy-stage-d-runtime.json` |
| Rolling update | GitOps revision6／commit8ab36ff，仍為a4134b、調整bounded heaps；16:20–16:22觀察約150秒，150次health均200，WS共2次連線，revision2→3→3→4→5。新2API＋2worker running，原4個instance draining，最後monitor paused=true。`cluster-rolling-update-smoke.json` |
| 重啟後smoke | 16:16 `cluster-five-demo-smoke-after-reboot.json` passed=true：兩個API Pod分別收到ID1–5 revision1；各monitor一筆history，1–4為CHECK_OK，第5為預期ASSERTIONS_FAILED；cleanup逐筆paused=true |

14:00資源壓力時`cluster-five-demo-smoke.json`第一個login前fetch失敗，未resume監測，屬失敗紀錄；不得刪除或當成功。16:15第二次主機重啟後root恢復服務，16:16的新成功結果獨立列出。先前本機full regression75pass/1skip與cluster5/5仍保留在`.data/validation-logs`，重啟不使它們自動成為新release證據。

5個demo IDs1–5保留，最後這次smoke的pause全部成功；status page1由root原bootstrap建立。demo部署沒有4000 monitors，不需為取消容量測試重新seed或虛構「刪除4000」。歷史隔離fixture DB清除另有原suite/benchmark紀錄。

## 限制與下一關

- 所有Pod位於同一node；artifact local-path RWO與單副本PG都依賴該node，FRP若指單一NodePort也不構成入口HA。canonical image模式無artifact PVC、兩角色strict hostname spread可交付；實際跨node placement／node失效未跑。
- 本機process crash／lease reclaim／stale fencing／LISTEN revocation已由cluster regression驗證；本次K8s smoke證明真worker與兩API fanout，另有真controlled rolling update／WS reconnect證據；重複revision3是resync，不當作新增heartbeat。沒有K8s forced worker loss或node loss證據，不能補稱已驗。
- 新候選runtime SHA `98eb511c95af81a5a3ecea70b71158adf1f0ea8ad5a7e133f88607fce9a9aa85`、201899993 bytes、workingTreeSha256 `5e8150c28bfb147e26c8389bdc071f7f11112b1e17f44baed93aaffe9158e4a6`，見 `final-interactive-artifact.log`。本機interactive build成功、profile／maintenance／OpenAPI targeted 5/5通過（含mobile保存後reload）；typecheck仍66 diagnostics、exit2。新候選尚待loader／migration／runtime部署gate，不能把本機測試當作K8s已更新。
- 兩公開域名尚因MCP `settings:write` 權限拒絕而未綁定，見 [domain report](domain-delivery.md)。不要換工具或其他identity繞過。
- 本次不測4000容量，不承諾任意硬體SLA或外部HTTP exactly-once。HTTP/keyword/JSON query與push支援；legacy協定限制見 [runtime](../CLUSTER_RUNTIME.md)。

證據來源：`.data/validation-logs/deploy-stage-a-verification.json`、`deploy-stage-c-verification.json`、`deploy-stage-d-runtime.json`、`cluster-api-endpoints.json`、`cluster-five-demo-smoke-after-reboot.json`、`cluster-rolling-update-smoke.json`與[phase6 root紀錄](../specs/2026-11-14-k8s-scale-validation.md)。本報告不含secret／session／credentials。

## Kaniko完成追記（16:24:05）

Astra已直接讀 `kaniko-d6-build-result.json`：canonical Dockerfile no-push build Succeeded，image digest `sha256:bc37be21e220d9d88d6193525ab8fdaca4787fab5b2b63452335b82d2f6bd764`，tar353607680bytes。這只證明d6 source context的實際image建置，不是registry發布或built-image runtime，也不包含其後最終UI修復。較早「執行中」是當時狀態，現以本追記為準。98eb511c候選未部署，Sol因最後UI select修復再產新artifact，最後部署identity待新manifest。多node模板獨立render及每revision spread finding見 [review16](astra-review-16.md)。

## 16:29 新版Stage B

最終產品已改為 `8d0593a9492538112988024e4b2c1ea9fdbcaf5a3e36164267a58df00075d4b4`、201885245bytes，workingTree `5e164cc4fe8949b1e41ca77c04083f971e8715544ceb53b370e795019cf09b90`。`final-stage-b.json`顯示 `uptime-artifact-8d0593a94925-1`於16:28:28 Succeeded，log為Verified immutable artifact installed。此刻只代表新artifact已載入；migration／API與worker改用新版尚待root驗收。98eb511c是未部署的上一候選，a4134b仍為先前runtime證據的版本。

## 16:32 新版Stage C與模板修復

`final-stage-c.json`：`uptime-migrate-8d0593a94925-1`於16:29:16 Succeeded，Node24.22／Prisma6.19.1 native runtimeCheck passed，13 migrations全部已套用、無pending。新版D rollout待root驗證。canonical strict模板已按pod-template-hash分revision分散，Astra三組render通過，詳 [review16](astra-review-16.md)；仍不宣稱跨node實測。

## 16:35 新版Stage D完成

`final-stage-d-status.json`顯示revision9 Healthy／Synced，API與worker皆2/2 Ready；`final-stage-d-pods.json`記不同API Pod IP10.42.0.146／10.42.0.149，全仍在testing-machine單node。`final-cluster-smoke.json`於16:32:22–16:32:28 passed=true，確認profile修改還原、2API＋2worker running、兩個API各收到5筆新revision。新history IDs20–24，1–4為CHECK_OK，5為預期ASSERTIONS_FAILED；countBefore5、cleanup逐筆paused=true。短命artifactserver32539已由root確認停止。

首次`final-cluster-smoke-initial-snapshot-race.json`為測試把訂閱初始snapshot當新heartbeat，history ID仍舊而失敗；保留原紀錄。第二次明確等待新history ID／code及revision>baseline，無runtime source修復。這份成功是最新版artifact真cluster驗收；沒有將初始快照、預期DOWN或舊rolling結果包裝成全部UP。追加live REST完整生命週期尚待結果，雙網域仍blocked。

## 部署站live REST補驗（16:37）

Astra直接讀 `final-live-rest.json`：16:36:55–16:37:01 passed=true，對已部署8d0593私人NodePort入口驗monitor CRUD／typed assertion trial、read/write environment-bound key與foreign environment拒絕、Bruno declarative preview／paused import／export／trial／拒絕scripts、manual maintenance inactive→resume→真worker status3/MAINTENANCE→pause（保留舊dates亦正確）。

在既有workspace1中只建立2個臨時environments（2,3）、2個monitors（6,7）、2個keys（1,2）、1個maintenance（1），依精確ID cleanup；monitor7在cleanup時已absent，其餘刪除成功。originalDemosUnchanged=true，原5筆paused demo before/after一致；environment集合恢復。**未建立／刪除workspace，不宣稱workspace delete已驗**，也不將此與完整RBAC矩陣混為同一次測試。

第一次 `final-live-rest-attempt1.json` 仍保留：16:36:02的environment POST回503，cleanup驗證GET monitors亦503，owned IDs清單皆空。未保存response body，無法歸因；第二輪成功不證明503原因已修復。root將另做低頻唯讀健康／已登入GET觀察，尚未有最終結果前不宣稱完全無間歇錯誤。
