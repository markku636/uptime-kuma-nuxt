# 持久 demo：v-terminal GitOps 與 SHA artifact 部署順序

日期：2026-11-14。狀態：🔵 分階段執行；a4134b 的 A–D 已由 root 執行，16:16重啟後smoke成功；新profile revision仍待獨立驗證。Astra只寫文件；Sol維護產品與canonical Kustomize／Docker；root透過v-terminal MCP執行本次task-owned Helm部署。此方案補充 [phase6](specs/2026-11-14-k8s-scale-validation.md)，不新增第二名產品實作者。

## 決策與邊界

採一個新namespace、一個無外部chart dependency的Helm chart，四次明確GitOps同步：**DB/Secret → artifact PVC載入 → migration Job → 2 API＋2 worker**。最終API NodePort固定32480，root確認未占用後才建立；正式FRP只把兩網域導向`192.168.50.57:32480`。RKE2目標是**lab cluster**，prod frpc是入口，兩者不可混為Helm `environment=prod`。

建議命名`namespace=uptime-api-demo-20261114`、`release=uptime-api`、deploy repo路徑`uptime-api-demo-20261114/uptime-api`。root先唯讀確認未存在，必要改唯一suffix；後續每次操作固定同一identity，不碰既有namespace/releases。此namespace是**持久demo**，負載測試另用owned DB/workspace或短命namespace，不在結束時整個刪除demo。

官方Node24 image＋本次immutable artifact的路徑，是本次 **K8s artifact runtime驗證**；不冒稱target Dockerfile產出的image已跑。官方base記錄完整tag及實際imageID digest、CPU架構；禁止latest，`IfNotPresent`。canonical Dockerfile/Compose/Kustomize仍由Sol完成且另列驗證狀態。

## 已查核的 v-terminal 流程

依控制台 [Helm GitOps規則](/home/mark/projects/vibe-coding-terminal/.claude/skills/helm-gitops-deploy.md)、[資源歸屬](/home/mark/projects/vibe-coding-terminal/.claude/skills/cluster-resources-layout.md)及[Secret單一來源規則](/home/mark/projects/vibe-coding-terminal/.claude/skills/secrets-must-be-version-controlled.md)，cluster修改不直跑kubectl/helm，不直接寫managed deploy repo。

已唯讀核對`src/server/mcp/tools.ts`：`deploy_write_chart_file`只能改**既有**chart；首次建立使用`deploy_write_files`，支援`scope: repo-root`寫cluster-resources。每次順序為：

1. `deploy_write_files`建立／更新本次chart及本次新Secret宣告。
2. `deploy_commit_push`明確傳`paths`，只含本次chart與本次namespace Secret路徑，不能省略paths把其他session變更推走。
3. `deploy_sync_release`傳固定`name/namespace/chartPath/environment: lab`。
4. `deploy_sync_status`以jobId查結果；再由K8s唯讀工具查實際Pod／Job條件、事件及有限logs。**同步成功不等於migration或載入Job Complete**，各關卡獨立驗證。

首次同步會先apply該namespace的cluster-resources secrets；不用raw k8s_apply。文件中較舊的「必須靜態PV／先手動apply」段落已被同檔2026-05-09校正及現場local-path證據取代。本次用現有`local-path` dynamic provisioning，不手建hostPath PV、不改StorageClass。

未建立任何新Secret值；root建立時先確認deploy repo是既有受控**私有**來源。只產生本次新DB/session/encryption secrets，不讀、列印、借用既有Secret。application Secret放`cluster-resources/secrets/lab/<ns>/uptime-api-secret.yaml`，DB Secret可同層`uptime-api-db-secret.yaml`（本次選集中管理，避免chart與cluster-resources雙重owner）。Secret值不進公開target repo、報告或log；root可經安全API腳本在記憶體產生並送入MCP後僅輸出filePath/bytes。

## 最小 chart 結構與 values

