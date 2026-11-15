# Astra review15：多節點交付與範圍缺口

2026-11-14，docs-only／產品只讀；未build、重啟、部署或改DB。Sol唯一實作者。已取消4000負載，保留5 demos、REST／maintenance／UI／assertions／Bruno／workspace／雙網域需求。

## 已確認且值得修復的缺口

1. Profile GET/PUT原本select/update不存在User欄位email/displayName/avatar，root真HTTP500、source相符；頁面還顯示假Administrator與當日MemberSince。已先落 [窄Spec](../specs/2026-11-14-profile-schema-repair.md)，Sol其後source改為session-only安全DTO＋strict timezone更新，無migration。本輪讀新source未見同類假欄位；新build／HTTP/browser測試尚需完成，舊StageB SHA不會自動包含修復。
2. README仍稱3／5node OpenResty叢集、舊cluster switch範例、各legacy scheduled協定／SMTP／proxy全面支援，且使用db push初始化。這與實作不符，屬實際部署誤導。經Sol協調由Astra文件修正：README導向canonical Compose與image multi-node，移除假功能宣稱；新增 [Kubernetes runbook](../KUBERNETES_DEPLOYMENT.md)、更新CLUSTER_RUNTIME與TESTING。不改Sol的deploy/README。

## 多節點 manifests 的獨立驗證

`kubectl kustomize deploy/k8s/overlays/multi-node` 只作本機render並yaml解析，成功。兩Deployment各replicas2、各自component selector、hostname maxSkew1/minDomains2/DoNotSchedule；沒有application artifact PVC。base Service只選API；worker只probes。migration示例獨立於kustomization，runbook明確先Secret/DB／Job Complete再rollout，避免同批apply誤以為有順序保證。

本輪未見需要阻擋部署的新確切source P1。image placeholder、namespace、public origins、外部PG／Secret需部署者實際替換；不能把raw模板render成功當成部署成功。lab只有單node；artifact local-path RWO、多副本PG/入口單點限制仍明示。跨node實際排程與node loss未跑，不能補造證據。

## 使用者需求對照

| 要求 | 本輪可確認 | 交付仍須記錄 |
| --- | --- | --- |
| REST monitor／maintenance | 現行OpenAPI＋REST_API文件；full-fixed真HTTP權限／生命周期與窗口內零HTTP、結束恢復通過 | 部署版本雙host實測與最終文件鏈結 |
| Assertions | full-fixed browser pass/fail試跑／保存重載與write-only設定通過 | 最終artifact身份 |
| Bruno | full-fixed preview／原子pausedimport／腳本拒絕與browser通過；root MCP preview/rejected畫面 | 不冒稱script runtime；4000bulk已skip |
| Workspace／environment | full-fixed跨scope API／socket、role、envsecret與關聯負例通過 | 部署demo／viewer操作確認 |
| UI | desktop/mobile dashboard/list與Bruno有MCP/CLI既有證據；profile新缺口已開Spec修復 | profile新build／390px保存重載；不可用舊截圖宣稱修後通過 |
| K8s多node | canonicalimage配置／strictspread靜態render通過 | actualimagebuild／builtimage runtime各自結果；lab單node限制 |
| fewdemos／雙DNS | owned cleanup與5demos保留契約已寫；exactorigin contract已測 | 實際剩餘IDs、setupclosed、兩HTTPS登入／REST／WS；root執行 |

## 回歸證據

獨立讀 `deployment-cluster-fixed.log`：5/5，9.104秒，ownedDBdropped；原LISTEN ACK等待與worker identity誤選修法見review14。

獨立讀 `deployment-full-fixed.log`：76 tests、75pass／0fail／1skip（取消的4000Bruno case），90.600秒，ownedDBdropped。這是新成功一輪，不能回寫原71/76為通過，也不包含其後profile修改。當前不把所有typecheck診斷稱既有、不把本機fullsuite稱K8s或MCP。

`phase5-final-integration.log` 現已直接核對存在，證據索引更正先前未找到註記；仍保留當時5AHTTPartifact與source helper混合驗證的限制。原早期/tmp logs因hostrestart遺失的事實不變。
