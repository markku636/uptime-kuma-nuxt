# 驗證證據索引

更新：2026-11-14 16:35 Taipei。最終8d0593 build／full77pass＋1skip／targeted5/5／unit37通過，Stage B/C/D完成、revision9 Healthy／Synced，新版兩API＋兩worker smoke通過；a4134b rolling update另列舊revision。不同revision不得混成最終全套通過。

使用者已取消 4000 活躍監測／持續負載／容量 benchmark。保留歷史量測，不補跑、不把它列完成條件；只清除仍存在且有 ownership 證據的本次 fixture，保留 5 demos。K8s 改以多節點可部署設定為目標，現場 lab 仍只有一 node。

| 項目 | 已記錄證據與限制 | 最終待驗 |
| --- | --- | --- |
| Phase0–3.5 | [auth](baseline-auth.md)、[workspace](workspace-isolation.md)、[assertions](api-assertions.md)、[Bruno](bruno.md)、[resource secrets](resource-secrets.md) 為各輪結果；早期 `/tmp` log 在 11:56 主機重啟遺失 | 最新 build 上完整 regression |
| Phase4 | [scheduler](distributed-scheduler.md) 記錄最終 68/68 與真 TCP blackhole／多 process；原 `/tmp` logs 已遺失，不能當現有可下載附件 | 最終整套 regression；不需要再單獨反覆測舊輪 |
| Phase5 | [read/retention](scale-read-retention.md) 記錄 14/14 切片，來源 helper 與當時 5A HTTP build 的差異已列；後續已實際核對 `.data/validation-logs/phase5-final-integration.log` 存在（更正前輪未找到的註記），仍須保留 source helper／5A artifact 差異 | 新 production artifact 的 background／clear／REST 接線回歸，最終 logs 存 `.data/validation-logs` 並記真路徑 |
| 獨立 PG correctness | [late-insert](astra-rollup-race-probe.json)、[snapshot](astra-rollup-snapshot-probe.json)、[ledger rollback](astra-ledger-rollback-probe.json) 小 fixture 結果保留；各 own DB 已清除 | 不擴為容量結論 |
| 歷史 read benchmark | [results](read-path-benchmark.json)、[cleanup verification](read-path-benchmark-verification.json)：5.76m synthetic rows、20 warm SQL samples；不是 HTTP／active ingestion／concurrent load | 使用者取消新增容量量測 |
| MCP UI | root 的 desktop/mobile screenshot 與 detail→dashboard Live 操作；Bruno `root-mcp-bruno-{before,preview,rejected}.jpg` 現存於 `.data/validation-logs` | Bruno 畫面證明 preview 成功／拒絕，不替代完整 import 或 final REST/UI flow |
| K8s A–D | [K8s report](k8s.md)：最新8d0593 revision9 Healthy／Synced，B/C/D與16:32新版5-demo雙API smoke通過；a4134b rolling update另有150次health全200 | 追加live REST lifecycle已PASS並cleanup；首次503原因未明；Kaniko d6 image build成功但built-image runtime未驗 |
| 多節點 | chart image 模式與 strict hostname spread 可靜態 render；見 [review13](astra-review-13.md) | 現場單節點，真正跨 node placement／node loss 未執行 |
| 雙網域 | [domain report](domain-delivery.md)：exact origins本機contract已驗；MCP缺settings:write拒絕寫入 | 待正常平台授權；DNS/TLS與雙host login／REST／WS尚未完成，禁止fallback繞過 |
| Typecheck | final-interactive-typecheck.log實數66條error TS、exit2；前輪76、較早114／110是歷史輪次，沒有完整逐項baseline分類 | 仍未通過；不能全部稱既有，production build成功不等於typecheck通過 |

最終更新需記 source commit＋working-tree hash、build/archive identity、測試者、時間、實際指令／版本、原始 log 是否存在、pass/fail/not-run 與局限。原始檔遺失時保留當時結果及遺失說明，不能補造 log 或把其他輪數字拼成一次全套通過。`.data` 為本機證據，最終需選擇去秘密、可交付的摘要／附件；不要將 credential 檔或 secret values 包入 artifact。

