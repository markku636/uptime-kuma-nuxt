# Astra review13：artifact／多節點部署與 REST scope

日期：2026-11-14，13:29 台北使用者 scope 修訂後。只讀產品 source、寫文件；未 build、未重啟、未修改 app DB／cluster、未讀秘密、未 commit/push。Sol 仍為唯一產品實作者。

## 範圍與結果

取消 4000 active／capacity benchmark。保留其他產品功能、5 demos 與雙網域交付；若有 owned fixture 則精確清除，不新建大批測試。已更新 [總 Plan](../API_PLATFORM_PLAN.md)、[phase6](../specs/2026-11-14-k8s-scale-validation.md)、[REST/UI](../specs/2026-11-14-rest-maintenance-ui-delivery.md)、[GitOps gates](../GITOPS_DEMO_DEPLOYMENT_PLAN.md)。最終證據狀態見 [索引](EVIDENCE_INDEX.md)。

| 先前 finding | 本輪 source 覆核 | 狀態 |
| --- | --- | --- |
| source provenance 僅 git diff，漏 untracked code/migrations | package-runtime-artifact.mjs 改以 tracked＋untracked file contents 的 workingTreeSha256，另留 commit/diff/lock identity；archive SHA 覆蓋實際 bundle | 主問題已修；仍須 stable build 停止變動後再打包 |
| staging 以容器 PID 命名，killed Pod 後 retry PID1 撞殘留目錄 | load-artifact.py 使用 uuid.uuid4() attempt 目錄，verify SHA/bytes 後才解包與同 PVC rename，finally 只刪 own staging | 主問題已修；未在本輪跑 crash Job |
| local-path RWO 被當作多 node 路徑 | Helm application.mode=image 移除 app/migration artifact PVC；artifact＋strictNodeSpread 明確拒絕，demo 保持單 node；新文件定義 canonical image＋外部 PG | source/static 通過，真正跨 node 未執行 |

artifact allowlist 不包含 .env／DBdump／logs；文件要求 manifest 與 archive identity 記錄，不將 base commit 冒稱完整 dirty tree。仍須 root 在傳輸前核對打包內容、Stage B Job 完成與 marker；source 閱讀不是已產生安全 artifact 的證據。

## 實際靜態驗證

`helm lint deploy/helm/uptime-api` 通過（icon 建議不影響結果）。`helm template` 設 image mode、dummy immutable image identity、strictNodeSpread、application/migration enabled、postgres disabled，再以 Python yaml.safe_load_all 解析輸出：

- API／worker 都沒有 persistentVolumeClaim volume。
- 兩角色分別用自己的 labelSelector；hostname topology spread maxSkew1／minDomains2／DoNotSchedule。
- migration Job 沒有 artifact PVC；app rollout 為 maxUnavailable0/maxSurge1。
- 這只是 chart render，不是 apiserver validation、image build 或容器 runtime／多 node scheduling 實測。沒有操作既有 cluster。

Stage C/D templates 已出現，讀到 migration 使用 same release identity、獨立 Job；app role 分離、shared Secret、live/ready probes、45秒 termination grace 與API-only NodePort。`require('@prisma/client')` 本身不能證明 native engine 真載入，須用 migration 執行與實際 SELECT1／ready/check 作 Stage C/D gate。selected artifact base 改為固定 Node24 bookworm；仍須實跑，不因 full/slim 名稱推論相容。

本機 engine 依賴 libssl.so.3/libcrypto.so.3 的 ldd 結果只證明本機二進位需求。Prisma [系統需求](https://www.prisma.io/docs/orm/v6/reference/system-requirements)要求系統 OpenSSL 等依賴；canonical Dockerfile 需明確提供，artifact base 需實際驗證。單 node RWO demo、單 replica local-path PG、指向單 node 的 FRP 入口均不構成整體 node HA。[PV 語意](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)、[topology spread](https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/)。

## Maintenance／metrics source 覆核

`resource-crud.ts` 的 env-bound API key 用 existing relations 全在 key environment 且 statusPages none 作 list/get filter；write 先鎖 maintenance row、重新查同 scope，之後驗 proposed monitor/status-page IDs 與 fencing 同 transaction。不能先移除 foreign-env relation 再洗白。空關聯 draft 不代表所有 monitors，workspace-wide key／session 保留跨 env 原契約。此次 source 未見新的確切 P1；真 HTTP lifecycle 負例由 Sol 最終 suite 驗證。

`/api/metrics` 限 platform admin，`/api/v1/metrics` 使用 workspace/environment principal；共用 fixed-dimensional aggregate 只查 current state，無 URL／秘密 labels，沒有 per-monitor history N+1。此次只讀確認，不等同 endpoint integration 已通過。

## 下一個最小執行順序

B：stable bundle＋SHA/bytes／UUID loader atomic install → 停 artifact server。C：同 image／UID 真 engine＋DB/migration，驗 schema 與 admin setup closed。D：兩 API／兩 worker Ready、少量受控 checks／socket fanout／Pod loss 與 rolling restart、5 demos。最後雙 host HTTPS／REST／WebSocket與 current tree regression。正式跨 node 設定可交付；lab 只有一 node，cross-node placement／node failure 明列未執行。
