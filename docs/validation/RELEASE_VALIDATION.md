# 交付驗證摘要

狀態時間：2026-11-14 16:39 Taipei。產品實作 Sol；部署與 MCP 驗收 root；本摘要由 Astra 直接核對保存的 logs／JSON。新版K8s artifact部署及smoke已完成；雙網域仍受平台權限阻擋，這不是公開入口或真跨node完成聲明。

## 版本與測試

最終產品候選 runtime SHA256 `8d0593a9492538112988024e4b2c1ea9fdbcaf5a3e36164267a58df00075d4b4`，201885245 bytes。source base `977624b92597f366b74181ef38ba027c1282ff84` 加未提交內容，workingTreeSha256 `5e164cc4fe8949b1e41ca77c04083f971e8715544ceb53b370e795019cf09b90`；不能只用 commit 代表 artifact。

| 驗證 | 結果／版本限制 |
| --- | --- |
| Production build | `final-settings-build.log` Build complete |
| Unit | `final-settings-unit.log` 37/37 PASS；包含最後UI修復後重跑 |
| 最新 targeted | `final-settings-integration.log` 5/5 PASS，含 REST monitor／maintenance key scopes、真worker窗口、profile安全欄位與mobile保存後reload、OpenAPI／metrics；owned DB dropped |
| 最新 typecheck | `final-settings-typecheck.log` 66 diagnostics、exit2，**未通過**；不將66條全稱既有 |
| 最終 full regression | `final-full-integration.log` 78 cases：77 pass／0 fail／1 skip，96.129秒，owned DB dropped；唯一skip是取消的4000 bulk |
| 前輪 cluster regression | `deployment-cluster-fixed.log` 5/5 PASS，含兩API、LISTEN重連／撤權、remote mutation/drain、blackhole；不是跨node測試 |
| 本機清理 | `final-cleanup-audit.json` 5 paused demos、0 heartbeat/outbox orphan、無owned test DB；與cluster demos分別盤點 |

最新 targeted 的 profile browser 包含 SSR disabled→mounted可輸入、保存後DB持久化與reload，沒有將CLI browser稱MCP。先前 MCP dashboard／mobile／Bruno preview截圖另列於證據索引。

## Kubernetes 與公開入口

最終8d0593已部署為release revision9，GitOps commit `e43d6a2f3a9ba9e215435d4692370534d5678117`；`final-stage-d-status.json`為Healthy／Synced，兩API與兩worker各2/2 Ready。Stage B immutable loader、Stage C native SELECT1與13 migrations無pending均成功，短命artifactserver已停止，Pod重啟不依賴下載server。

`final-cluster-smoke.json`於16:32:22–16:32:28通過：profile讀取／修改／還原、2API＋2worker running、直接連兩個不同API Pod各收到5筆比baseline更新的revision；新heartbeat IDs20–24，1–4為CHECK_OK，5為預期ASSERTIONS_FAILED；cleanup5筆全paused。首次測試誤把subscription初始snapshot當新heartbeat，`final-cluster-smoke-initial-snapshot-race.json`保留失敗；修正測試等待新history ID／code／revision後成功，沒有產品runtime修復，也不抹除失敗。

先前a4134b的150秒rolling update證據仍保留：150次health全200、WS重連、4新instances running／4舊draining；它與新版smoke分開記錄。詳 [K8s報告](k8s.md)。

canonical image模式有跨hostname的strict topology、無application artifact PVC，搭配外部PG可部署多node；實際lab只有一node，沒有實際跨node或node loss證據。demo local-path RWO／PG／單NodePort入口各有單node依賴。d6 context的Kaniko no-push image build已Succeeded，digest與限制見下節；不是最新候選的built-image runtime。

`uptime.226network.com` 與 `uptime.markkulab.net` 因MCP角色缺 `settings:write` 被拒，尚未發布／驗證；等待正常平台授權，不以其他identity或工具繞過。詳 [網域狀態](domain-delivery.md)。

## 已實作範圍與明確限制

Workspace／environment與RBAC、typed non-eval assertions、Bruno `.bru`宣告式子集／paused匯入、REST monitor與maintenance生命週期、cursor讀取與retention、PG leases／fencing／outbox／fanout及小螢幕UI已有各輪證據。Bruno scripts與不支援的語法會明確拒絕；HTTP/keyword/JSON query與push為目前執行支援範圍，其他legacy協定、proxy/NTLM/mTLS與SMTP不宣稱可用。

使用者已取消4000 active/API容量目標，不補跑；保留5筆demo，不把歷史SQL量測當實際容量承諾。外部HTTP／通知是可能重送的契約，不宣稱exactly-once。尚未完整清除TypeScript diagnostics，既有migration的資料回復需備份／相容前滾，不能用換image撤銷已刪raw資料。

完整分輪來源、原始log遺失範圍及限制見 [EVIDENCE_INDEX](EVIDENCE_INDEX.md)。早期 `/tmp` logs於11:56重啟遺失；目前引用的 `.data/validation-logs` 在第二次重啟後已直接讀取，沒有補造缺失log。

## Kaniko完成追記（16:24:05）

