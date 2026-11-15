# Spec：Kubernetes 多節點支援與可重現部署驗收

狀態：🔵 待實作。日期：2026-11-14。Astra規劃／審查、單一Sol實作，root操作隔離驗證環境。接續phase5讀取／聚合／retention；範圍是部署本平台的多API／worker，不做Kubernetes資源自動發現。

> 2026-11-14 13:29 台北使用者修訂：取消 4000 活躍監測／負載／容量驗證，不再新增或執行該 benchmark。保留既有歷史量測；清除實際存在的本次 owned fixture，保留 5 demos。多節點部署架構以本文件新增契約為準，單節點 demo 不等於 node HA。

## 分段與完成定義

6A修正可建置image、獨立migration Job、K8s manifests與升級runbook；6B提供可重現的本機 integration harness 與多節點 image 部署設定；6C在隔離namespace實跑多Pod、rolling restart／worker loss並存結果。不得把 manifest 存在或單節點多 Pod 當作跨節點實測。

剩餘時間優先落可操作的最小部署與真量測。保留HTTP／keyword／JSON query scheduled adapters及push；其餘legacy協定明示unsupported，不在本階段擴TCP/DNS等。頁面預設100/max200，不為負載測試換成無限all endpoint。

## 6A：建置與部署產物

現有Dockerfile使用yarn與未維護鎖檔，entrypoint可能自動schema初始化；改以現行package-lock與`npm ci`，Node版本符合engines並與測試環境記錄一致。使用符合 Node 要求的 Debian base，canonical image 明確安裝所需 OpenSSL 系統函式庫；slim tag 本身不證明 Prisma 相容，任何 base 均須在選定 image 真啟動 engine 與 migration。多stage建置，build-time dummy DB URL僅供generate，不接正式DB，不COPY任何`.env`／log／測試秘密。

runtime必須包含`.output`及其實際external依賴，migration執行需要`scripts/migrate.mjs`、完整Prisma CLI依賴及`prisma/migrations`。可同image包含migration CLI，或同一source revision獨立migration target；不得只COPY Prisma幾個資料夾卻缺傳遞依賴。驗收在乾淨容器跑live/ready、migration與一筆真HTTP check，不能依賴host node_modules。

entrypoint預設只以`exec node .output/server/index.mjs`啟動，讓SIGTERM送到Node；不在每個replica跑db push／migration／seed，不恢復舊scheduler。已有單機自動migration模式若保留，必須明確opt-in且K8s關閉。以non-root UID執行、drop ALL capabilities、allowPrivilegeEscalation=false，runtime唯讀rootfs（必要`/tmp`掛emptyDir）；沒有privileged、hostPath、Docker/containerd socket、hostNetwork。

現有`docker-entrypoint.sh`會以預設postgres密碼等待DB、執行舊`prisma/init.sql`且吞錯；此行為必須移除，不能讓新版image仍走舊初始化。canonical `docker-compose.single.yml`改以獨立migration service（完成後app啟動）、明確APP_ROLE=all及外部必填session/encryption secrets。`docker-compose.yml`與`docker-compose-cluster.yaml`若維護為新版，須明確API/worker roles、同migration gate、移除NODE_ID分工假設；若本輪無法完整驗舊OpenResty架構，則加顯式legacy啟動guard／profile並在檔頭與README指向新版，不能讓預設compose悄悄跑三個all process。至少一套canonical compose需fresh DB可啟動，不能只有K8s能用。盤點實際存在的CI/build workflow同步package manager與image target，沒有workflow不得聲稱CI已過。

Kustomize base包含以下具體資源：