## Cluster 修後追記

Astra 已讀 `.data/validation-logs/deployment-cluster-fixed.log`：5/5 PASS、9.104秒、owned DB dropped。涵蓋兩API state、LISTEN reconnect／撤權、push、remote pause/edit／精確worker drain與blackhole readiness。這是修後cluster切片，不是full-suite76/76；原full-suite71/76與中間16pass/1fail/1cancelled保留，失敗分析見 [review14](astra-review-14.md)。

## 修後 full regression 追記

Astra 已讀 `.data/validation-logs/deployment-full-fixed.log`：76 tests、75 pass、0 fail、1 skipped、90.600秒，owned DB dropped。skipped 是已取消的4000 Bruno bulk；此結果涵蓋維護REST與真worker窗口、assertion／Bruno browser、workspace／secrets／scheduler／retention。不能寫76/76。此輪之後新增的profile schema/UI修復需新build與自己的測試，未由此log驗證；K8s／雙域名仍獨立驗收。

## 16:17 尚待交付的必要項

新profile/manual/OpenAPI build與對應smoke、更新runtime SHA／部署驗證；canonical image actualbuild狀態；雙域名平台權限。已有a4134b K8s的5 demos保留且pause成功、fullsuite75pass1skip、cluster5/5；這些不抹除目前限制。早期/tmp在第一次重啟遺失；repo內現存logs在第二次重啟後仍可讀，不能把所有證據一概寫成遺失。

## 16:24 新候選與 rolling update

Astra直接讀取 `final-interactive-build.log`（Build complete）、`final-interactive-integration.log`（5/5、0fail、owned DB dropped）、`final-interactive-typecheck.log`（66 diagnostics、exit2）與 `final-interactive-artifact.log`。候選SHA為 `98eb511c95af81a5a3ecea70b71158adf1f0ea8ad5a7e133f88607fce9a9aa85`，201899993 bytes，含最新profile SSR互動guard／maintenance／OpenAPI修復；這是本機候選證據，尚未取代cluster中a4134b。targeted5項涵蓋monitor/maintenance keyscope lifecycle、真worker維護窗口、profile安全DTO／timezone、mobile保存後reload、OpenAPI／metrics契約，並非新版本完整75項回歸。

root的 `cluster-rolling-update-smoke.json` 已獨立讀取：150次health全200、WS重連（共2次連線）、state revision2→3→3→4→5；新4instances running、原4instances draining、最後paused=true。重複revision3是resync，非新增heartbeat；仍單node與舊a4134b。d6 source context的Kaniko no-push build此刻仍執行，未標PASS，也不代替98eb511c的image runtime驗證。

`final-unit.log`獨立讀取為37/37通過。`final-cleanup-audit.json`（16:22）記本機DB只剩5筆paused demos（IDs8353–8357）、heartbeat/outbox orphan各0；資料庫清單僅postgres與uptime_kuma，沒有殘留owned test DB。這份是本機清理盤點，與K8s IDs1–5分開，不宣稱刪了不存在的4000筆。完整交付摘要見 [RELEASE_VALIDATION](RELEASE_VALIDATION.md)。

## Kaniko完成追記（16:24:05）

Astra已直接讀 `kaniko-d6-build-result.json`：canonical Dockerfile no-push build Succeeded，image digest `sha256:bc37be21e220d9d88d6193525ab8fdaca4787fab5b2b63452335b82d2f6bd764`，tar353607680bytes。這只證明d6 source context的實際image建置，不是registry發布或built-image runtime，也不包含其後最終UI修復。較早「執行中」是當時狀態，現以本追記為準。98eb511c候選未部署，Sol因最後UI select修復再產新artifact，最後部署identity待新manifest。多node模板獨立render及每revision spread finding見 [review16](astra-review-16.md)。