Astra已直接讀 `kaniko-d6-build-result.json`：canonical Dockerfile no-push build Succeeded，image digest `sha256:bc37be21e220d9d88d6193525ab8fdaca4787fab5b2b63452335b82d2f6bd764`，tar353607680bytes。這只證明d6 source context的實際image建置，不是registry發布或built-image runtime，也不包含其後最終UI修復。較早「執行中」是當時狀態，現以本追記為準。98eb511c候選未部署，最後產品identity為本摘要列出的8d0593。多node模板獨立render及每revision spread finding見 [review16](astra-review-16.md)。

## 最新artifact完整性

`final-artifact-verification.json`比對8d0593 SHA與manifest成功；68598 archive members的paths/links檢查通過、4個已知credential values未出現在archive，errors空。這是限定已知值的檢查，不宣稱能證明所有可能秘密不存在。`final-settings-artifact.log`保留dirty diff與lock identity。最後full integration已直接讀取77 pass／0 fail／1 skip，owned DB dropped。

## Multi-node修後靜態驗證

review16的rolling revision分散finding已修：strict模板按pod-template-hash分組。Astra獨立render Kustomize strict／Helm image strict／Helm artifact非strict，三者各兩角色assertions通過；結果 [astra-multinode-render.json](astra-multinode-render.json)。image模式無application PVC或內建PG，PDB1與grace45s保留；現場仍只有一node，這不構成真跨node測試。

## 追加live REST驗證

部署站追加環境／API key／Bruno／manual maintenance生命週期已通過並精確cleanup；沒有再改source或重build。詳下方16:37紀錄，首次503原因仍未知。

## 取得程式與部署檔

目標GitHub repo **尚未推送本次產品變更**。本機路徑為 `/home/mark/projects/uptime-kuma-nuxt-20261114`，分支 `codex/api-monitoring-platform-20261114`，checkpoint `977624b92597f366b74181ef38ba027c1282ff84`之後仍有大量未提交／未追蹤變更。artifact manifest的working-tree hash記錄實際產品來源；不能用GitHub現有分支或該checkpoint宣稱取得全部新版。目標repo尚未完成v-terminal註冊／正常GitHub授權，沒有繞過平台去push。

- 產品來源：上述完整本機工作樹；交付前保留所有dirty/untracked檔案，不能只傳commit hash。
- canonical部署：`Dockerfile`、`docker-entrypoint.sh`、`deploy/k8s/base`、`deploy/k8s/overlays/multi-node`、`deploy/helm/uptime-api`。操作入口為 [Kubernetes部署文件](../KUBERNETES_DEPLOYMENT.md)。
- 證據與來源identity：本摘要、[EVIDENCE_INDEX](EVIDENCE_INDEX.md)、`.data/validation-logs/final-settings-artifact.log`與`final-artifact-verification.json`；不要將credentials檔案一併散發。
- private GitOps部署repo已由root沿授權流程commit/push `e43d6a2f3a9ba9e215435d4692370534d5678117`。這個commit只代表部署chart/release，**不是產品GitHub repo已同步**。

待正常repo註冊／GitHub授權後，再審核本機差異、依產品repo流程commit/push並記新source revision；目前不自動commit、不借用其他identity。最終產品artifact之後的manifest與本次文件更新亦須納入來源交付；先前build context不含這些較晚變更，不需因此重包runtime或宣稱context就是完整最新工作樹。

## 殘留typecheck的實際影響

66次診斷包含58個不同位置，**並非全無使用者影響**。唯讀source audit確認badge signature、tags edit缺route、status group drag漏binding、session撤銷缺route與legacy node時間欄位等接續缺口；badge純函式已重現TypeError，其他標明source推論、未作live重現。詳 [TYPECHECK_REPAIR_QUEUE](TYPECHECK_REPAIR_QUEUE.md) 與逐項JSON；明確不支援legacy協定／未引用元件／型別與樣式另分，不以77pass掩蓋未涵蓋互動。

## 部署站live REST補驗（16:37）

Astra直接讀 `final-live-rest.json`：16:36:55–16:37:01 passed=true，對已部署8d0593私人NodePort入口驗monitor CRUD／typed assertion trial、read/write environment-bound key與foreign environment拒絕、Bruno declarative preview／paused import／export／trial／拒絕scripts、manual maintenance inactive→resume→真worker status3/MAINTENANCE→pause（保留舊dates亦正確）。

在既有workspace1中只建立2個臨時environments（2,3）、2個monitors（6,7）、2個keys（1,2）、1個maintenance（1），依精確ID cleanup；monitor7在cleanup時已absent，其餘刪除成功。originalDemosUnchanged=true，原5筆paused demo before/after一致；environment集合恢復。**未建立／刪除workspace，不宣稱workspace delete已驗**，也不將此與完整RBAC矩陣混為同一次測試。

第一次 `final-live-rest-attempt1.json` 仍保留：16:36:02的environment POST回503，cleanup驗證GET monitors亦503，owned IDs清單皆空。未保存response body，無法歸因；第二輪成功不證明503原因已修復。root將另做低頻唯讀健康／已登入GET觀察，尚未有最終結果前不宣稱完全無間歇錯誤。