- API Deployment replicas2，`APP_ROLE=api`；worker Deployment replicas2，`APP_ROLE=worker`。設定shared DB/session/encryption secrets，透過Secret引用，不放真值進git。每process使用新UUID；Pod UID/name僅作安全diagnostics。
- API Service只選API pods；worker沒有外部Service／Ingress。Ingress範例預設不建立，選用時支援WebSocket upgrade並設定明確APP_URL。
- ConfigMap列明WORKER_CONCURRENCY/PER_ORIGIN/CLAIM_BATCH、lease/renew/drain、DB pools與retention設定。Secret example使用不可誤當有效密鑰的placeholder；runbook產生高熵測試秘密，禁止輸出值到報告。
- 專用migration Job，restartPolicy Never、backoffLimit1、activeDeadlineSeconds300，明確執行`node scripts/migrate.mjs`。部署順序：建立測試DB/secret→Job成功→API/worker rollout。Job失敗不繼續deploy；每次版本用不同Job名或先確認完成再替換。
- API/worker都提供startup/readiness/liveness probes。liveness只看process，不因短DB outage反覆重啟；readiness驗security/bootstrap/runtime/DB。控制query約3秒，readiness timeout建議5秒；startup可給120秒。具體值寫manifest，不能只依預設1秒造成探針重疊。startup若用live不代表已ready。
- terminationGracePeriodSeconds至少40，覆蓋15秒worker drain＋兩次控制DB上限＋server收尾；`preStop sleep`若採用會占同一grace，要計入。readiness立即false、停止claims、有限取消HTTP，最終容器退出。部署maxUnavailable0/maxSurge1；api及worker PDB minAvailable1。
- 保守requests/limits起點：API每Pod250m/256Mi request、1CPU/768Mi limit；worker500m/512Mi request、2CPU/1Gi limit。這是測試起點，不是4000容量保證；記錄OOM/throttling與調整值。Pod拓樸分散採preferred，單節點也能排程；不能把同節點兩Pod說成node HA。

DB以外部PostgreSQL16連線為正式base前提。test overlay可新增隔離PG16與PVC／emptyDir；正式文件需說明備份/HA/磁碟，不在本次改既有clusterDB。連線預算含每process一般pool6＋控制pool3、每API listener1、migration／fixture額度；兩API兩worker約38配置上限，server須留餘裕。

## 隔離 namespace 的實跑限制

持久demo的實際控制台部署流程見 [GitOps artifact部署方案](../GITOPS_DEMO_DEPLOYMENT_PLAN.md)：task-owned Helm chart經v-terminal MCP，分DB/Secret、artifact PVC載入、migration、2API2worker四關，NodePort32480。canonical Kustomize仍保留；最終Pod只讀immutable SHA目錄，loader完成後停止短命artifact server並驗新Pod可重建。此路徑不需k8s_apply、不使用hostruntime或既有registry憑證。

root目前可使用既有RKE2單節點cluster，測試必須建立唯一名稱例如`uptime-api-verify-20261114-<suffix>`並標task-owned label。所有apply/get/delete帶此namespace，事前確認不存在；不使用／清理既有`uptime-kuma`、Harbor或其他namespace。只刪本次建立且label吻合的資源。禁止讀取、列印、借用既有registry secrets；不改node、runtime、StorageClass或既有ingress。

如無本機image builder/push能力，允許在隔離namespace用官方Node24 base掛入本次`.output`及必要runtime dependency artifact做實跑。artifact限本次build，記錄SHA256／source基底SHA＋dirty diff hash／Node版本與完整copy範圍；傳輸不要包含`.env`、git metadata、DB dump或log。本次只用受限短命 artifact server 供 GitOps loader 讀取，完成立即停止；cluster 變更仍由 root 透過 MCP，不改為直接 kubectl cp。

這種路徑報告必須標「K8s artifact smoke」，不冒稱本repo Dockerfile image已部署。若另外以無特權Kaniko `--no-push`驗證Dockerfile並產生tar，記錄build是否完成；image build成功仍不等於那個image已實跑。預期交付三個獨立欄位：Dockerfile build、built-image runtime、K8s artifact/runtime。不能為補最後一欄而使用hostruntime或既有registry憑證。

## 6B：可重現 integration harness

目前`test:integration`依賴外部已啟動app、DB與密鑰，不足以從fresh checkout重現。新增`scripts/test-integration.mjs`或同等wrapper，保留單檔debug模式並提供一條完整命令。

runner接受`TEST_PG_ADMIN_URL`，預設只允許localhost/127.0.0.1，拒絕非local與指定既有業務DB作清除目標；建立隨機唯一`uptime_test_<id>` DB，記錄owned名稱後才cleanup。自行產生測試session/encryption key、選空port、跑migrate與production server、輪詢ready後執行tests。build可選先前已完成同tree artifact，報告是否重新build。tests helpers統一使用runner傳入BASE_URL/DATABASE_URL等已知env，不能暗中連固定32511或固定正式DB。