```text
<namespace>/uptime-api/
  Chart.yaml
  values.yaml
  values-lab.yaml
  templates/
    configmap.yaml
    postgres.yaml
    postgres-service.yaml
    artifact-pvc.yaml
    artifact-load-job.yaml
    migrate-job.yaml
    api.yaml
    worker.yaml
    api-service.yaml
    pdb.yaml
cluster-resources/secrets/lab/<namespace>/
  uptime-api-secret.yaml
  uptime-api-db-secret.yaml
```

Chart本身不宣告整個Namespace為可刪release子物件；由平台sync建立namespace。所有資源有task/owner/用途labels。不要加入Ingress、registry、FRP憑證、cluster RBAC或hostruntime掛載。

values至少有`postgres.enabled`、`artifact.enabled`、`artifact.load.enabled`、`artifact.sha256`、`artifact.sizeBytes`、`artifact.sourceUrl`、`migration.enabled`、`migration.artifactSha`、`application.enabled`、`application.artifactSha`、`application.migratedSha`、`api.replicas=2`、`worker.replicas=2`、`service.nodePort=32480`及existingSecret names。application啟用時template須要求artifactSha與migratedSha一致；這是操作gate，不取代查DB migration完成狀態。

所有values預設不啟用app／migration／loader，postgres stage先開始。只有本次明確要上線的artifact SHA才出現在application Pod template，改SHA自然rollout。不要用`current` symlink偷偷替換正在執行的程式碼。

## Stage A：DB、Secret與持久化

建立PostgreSQL16單replica StatefulSet＋ClusterIP service，DB PVC先建並由PG Pod消費，`storageClassName: local-path`、RWO，建議demo起始10Gi（以實際容量可調），非正式4,000長期保存容量承諾。使用task-owned新DB帳密，DB不暴露NodePort；API連同一namespace的PG Service DNS。

StatefulSet PVC保留策略採Retain（本cluster支援時明設，否則保留預設且不刪PVC），chart既有PVC宣告不得在切stage時消失。不要從chart升級或cleanup推導需要drop DB。PG的UID/fsGroup與官方image一致，artifact UID是另一個1000，不能混用造成權限錯誤。

此階段**不先建立沒有consumer的artifact PVC**。local-path可能採WaitForFirstConsumer；若建立artifact PVC但等下一階段才有Job，Helm wait可能一直等Bound而卡住。下一階段把artifact PVC與loader Job同次建立。驗收DB Pod Ready、PVC Bound、Secret引用存在（只驗metadata/引用，不輸出值），應用replicas仍0／未渲染。

## Stage B：一次性載入 artifact 到 PVC

root在Sol完成stable build後取得固定輸入，不與正在改動的`.output`同時打包。記錄source commit／dirty diff hash、package-lock hash、Node/OS/arch、build時間、archive SHA256與bytes；有dirty tree須明示，不能只標base SHA冒稱整個artifact對應該commit。

最小可行bundle包括`.output/`、`prisma/`、`scripts/migrate.mjs`、其必要`node_modules`及package metadata。當下讀到`.output`約66MiB、root node_modules約812MiB，僅為當時快照；若沒把migration CLI傳遞依賴做成可靠小bundle，可先完整帶已鎖版node_modules，避免新Job臨時npm install。DB migration與runtime必須使用同一bundle版號。`.output`含合法相對symlink，不能粗暴拒絕全部symlink，也不能跟隨link打包到workspace外。

打包採明確allowlist，排除`.env*`、`.git`、logs、screenshots、測試DB、cache與本機keys；掃描編譯產物是否意外嵌入部署秘密。archive內路徑必須relative，拒絕`..`逃逸、absolute path、device files與解析後離開release根目錄的symlink/hardlink；不要直接extract未核對的任意tar。

