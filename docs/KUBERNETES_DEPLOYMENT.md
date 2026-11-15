# Kubernetes 多節點部署與升級

本平台的正式多節點路徑是 immutable application image＋共享外部 PostgreSQL16。兩 API Pods 處理 REST/WebSocket，兩 worker Pods 執行 PG leases/fencing/outbox；worker 身分每 process 重新生成，不按 NODE_ID 分片。application Pods 不掛單節點 artifact PVC。具體檔案與兩種 Helm 模式見 [deploy/README](../deploy/README.md)。

本任務部署變更由 root 透過 v-terminal GitOps；本文件的 render 指令只產生 YAML，不修改 cluster。沒有測試過的 image／node 故障不可標成成功，最新證據見 [索引](validation/EVIDENCE_INDEX.md)。使用者已取消4000容量驗證。

## 部署前固定輸入

1. 選至少兩個有 `kubernetes.io/hostname` label 的可排程 worker nodes；確認CPU／RAM／storage／DB連線餘裕。兩 API＋兩worker約38條配置連線上限，另留migration／管理餘裕。這是連線配置，不是吞吐保證。
2. 建置 canonical `Dockerfile`，記 source＋lock identity、image digest，透過自己的授權 registry 流程提供各 node 可拉取的 image。未知registry credentials不讀取／借用。完整建置與實跑分開驗證；本輪 no-push build 的方案見 [image build verification](IMAGE_BUILD_VERIFICATION_PLAN.md)。
3. 使用可從各 node 連線的外部 PostgreSQL；正式 HA／備份／restore由部署者提供。本repo的 demo單副本 local-path PG 不會自動變成HA。
4. 私下建立同 namespace `uptime-api-secret`，鍵為 `DATABASE_URL`、`NUXT_SESSION_PASSWORD`、`APP_ENCRYPTION_KEY`，所有 process 使用同一組；保留 encryption key 與DB備份。`secret.yaml.example`只有不可用placeholder，不能原樣套用。
5. 改 `uptime-config-configmap.yaml` 的 `NUXT_PUBLIC_APP_URL`／`APP_ALLOWED_ORIGINS` 為自己的完整 origins，移除task demo hostname/IP。配置 API／worker數、pool／concurrency／deadline；retention預設關閉刪除，先驗聚合與備份再開。清理舊metadata不等於允許刪正式資料。

## 一次 migration，再啟動 replicas

先建立 namespace／Secret／DB連線，**不先啟動 Deployments**。由 `deploy/k8s/base/migration-job.yaml.example` 產生唯一 revision Job，換成同 revision immutable image、合法小寫revision name；以 `node scripts/migrate.mjs` 執行。Job Complete、exit0與實際 migrations記錄均確認才繼續。失败停止 rollout，不能用 db push、忽略exitcode或在每個replica重新初始化。`scripts/check-runtime.mjs` 可在同image與Secret下作真engine／SELECT1檢查。

fresh DB使用完整版本化migration；legacy無migration表時會核對核心schema／關聯，未知或不完整資料拒絕並提供診斷。不要為繞過preflight刪表或重建正式DB。

canonical base的kustomization刻意不自動包含Secret／migration Job，因為「同一批apply所有資源」不保證migration先完成。使用自己的GitOps階段／release gate將其明確分開。

## API／worker rollout

在自有overlay中用Kustomize `images`替換 `uptime-api:replace-with-immutable-image`，將API與worker都指向同一驗證digest；不要只改migration image。覆寫namespace／public config為本次部署，保持Secret reference一致。

```sh
# 靜態render；不修改cluster
kubectl kustomize deploy/k8s/base
kubectl kustomize deploy/k8s/overlays/multi-node
```

base為單節點開發也可用的preferred分散。multi-node overlay對API和worker各自套 hostname maxSkew1/minDomains2/DoNotSchedule；少於兩個eligible domains時不保證所有replicas可排程，須先修節點條件而非改成寬鬆後宣稱已跨node。記錄實際Pod nodeName，不能只看replicas2。

rollout使用maxUnavailable0/maxSurge1、每角色PDB minAvailable1、45秒termination grace。PDB約束Eviction API的自願中斷，不阻止node故障，也不取代Deployment的rollingUpdate設定（[官方說明](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)）。API／worker non-root、read-only rootfs、只給/tmp emptyDir、無service-account token或host runtime掛載。live只驗process；ready驗DB／security/bootstrap/runtime。worker端只保留probes，不作公開管理入口。