只終止runner自己spawn的child PID/process group，只drop自己建立的DB；SIGINT/timeout也cleanup，不killall node，不停共用PG。before/after cleanup可重跑，不把失敗測試吞掉；退出碼保留實際結果。提供精確Node版本、Postgres啟動方式、環境變數、fresh `npm ci`→build→test命令。故障測試仍用本機TCP proxy與新DB，不ALTER共用DB/server全域參數。

## 多節點部署契約（13:29 修訂）

正式路徑使用可從各節點拉取的 immutable application image（最好 digest），包含 runtime 與相同 source 的 migration 依賴；API／worker 不掛 artifact PVC、不使用 hostPath、不依賴本機短命 server。兩 API 與兩 worker 共用外部 PostgreSQL、session/encryption keys、origin 設定；控制 leases/fencing、outbox 與 PG fanout 沿既有 phase4 實作。image registry 使用部署者明確提供的引用；本任務不讀取／借用既有 registry credentials。

新增 `deploy/k8s/overlays/multi-node/{kustomization,topology}.yaml`，分 API／worker label 套用 `topology.kubernetes.io/zone` 的可選偏好及 `kubernetes.io/hostname` 的實際跨 node 限制。最小實作採 hostname topologySpreadConstraints：maxSkew1、minDomains2、whenUnsatisfiable DoNotSchedule、每角色自己的 selector；或等價 required podAntiAffinity。需至少兩個可排程且有正確 label 的節點，單節點應明確 Pending，不可偷偷退回同 node 而宣稱跨節點。demo overlay 保持 preferred／ScheduleAnyway，不在現有單節點套 strict overlay。保留 rolling maxUnavailable0/maxSurge1、PDB minAvailable1；不要用 required anti-affinity 導致僅兩節點時 surge 永遠無法排程。

若選 Helm artifact 模式，只有部署者既有 **RWX 且跨節點可掛載** 的 storage class／existingClaim 才可支援跨節點；提供 `artifact.existingClaim`、accessModes/storageClass 與 deployment mode 選項時，拒絕將 local-path RWO 標成 multi-node。RWX 路徑仍須 immutable SHA、read-only app mounts、原子載入。這是可選相容路徑，不要求本次建 NFS/Ceph 或改 cluster StorageClass。canonical image 路徑是本期必要交付。

PostgreSQL 是共同持久狀態。正式 multi-node values 使用外部 PG Service/URL，備份／HA 由部署者提供；內建單 replica local-path PG 僅 demo，會因其所在 node 故障停止整個平台。不能因 API／worker spread 就聲稱 DB HA。兩 API 的 ingress/LB 需可連所有 ready endpoints；目前指向單一 node IP 的 FRP NodePort 也非入口 node HA。

驗收分兩層：本次單節點 lab 做 migration、兩 API／兩 worker、小量受控 checks、Pod loss／rolling restart；跨 node 需另在至少兩 node 環境確認兩角色實際 nodeName 分散，再停止一個 owned worker Pod 驗 lease 接手。真正 node loss/drain 僅限另有明確授權的隔離多 node 環境，並區分 PG／入口單點；本輪標記未執行，不造假或觸動共用 node。

## 6C：多 Pod 與故障驗收

以少量 task-owned 資料驗 migration、roles 與 probes，再開短故障窗口：workerA有真inflight時SIGKILL／刪除該Pod（只本次namespace），B在lease到期後接手，舊A結果不能accepted。API列表/summary持續可用；pod替補後仍只有兩worker、沒有永久卡住leases。記錄故障與恢復時間、峰值lag、missing/duplicate run。

對API與worker各做一次rollout restart，監看readiness、終止前停止claim、grace內退出，任一API socket的狀態可由另一API／worker繼續更新；斷線socket重連resync。已有兩API/worker integration的跨scope與撤權測試必須仍通過，K8s smoke可只重驗核心路徑但不能取代原suite。

DB黑洞／cold prepare／startup recovery的真process cases保留在本機獨立tests，K8s不需要阻斷共用cluster網路。單節點本次不做node kill/drain，也不宣稱PG HA、整個cluster容災或跨AZ驗證。

## 讀取／儲存與升級驗收

使用者追加最終交付：依 [REST/UI交付Spec](2026-11-14-rest-maintenance-ui-delivery.md) 精確清除實際存在的 owned 4000 fixture（不再執行負載），只留5筆demo。公開demo站需獨立持久化PVC與保留namespace，不能與暫時benchmark環境一起cleanup；DNS發布前完成admin setup並確認setup已關閉。兩個HTTPS網域的REST/WebSocket驗收與origin清單由同份Spec約束。