root 可在本機 build/test process 啟動 **60–300 秒有硬性期限的唯讀單檔 artifact server**，不以可用的 v-terminal Terminal／SSH 連線作前置條件。它只讀本任務已完成且固定 SHA 的無秘密 bundle，僅提供該檔案的 GET／HEAD；不接受寫入、命令或任意路徑、不列目錄、不提供工作樹其他檔案。綁定本次 loader 可達的 private LAN 位址與未占用 port，不掛 FRP／公開網域。用可追蹤的本機前景 process／exec session 執行，設硬 timeout、finally 關閉 active sockets／server；不建立 systemd、長期 daemon、開機啟動或自動重啟。Root 啟動前應先完成可用的 chart／loader 準備，避免 TTL 消耗在其他部署等待。

此為本次規則適用範圍的判斷，而非修改控制台規則：[`dogfood-via-v-terminal.md`](/home/mark/projects/vibe-coding-terminal/.claude/rules/dogfood-via-v-terminal.md) 的 Terminal 列禁止的是「在 Claude Code 自己的 Bash 跑長期 daemon、production 操作」，例外明列「本地 build / type-check / test」為「開發者本機工具，不涉及 production 資源」。這個有界 process 只提供本機 build 產物，沒有直接修改 cluster／deploy repo／registry／DB／Auth；真正將產物寫入 task-owned PVC 的 loader、其 chart／Job 與後續 migration／rollout 仍全部由 v-terminal MCP GitOps 管理。不能用此解釋擴張為直接 kubectl cp/apply、SSH、registry push 或修改平台認證。

Root 已確認本機 Ubuntu 沒有可用的 SSH connection，MCP `ssh_run_script` 不能當 local Terminal；`/ws` 亦明確拒絕該 E2E identity。不要為了傳單一 build artifact 改權限、繞過拒絕或擴充控制台。若有正常可用的等價平台 artifact API 可優先採用，但本機有界 server 本身不要求先修復 Terminal 權限。

傳輸不需要既有 registry 憑證；private HTTP 的內容仍須以 GitOps 中固定 SHA256＋bytes 核對，不能信任 response header 的 hash。TTL 到期即停止；若 loader 尚未成功，只對同一固定 artifact 經明確重試再開一個有界 session，不能移除期限變成永久服務。完成 marker／SHA 驗證後立即停止，並沿下述流程驗證 migration／首次啟動／重啟均不再需要 server。

同次GitOps同步建立artifact PVC（建議5Gi起，容納本版＋上一版＋staging）、loader Job。Job使用官方Node24／具備tar的相容base，runAsUser/fsGroup1000，無privileged；mount PVC writable。下載到`/artifacts/.staging/<sha>-<attempt>/bundle.tgz`，限制connect/total timeout、bytes及磁碟需求，驗完整SHA後extract於同filesystem staging。完成必要檔案／Node啟動依賴檢查後，以atomic rename落到`/artifacts/releases/<sha>`，最後寫`.complete`含sha/manifest。遇到同sha已complete先驗manifest再成功退出，不能覆寫既有release。

loader Job使用`backoffLimit:1`／`activeDeadlineSeconds:300`，name含sha短碼避免Job spec不可變問題；完整SHA仍在values/annotation/目錄使用。失敗只清該attempt staging，保留舊release。不要先刪PVC重來。

**驗收loader Complete與release marker後，立即停止短命artifact server**，下一階段應不再需要它。Job chart設`artifact.load.enabled=false`後sync可刪已完成loader物件，artifact PVC本身保持enabled。artifact download URL可從最終values清除；最終Pod不得有fetch URL／下載initContainer。

## Stage C：只從 PVC 執行 migration

獨立normal Job（非複雜pre-install Helm hook），name含本次migration artifact SHA，mount已完成release readOnly，workingDir是精確release目錄，以`node scripts/migrate.mjs`執行。從本次Secret注入DATABASE_URL，完整Prisma CLI依賴已在artifact，不能啟動時網路npm install。

前置輕量檢查`.complete`與值中的SHA一致；沒有artifact或不完整立即fail，**不能回頭下載**。等DBReady後有界重試連線，migration內已有PG advisory lock；Job設300秒硬上限與有限重試，無app Pod同時開新scheduler。root查JobComplete及migration結果（不印DBURL），再記錄`application.migratedSha=<sha>`。失敗保持app關閉／舊版運行，修chart/程式產出新SHA，不能忽略migration error啟動。

