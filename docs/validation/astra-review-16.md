# Astra review16：canonical image／multi-node交付

2026-11-14，唯讀產品／部署模板；僅文件修改。未build、restart、apply或讀取existing secrets。

## 實際確認

- `kubectl kustomize deploy/k8s/overlays/multi-node`及`helm template` image／strict模式成功，解析rendered YAML確認API/worker各2副本、每角色hostname maxSkew1/minDomains2/DoNotSchedule、PDB minAvailable1、grace45秒、沒有application PVC、沒有內建PG StatefulSet。image用不可拉取的example.invalid placeholder僅render，不宣稱runtime。
- runtime config為lease15秒／renew3秒／drain15秒；PG lease/fence共用DB，process UUID不依賴node編號。API及worker使用同Secret；API有LISTEN/resync，worker角色不公開管理入口。原cluster regression與blackhole結果另有證據，本輪沒有重跑。
- 操作文件已要求共享外部PG、DB連線預算、獨立migration完成後rollout、immutable image、不同nodeName確認、入口冗餘與PG HA前提。Helm image模式沿用artifactSha命名作release identity，已補三個release欄位與分階段輸入，避免image mode因漏填required欄位無法render。
- PDB只限制自願Eviction，不防node outage，也不限制Deployment自己的rolling update；部署的maxUnavailable0/maxSurge1分別處理rollout。[Kubernetes官方](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)

## 窄finding：每revision分散

目前strict spread selector包含新舊ReplicaSet，缺少`matchLabelKeys: [pod-template-hash]`。Topology spread只在排程當下約束skew，後續Deployment刪舊Pod不會自動重新分散；例如兩node舊版各1，兩個新版可先後都在A排程、交錯刪除舊A/舊B，完成後仍可能同node。建議strict分支按pod-template-hash分組，讓新版自己的兩replicas跨node；已交唯一實作者Sol。這是manifest修正，無需重建產品artifact。修復前不能宣稱每次rollout都保證跨node；修復後仍需真nodeName實測，不從render推出完成。[Kubernetes topology官方](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/)

## Kaniko實際結果

直接讀`.data/validation-logs/kaniko-d6-build-result.json`：Job `uptime-build-d6e11a0cc020-1` Succeeded，16:20:44開始、16:24:05完成。log包含production Nuxt build／runtime stage、USER node、no-push，image digest `sha256:bc37be21e220d9d88d6193525ab8fdaca4787fab5b2b63452335b82d2f6bd764`；image.tar353607680bytes、tar SHA256 `d3c9ce82913f3c0427e8168ff6985eb653cf4822a2f669e4d6d75451ba145b5e`。

這是d6 source context的canonical Dockerfile實際build成功，解決「deps postinstall／Prisma／Nuxt prepare能否建置」疑慮；沒有registry push，也沒有從該image啟動runtime。d6不包含其後最新UI修復，不能將它當作最新runtime artifact的image驗證。最終UI又在重建，98eb511c是上一候選並未同步部署，最後SHA由Sol提供後補證據。

## 修後獨立複核

Sol已在canonical multi-node overlay的兩角色、Helm strict分支加入matchLabelKeys。Astra重新實際render三種組合並以YAML assertions確認：Kustomize strict與Helm image strict各兩角色具有pod-template-hash/minDomains2/DoNotSchedule且無PVC；Helm artifact非strict仍ScheduleAnyway且不含matchLabelKeys/minDomains。結果 [astra-multinode-render.json](astra-multinode-render.json)。本finding已修，未發現其餘阻擋canonical多node部署的模板缺口；外部PG／registry／至少兩eligible nodes與實際nodeName驗收仍是部署前提，未宣稱現場跨node已驗。