phase5必須先通過：100頁讀取、跨scope cursor、選擇器第201筆後仍可存、current state在raw清理後可用、正確時間加權uptime、sealed-rollup先於retention。保留既有 raw/rollup 儲存量測及其 synthetic payload 限制，提供 retention、WAL／vacuum 與備份容量說明；不再為容量驗證新增大批 fixture。

runbook寫備份→停止舊scheduler→migration→部署→驗ready與scoped操作。不可混跑舊無fence scheduler。舊HTTP設定密文回填與unsupported protocol顯示要先檢查；新API routes/列表分頁與secret不可讀是相容性變動。rollback採停工後相容版本／DB備份還原，不能自動drop新tables或解密回明文。沒有完成備份／還原實測時明示。

## 受影響檔案

- `Dockerfile`、新增`.dockerignore`、`docker-entrypoint.sh`、`package.json`／`package-lock.json`（僅必要scripts/deps）、`.env.example`。
- `docker-compose.single.yml`、`docker-compose.yml`、`docker-compose-cluster.yaml`與README原Docker入口；若需新增canonical compose檔，先在此列明並把既有入口導向同一流程。`.github/workflows/*.yml`僅實際存在或新增的建置workflow，新增前列具體檔名。
- 新增`deploy/k8s/base/{kustomization,namespace,configmap,secret.example,api,worker,service,migration-job,pdb,ingress.example}.yaml`；可合併資源但保留明確對應。新增`deploy/k8s/overlays/test/{kustomization,postgres,resources}.yaml`及必要artifact-smoke overlay／Job。
- `scripts/migrate.mjs`（僅有必要的Job診斷／有限執行，不改已驗migration語意）、新增`scripts/test-integration.mjs`、必要`scripts/k8s-smoke.mjs`。harness需共用helper可新增`scripts/lib/test-environment.mjs`。
- artifact路徑若需要可重用工具：`scripts/package-runtime-artifact.mjs`、`scripts/verify-runtime-artifact.mjs`，只允許本次stable build allowlist、SHA/bytes、safe archive path與必要依賴驗證，不包含Secret／環境檔或操作hostruntime；root負責MCP傳輸與部署。
- `tests/helpers/http.ts`及真使用固定URL的integration helpers，新增`tests/deployment.integration.test.ts`僅驗必要runner guard或生命週期，不寫大量模擬manifest的鏡像測試。
- `docs/CLUSTER_RUNTIME.md`、新增`docs/KUBERNETES_DEPLOYMENT.md`、`docs/TESTING.md`、`docs/validation/k8s.md`與JSON結果（去秘密）、`README.md`交付入口。phase5性能結果放原phase5報告。
- 若實測要求修runtime/probe/drain，先在本Spec補具體檔案／問題，沿既有phase4規則由Sol修，不開第二實作agent。

本階段預期無產品DB schema新增；若phase5 migration仍未完成，依phase5 Spec單獨列table、index與回復策略。測試DB／namespace／PVC生命週期不可混入產品migration。

## 官方依據與證據標示