此Job完成後可由chart關閉清除其物件；保留不含secret的Job結果／migration版本記錄。不得把Job TTL刪除與manifest仍enabled混用而在每次sync意外重跑；最終values明確migration.enabled=false。

## Stage D：2 API、2 worker、NodePort與發布

application.enabled=true，兩Deployment共用精確`releases/<sha>` readOnly subPath mount；application start只驗local marker後`exec node .output/server/index.mjs`，無artifact server依賴。APP_ROLE分別api／worker，只有API Service對外NodePort32480，worker只有probes；sharedsession/encryption/DATABASE_URL從Secret注入。

按phase6設定resources、non-root UID1000、readOnlyRootFilesystem、dropALL、tmp emptyDir、ready/live/startup與40秒以上grace。PVC RWO能在**同node**掛給多Pod，但不是多node RWX；本次單node local-path會把artifact使用者約束在該node，這是已知範圍，不宣稱node HA。DB和artifact PVC均需保留。

先用private NodePort安全完成admin setup，確認再setup拒絕；再測兩API sockets/fanout、worker分工、可取消check與readiness。新demo保留5個示例且依賴已停止fixture者paused。只在以上完成後由root以既有production FRP MCP新增**本次兩個proxy**，指向該NodePort，附兩host的TLS/DNS；不啟動舊lab frpc、不動其他proxies。

`uptime.226network.com`與`uptime.markkulab.net`各自驗HTTPS、cookie登入、scoped REST、Socket heartbeat及logout。server明確允許這兩origin，client連頁面當前origin；其他Origin handshake拒絕。報告記實際artifact hash/PGschema版本，不輸出admin/session/encryption值。

## 必做的「不依賴短命server」驗收

1. loader完成後先停止server，再執行migration與app首次啟動；兩者必須成功。
2. 經v-terminal GitOps只更新Pod template的restarts驗證annotation，滾動重建API與worker，保持相同artifactSha，所有新PodReady、會讀local PVC artifact。不是只重啟尚保有process記憶體的容器。
3. 以同一PVC讀取marker與必要entry hash；Job/service不再存在下載依賴。可額外驗所選node已有base image cache，報告不將registry離線保證延伸到未測的新node。
4. 讀DB demo monitors仍5筆、資料與密文可讀，跨Podsocket仍有效。此時才可將artifact server臨時檔及失敗staging清除。

PVC丟失／node磁碟壞不屬此restart保證；保留一份相同hash bundle於task artifact備份位置與private chart manifest，未驗備份還原就明示。不能把持久PVC等同備份。

## 更新、回復與清理

新版本重做Stage B/C，舊app仍用舊sha。只有新artifact完整、migration成功且相容後，才改application.artifactSha並rollout。current與previous兩個release目錄至少保留；migration可能改DB，回退artifact不代表DB可回退，需依phase6相容性流程／備份，禁止自動drop新tables。

清理Job也是chart定義、由root MCP同步，參數是明確允許刪除的staging／unusedSHA，保護current/previous，拒絕空值或整個`/artifacts`路徑。5Gi空間不足先停更新並量測，不能自動刪正在用的版本。

13:29 使用者已取消 4000 負載驗證；若先前仍存在本次 fixture，按 owned workspace/IDs pause→等inflight→精確delete，保存aggregate報告；**不卸載本demo Helm release，不刪namespace/PVC/Secrets，不移除兩個公開網域proxy**。與artifact staging不同，最終測試站是使用者要求保留的交付物。

## 根據本次分工的檔案／操作範圍