## 16:29 最終產品凍結

最新是8d0593而非98eb511c，完整SHA與provenance見 [RELEASE_VALIDATION](RELEASE_VALIDATION.md)。Astra已直接讀 `final-settings-build.log`成功、`final-settings-integration.log`5/5、`final-settings-unit.log`37/37、`final-settings-typecheck.log`66 diagnostics exit2、`final-artifact-verification.json`與`final-stage-b.json`（16:28:28載入Succeeded）。最後full integration還在執行，尚未計為通過；新版migration/runtime待root記錄。

## 16:32 最後完整回歸與manifest複核

Astra直接讀 `final-full-integration.log`：78 cases、77 pass、0 fail、1 skip（取消的4000 bulk）、96.129秒，exit成功且owned DB dropped。最新runtime為8d0593；typecheck仍66 diagnostics exit2。`final-stage-c.json`為16:29:16 Succeeded，native runtimeCheck passed、13 migrations無pending。strict multi-node每revision分散已修，三種render獨立驗證見 [review16](astra-review-16.md)；尚未有實際跨nodeplacement。

## 16:35 最終K8s部署與smoke

Astra直接讀 `final-stage-d-status.json`（revision9 Healthy／Synced）、`final-stage-d-pods.json`（新版2API＋2worker Ready，同一testing-machine）、`final-cluster-smoke.json`（8d0593、profile修改還原、每API各5新revision／heartbeat20–24、預期4成功1assertion失敗、最後全paused）。初次snapshot race失敗JSON保留，第二次僅修測試等新history／revision，沒有runtime修復。runtime部署gate已完成；追加live REST lifecycle待Sol結果，雙網域／真跨node／built-image runtime限制不變。

## 產品來源發布狀態

產品GitHub repo尚未推送：本機branch `codex/api-monitoring-platform-20261114`、checkpoint977624b後有dirty/untracked變更。private GitOps已推送e43d6a2是部署repo，不能代替產品來源發布。取得完整來源／canonical檔案與正常授權待辦見 [RELEASE_VALIDATION](RELEASE_VALIDATION.md)。

## 殘留typecheck的實際影響

66次診斷包含58個不同位置，**並非全無使用者影響**。唯讀source audit確認badge signature、tags edit缺route、status group drag漏binding、session撤銷缺route與legacy node時間欄位等接續缺口；badge純函式已重現TypeError，其他標明source推論、未作live重現。詳 [TYPECHECK_REPAIR_QUEUE](TYPECHECK_REPAIR_QUEUE.md) 與逐項JSON；明確不支援legacy協定／未引用元件／型別與樣式另分，不以77pass掩蓋未涵蓋互動。

## 部署站live REST補驗（16:37）

Astra直接讀 `final-live-rest.json`：16:36:55–16:37:01 passed=true，對已部署8d0593私人NodePort入口驗monitor CRUD／typed assertion trial、read/write environment-bound key與foreign environment拒絕、Bruno declarative preview／paused import／export／trial／拒絕scripts、manual maintenance inactive→resume→真worker status3/MAINTENANCE→pause（保留舊dates亦正確）。

在既有workspace1中只建立2個臨時environments（2,3）、2個monitors（6,7）、2個keys（1,2）、1個maintenance（1），依精確ID cleanup；monitor7在cleanup時已absent，其餘刪除成功。originalDemosUnchanged=true，原5筆paused demo before/after一致；environment集合恢復。**未建立／刪除workspace，不宣稱workspace delete已驗**，也不將此與完整RBAC矩陣混為同一次測試。

第一次 `final-live-rest-attempt1.json` 仍保留：16:36:02的environment POST回503，cleanup驗證GET monitors亦503，owned IDs清單皆空。未保存response body，無法歸因；第二輪成功不證明503原因已修復。root將另做低頻唯讀健康／已登入GET觀察，尚未有最終結果前不宣稱完全無間歇錯誤。