[Kubernetes Jobs](https://kubernetes.io/docs/concepts/workloads/controllers/job/)支援一次性工作與重試限制；本方案仍由部署順序等待migration完成，不假設Deployments會自動等Job。

[Pod lifecycle](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/)定義termination grace與SIGTERM流程；[probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)區分startup/readiness/liveness。manifest需符合本次RKE2/K8s1.33可用欄位，不使用新版本專屬功能。

[Disruptions/PDB](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)不使單節點成為高可用，PDB也不是應用程式自身rolling策略的替代。最終報告列實際cluster版本／node數、各項pass/fail/not-run、測試執行者與artifact hash；無MCP就記瀏覽器自動化，typecheck仍有診斷就不可宣稱通過。

測試域名前置：以本機fixture建立platform admin與獨立Demo workspace、5個清楚命名paused API示例；密碼隨機、只寫`.data/validation-credentials.json` mode0600不入git/log。owned IDs記錄，若先前存在 4000 fixture，僅按原 owned IDs／workspace 清除，不重新建立，Demo/user資料保留。暫存fixtureserver/scripts實際路徑需列後續runner。雙域名由root以exact APP_ALLOWED_ORIGINS設定，先確認setup已關閉才公開。

Demo實際腳本：`scripts/demo-fixture.mjs`（loopback HTTP fixture）、`scripts/create-demos.ts`（已授權本機demo資料，owned IDs持久`.data/demo-owned.json`，預設paused，無外部notifications）。K8s fixture以同artifact Node啟動，明確綁fixture Service；負載清理不得移除此獨立demo資料。

6A operational Helm 實際路徑：`deploy/helm/uptime-api/{Chart.yaml,values.yaml,values-lab.yaml,templates/**,files/load-artifact.py}`。Stage A 只 render PostgreSQL16.14 StatefulSet/ClusterIP與Retain PVC，database secret預期`uptime-api-db-secret`的`POSTGRES_PASSWORD`；application secret預期`uptime-api-secret`的`DATABASE_URL`、`NUXT_SESSION_PASSWORD`、`APP_ENCRYPTION_KEY`。此公開repo只存引用，不存秘密。root透過MCP複製到既定private deploy chart path並sync。


## Root 執行紀錄：Stage A（2026-11-14 12:38 台北）

- 透過 v-terminal MCP `deploy_write_files` 建立本次 chart 與兩份專屬 Secret，`deploy_commit_push` 僅提交本 namespace 路徑；GitOps commit `2865d998f72e9c9b04a5e9283310c2e7dbf4fe88` 已推送，檔案清單已獨立核對，沒有混入其他 session 檔案。
- `deploy_sync_release` 指定 `environment=lab`，job `424e10aa-25a9-4368-a226-45e47a2378ef` 成功，release `uptime-api` revision 1。平台同步流程也重套其既有 cluster PV manifests；本次沒有編輯這些 PV 宣告。
- 專用 namespace `uptime-api-demo-20261114`，PostgreSQL `uptime-postgres-0` Running／Ready=True、restartCount=0。PVC `database-uptime-postgres-0` 為 Bound／10Gi／RWO／local-path；StatefulSet PVC retention=Retain。StorageClass 的 PV reclaim 仍是 Delete，因此不得把刪除 PVC 當成保留資料。
- 實際 PostgreSQL imageID：`docker.io/library/postgres@sha256:64154d0babcb1741988719e703419af0382b19953706149f9872fbd0f438efa8`。目前尚無 API／worker pods、NodePort service 或 DNS／FRP 寫入。
- 專屬 app Secret 三鍵與 DB Secret 一鍵逐值比對相等，只記 keys 與布林結果，沒有輸出值。來源在既有私有 GitOps repo 的本次 namespace 路徑；未讀取或重用其他服務秘密。
- 舊 e2e-login 文件與現場不同：`/api/auth/providers` 目前只有 github／email-otp，未提供 e2e，測試登入沒有建立 session。因此沒有經該 session 查到 deploy-window，也沒有宣稱已經 UI 驗證；依 MCP 本身的實際部署閘門結果繼續。
- 證據：`.data/validation-logs/deploy-stage-a-write.json`、`deploy-stage-a-verification.json`。下一步是固定 SHA artifact 載入、migration、API／worker，再做 MCP 介面及小量多 Pod 驗證；Stage A 不代表 phase6 完成。

## Root 額外握手驗證（本機 API，2026-11-14 12:37 台北）

使用真登入 cookie 取得 socket ticket，以 Node WebSocket client 分別送出 localhost、兩個預定 HTTPS origin，三者均連線成功；`https://uptime.226network.com.evil.invalid` 被拒。證據 `.data/validation-logs/root-socket-origins.json`。這是本機伺服器的 origin contract 驗證，不是兩個公開網域的 DNS／TLS／瀏覽器登入驗收。

## Canonical image 建置驗證補充

依 [窄範圍 no-push 建置方案](../IMAGE_BUILD_VERIFICATION_PLAN.md)，在 demo Stage B 之後執行，不阻擋 artifact。Sol 可新增 `scripts/package-build-context.mjs`、`deploy/helm/uptime-api/templates/build-verification.yaml` 與對應 values；若採獨立 builder chart，改用 `deploy/helm/uptime-build/{Chart.yaml,values.yaml,templates/job.yaml}`，擇一即可。root 仍透過 MCP GitOps 部署。這是建置驗證，不是 runtime／4000 負載；容器 UID0、非 privileged 的短命 builder 特例不改 API／worker 的 non-root 要求。

Loader實際驗證修正：Helm values中的byte整數輸出使用`int64 | quote`，避免201895601被render科學記號導致Python int()失敗；loader/migration/build Job名可帶有限attempt suffix，以新Job重試已terminal failure，不刪PVC或既有release。StageB真首次失敗需在驗證報告保留，不冒稱一次成功。

## Root 實際部署紀錄（2026-11-14 14:02 Taipei）

- Stage B：固定 runtime SHA `a4134b550a5ed1339af8b0c110c4a1677e90b39a2ec042cc918bbd9a07f0f353`，201895601 bytes。首次 Job 因 Helm 將 bytes 渲染為科學記號而失敗；Sol 修正 int64 字串格式並增加 attempt，retry2 完成 SHA 校驗與 atomic release 安裝。GitOps commits `0c17eb4`、`16b40bb`；revision2/3。短命單檔 HTTP server 已停止，32539 無 listener。
- Stage C：commit `9d124c0`、revision4，migration Job `uptime-migrate-a4134b550a5e-1` Succeeded；Node24.22.0／Prisma6.19.1 實際 native SELECT1 成功，13 migrations 全部套用。完整安全日誌見 `.data/validation-logs/deploy-stage-c-verification.json`。
- Stage D：commit `072cabe`、revision5，2 API＋2 worker＋fixture＋PostgreSQL 六個 Pod 曾全部 Ready。bootstrap200，重複setup400，runtime API200且4個instance皆running。5個paused monitors ID1–5、status page1，由本次專屬credentials/ownership記錄管理；沒有4,000 monitors。runtime證據 `.data/validation-logs/deploy-stage-d-runtime.json`。
- 所有 Pod 仍位於唯一 lab node testing-machine；不宣稱實際跨node容錯。API Pod IP記錄 `.data/validation-logs/cluster-api-endpoints.json`。
- 13:52起主機資源壓力：RAM約60/63.7Gi、swap8Gi全滿，14:00 load197，RKE2一直activating，NodePort拒絕連線。僅唯讀查看發現兩個其他 tts-service Claude scratchpad 的 Next process 合計約35Gi RSS；沒有停止／更改他人process。額外build／Kaniko暫緩。5-demo跨Pod smoke在第一個login前fetch失敗，尚未resume任何monitor；`.data/validation-logs/cluster-five-demo-smoke.json` 為失敗證據，不算PASS。待恢復補驗。
- 網域 `uptime.226network.com` 首次frp_upsert_proxy立即被拒：MCP角色mcp_agent缺settings:write，沒有任何DNS／FRP改動。已向使用者說明並等待正常平台授權；不換工具繞過。`uptime.markkulab.net` 同樣尚未綁定。兩網域需各自既有憑證路由，不能共用單一不匹配憑證。
- MCP profile頁14:02因瀏覽器呼叫timeout，未取得修復後截圖；不宣稱UI已驗。Sol小型API測試已PASS，但root browser驗收仍待補。

## 🔵 16:30 每 revision 的 multi-node 分散補充

受影響檔案：`deploy/k8s/overlays/multi-node/kustomization.yaml`、`deploy/helm/uptime-api/templates/application.yaml`；文件 `docs/KUBERNETES_DEPLOYMENT.md`、`docs/validation/astra-review-16.md`。僅部署模板，不修改或重包已凍結產品runtime。

strict hostname constraints加`matchLabelKeys: [pod-template-hash]`，保留每角色selector、`maxSkew: 1`、`minDomains: 2`、`DoNotSchedule`；Helm僅在`application.strictNodeSpread=true`分支加入，不改單node artifact demo的ScheduleAnyway模式。目的為每個ReplicaSet revision各自分散，避免舊、新Pods合計skew在rollout刪舊Pod後留下兩新副本同node。保留maxSurge1/maxUnavailable0與每角色PDB1；不得為滿足render刪除strict條件。

驗收：Kustomize及Helm image strict兩個render均成功，解析API與worker都具有matchLabelKeys與正確selector；image模式無application PVC或內建PG。artifact demo非strict不含matchLabelKeys/minDomains，不影響現有部署。Kubernetes需支援該欄位（1.27起beta預設啟用，部署說明採1.30以上）；真多node rollout後每角色nodeName確認仍列未執行，不能將render當實測。