Astra本輪只新增本文件、在phase6 Spec加連結。root會以MCP寫上述task-owned chart及本namespace Secret宣告，實際namespace確認後在驗證報告記完整路徑；不直接改v-terminal程式碼或其managed repo。Sol若實作可重用artifact打包／驗證腳本，可新增target repo `scripts/package-runtime-artifact.mjs`、`scripts/verify-runtime-artifact.mjs`，先按phase6受影響檔案補列；secret與短命server生命週期由root操作，不交給第二個產品agent。

## 參考依據

[Kubernetes Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)說明RWO是單node讀寫，並不限制同node僅一Pod；[StorageClasses](https://kubernetes.io/docs/concepts/storage/storage-classes/)說明WaitForFirstConsumer延後binding。故本方案把artifact PVC與loader同次建立，並明示single-node artifact限制。

控制台規則與MCP工具參數以本輪唯讀原始碼為據；沒有執行chart write、commit/push、sync、下載server、Secret或cluster修改。本方案實施後仍需 phase6 小量多 Pod 與雙網域證據；不再執行 4000 負載，不能用規劃文件替代。

## 13:29 範圍修訂與 Stage B/C/D 執行閘門

使用者改以 K8s 多節點支援為重點，取消 4000 API 負載／容量驗證。此 demo 的 local-path RWO artifact 與 PG 仍是**單節點驗證**；正式多節點需 canonical immutable application image（不掛 artifact PVC）與外部 PG，詳細 topology 契約見 phase6 Spec。RWO 允許同一 node 多 Pod 掛載，不能提供跨 node artifact。只有真正跨 node RWX 的 existingClaim 可作可選替代；本期不新增 shared storage 系統。[Kubernetes PV 說明](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)

| 關卡 | 必須確認 | 不得宣稱 |
| --- | --- | --- |
| B 載入 | stable build 不再被修改；manifest 含 tracked＋untracked source 雜湊、lock hash、Node/OS/arch；archive allowlist 無 secrets；loader 驗 SHA/bytes 後原子 rename；staging 使用 UUID 避免 killed Pod PID 重複；Job Complete 與 `.complete` 一致 | 只有 Helm sync success 就算 artifact 完成 |
| C migration | 先停止短命 artifact server；同選定 base/UID/read-only 條件下 engine 可載、真 PG SELECT1、migrate 成功；查實際 schema migration rows，再標 migratedSha；初始化 admin 並驗 setup 已關閉 | Node 內建 OpenSSL 代表有系統 libssl；DB migration Job 建立即成功 |
| D app | 固定 releases/SHA read-only；兩 API／兩 worker Ready，只有 API NodePort32480；roles/socket/fanout/小量 check 成功；server 已停仍可 rolling 重建新 Pod；5 demos 保留 | 單節點多 Pod 是 node HA；artifact runtime 等於 canonical Dockerfile image 已實跑 |

本機 Prisma engine 經 ldd 顯示依賴 libssl.so.3／libcrypto.so.3；這只證明該二進位的需求，不證明尚未實跑的 Node24 slim 缺少或具備它們。Stage C 必須真執行；若失敗，由 Sol 修 canonical image 的系統依賴或選已驗證的固定官方 base，不能在 Pod 啟動時 apt/npm 安裝漂移。[Prisma 6 系統需求](https://www.prisma.io/docs/orm/v6/reference/system-requirements)

Stage C/D 的 chart templates 仍由 Sol 完成，root 只執行 MCP GitOps。不要為進度而略過 failed Job 或在 API entrypoint 自動 migration。任何新 image／artifact 更換都重新記 identity；Stage A 的 PG image digest 不能當應用 image 證據。雙網域發布前要先完成 setup closed；final 明列入口仍依單 node FRP target、PG 單副本的限制。

## 16:17 實際結果入口

目前操作結果以 [K8s report](validation/k8s.md) 與 [domain report](validation/domain-delivery.md) 為準。本文四關是流程契約，不代表新profile/manual/OpenAPI修復已在舊a4134b內。雙網域因MCP缺settings:write被拒，等待正常平台授權，不能以其他工具繞過。4000容量驗證已取消，僅保留5 demos與既有歷史證據。