base只提供API ClusterIP Service。由自己的ingress／LB轉到ready API endpoints，支援WebSocket upgrade、關閉WebSocket polling依賴；不指向worker。跨API state由PG LISTEN＋bounded resync，不需sticky HTTP polling。公開入口亦需自己的多node冗餘；只綁單node IP的FRP NodePort不是入口HA。

## 發布前小量功能驗收

先在私人入口完成admin setup，確認再次setup拒絕，再發布DNS。用少量task-owned HTTP fixture驗session／API key、workspace/environment隔離、monitor CRUD／斷言試跑、maintenance窗口、Bruno preview/import預設paused；保留viewer與foreign-ID拒絕測試。

確認兩API都能收到同一accepted state、不同environment不洩漏、viewer撤權不再收事件。對owned worker Pod做停止／替補，確認lease到期後接手、舊fence不寫結果；外部HTTP可能重送，不宣稱exactly-once。對API/worker各rollout，ready／grace／socket reconnect正常。只在另有授權的隔離多node環境測node loss/drain；不得對共用lab node自行做破壞測試。

HTTP、keyword、JSON query是目前scheduled adapters，push走同一state/outbox交易；其餘legacy協定、HTTP proxy／NTLM／mTLS與SMTP email明確不支援，見 [runtime](CLUSTER_RUNTIME.md) 與 [Bruno matrix](BRUNO_COMPATIBILITY.md)。不要用保存舊設定成功當執行支援。

## 本次 demo 路徑與限制

`uptime-api-demo-20261114` 使用本次專屬PG PVC與官方Node24 base＋verified SHA artifact PVC。分A DB/Secret、B loader、C migration、D兩API＋兩worker；[GitOps方案](GITOPS_DEMO_DEPLOYMENT_PLAN.md)列實際gate。loader完成後停止短命server，app/migration只讀fixed releases/SHA；重建Pod不得重新依賴下載server。

local-path RWO限定同node，本次只有一Ready node，所以只能報多Pod協調與重建；不能報跨nodeplacement／nodefailover／PG HA。正式多node使用image模式且外部PG。demo NodePort32480與兩域名的FRP入口同樣具有單node依賴。

保留5筆明確demo及persistent namespace/PVC；若原4000 owned fixture仍在，只按ownership／精確IDs pause/fence、等inflight、刪除並記真實數量。不要因負載取消刪demo資料或以「已刪4000」代替實際盤點。profile或其他source修復不會更新已載入舊SHA，需新artifact與對應migration/runtime gate。

## 升級／回復

備份DB與encryption key → 停止舊無fence scheduler → migrate → 新API/worker rollout → readiness／scope／小量check驗證。相容版本可按GitOps回上一image，但DB migration與raw retention不可由換image撤銷；未測restore就明說。workspace隔離／密文schema不允許直接回舊版對外服務。保留資料、使用相容修復／前滾，必要還原備份時承認備份後資料需處理，不自動drop新tables或解密回明文。

## Image-mode Helm 的 release 輸入

使用image模式時，仍須提供chart沿用命名的release欄位：`migration.artifactSha`、`application.artifactSha`、`application.migratedSha`。在此模式它們是image release identity，不是PVC路徑。建議使用immutable image digest去掉`sha256:`前綴的64hex字串；image欄位則保留完整`registry/repository@sha256:...`。不要只設`application.mode=image`就跳過migration gate。

先設`postgres.enabled=false`、`artifact.enabled=false`、`artifact.load.enabled=false`、`fixture.enabled=false`、`application.mode=image`、`application.image=<digest ref>`、`application.enabled=false`、`migration.enabled=true`與`migration.artifactSha=<release identity>`，並預先提供外部PG的existingSecret。migration Job Complete後，才設`application.enabled=true`、`application.artifactSha=<同identity>`與`application.migratedSha=<已確認identity>`，開`application.strictNodeSpread=true`。這個migratedSha是操作者確認值，chart不會替操作者查Job是否完成；不得事先填好後將所有階段一次發布。

`minDomains`在Kubernetes1.30後不依賴舊feature gate；本部署以1.30以上且支援`matchLabelKeys`的版本為前提（lab1.33）。每次rollout仍需讀取兩API與兩worker各自nodeName，確認真正跨hostname；靜態render不證明placement。每revision的spread與限制見 [最終manifest審查](validation/astra-review-16.md)。
