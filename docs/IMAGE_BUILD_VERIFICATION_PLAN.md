# Canonical Dockerfile 建置驗證：窄範圍執行方案

日期：2026-11-14，Astra 規劃／只讀驗證，Sol 唯一腳本與 chart 實作者，root 透過 v-terminal MCP GitOps 操作。優先完成 demo Stage B；此建置驗證可在其後獨立執行，不阻擋 artifact demo。使用者取消 4000 負載，不新增任何容量 benchmark。

## dependency stage 的實際檢查

現行 Dockerfile dependencies stage 只 COPY package.json/package-lock.json 與 prisma，`npm ci` 觸發 `prisma generate && nuxt prepare`，之後 builder 才 COPY 完整 source。這不構成已確認 bug。

Astra 用獨立 tempfile 放 package/schema、不放 nuxt.config 或 .env、明確移除 DATABASE_URL；使用已安裝依賴（symlink 讀取），只將 Prisma generator output 改為 temp 目錄，避免改共用 generated client。Prisma6.19.1 generate 與 Nuxt prepare 均 exit0，temp finally 已刪除。這證明兩個 postinstall 子步驟在上述最小條件可成功；**不證明 fresh npm ci、Node24 image 或完整 Docker build 通過**。不得因此為 Dockerfile 注入正式 DB／session secrets。

## 先查現有能力的結論

本輪讀控制台 source：`src/app/api/deploy/builds/route.ts` 只有 GET，回傳 provider 最近成功 builds；沒有舊 dogfood 表描述的即時 Kaniko build POST。MCP catalog 未找到可接受本次 dirty-tree context 且 no-push 的 builder。既有 CI setup 是產生 provider build/push pipelines，會牽涉 registry credentials／遠端提交，與本次 secretless no-push 驗證不同。

因此採既有 **deploy_write_chart_file／deploy_commit_push／deploy_sync_release** 管理 task-owned 短命 build Job，仍走 v-terminal GitOps；不直接 kubectl apply，不修改控制台或既有 CI／registry。不使用 setup CI 自動修正器（其規則會移除 no-push）。

## 固定 context 與傳輸

Sol 新增 `scripts/package-build-context.mjs`（若已有等價 allowlist packer 可重用）與 `deploy/helm/uptime-api/templates/build-verification.yaml`／對應 disabled-by-default values，或同一 repo 內獨立 `deploy/helm/uptime-build/{Chart.yaml,values.yaml,templates/job.yaml}`；實作前固定其中一組，不兩套並行。這些檔案屬 [phase6 Spec](specs/2026-11-14-k8s-scale-validation.md) 授權範圍。

context 是這次 fixed source 的 tracked＋untracked allowlist，不是尚未推送的 GitHub HEAD。根檔只含 Dockerfile、.dockerignore、docker-entrypoint.sh、package.json、package-lock.json、nuxt.config.ts、i18n.config.ts、tsconfig.json、app.vue、error.vue；source 目錄含 assets/components/composables/layouts/locales/middleware/pages/plugins/prisma/public/server/shared/stores/types；scripts 只納 Dockerfile 明確 COPY 的 migrate.mjs、check-runtime.mjs、demo-fixture.mjs 及其實際 imports。若發現必要新 config/import，先明確補 allowlist。

排除所有 .env*、.data、.git、node_modules、.nuxt、.output、logs、憑證、DB dumps 與 deploy Secret 宣告；依 `.dockerignore` 再篩選。拒絕特殊檔案與逃出 context 的 symlinks。manifest 記 source revision＋working-tree/content hash、Dockerfile/lock hash、context SHA256/bytes、實際檔名清單（無內容秘密），先固定 source 再打包。

沿已有短命單檔 LAN server 模式傳 context（不同於 runtime bundle）：下載 initContainer 只讀該固定 URL，驗 exact SHA/bytes、safe archive paths 後解包到 emptyDir `/workspace`。server 硬 TTL 60–300秒，下載完成即停止；builder 不依賴它。source 輸送錯誤直接 Job 失敗，不退回 Git clone 或未驗證 context。

## 一次性 Kaniko Job

使用官方 `gcr.io/kaniko-project/executor:v1.23.2-debug`（現場 cached 候選）；部署前 root 以現有 metadata／實際 Pod imageID 取得 digest 並記錄，能預先固定 digest 則用同一官方 digest。不能捏造 digest，也不任意改成 latest。該官方 repo 已封存，本次僅使用固定版本做一次受控驗證，不藉此建立新長期 build 平台。[官方 release](https://github.com/GoogleContainerTools/kaniko/releases/tag/v1.23.2)

root 已確認容器 UID0 可用於此 secretless ephemeral builder；這和 runtime 必須 non-root 是不同角色。Kaniko 不需 privileged／Docker daemon，但本 Dockerfile 的 apt、base unpack 與 chown 需要 container root 與可寫 build rootfs。不得套 runtime 的 runAsNonRoot1000/readOnlyRootFilesystem/dropALL 然後假稱可建置；也不新增 SYS_ADMIN、privileged、hostPath、runtime sockets、hostNetwork 或 hostPID。保持 allowPrivilegeEscalation=false、automountServiceAccountToken=false、無 Secret／registry auth mounts；若 namespace policy 拒絕現有標準容器能力就記 blocked，不放寬 cluster policy。[Kaniko security](https://github.com/GoogleContainerTools/kaniko#security)

Job 建議 backoffLimit0、activeDeadlineSeconds1800，CPU request1/limit2、memory request2Gi/limit6Gi，ephemeral-storage request4Gi/limit16Gi；workspace/result emptyDir 合計預算須在節點磁碟餘裕內，root 先唯讀確認。僅一個 builder，避免與 Sol build 同時搶資源。用本任務專屬 labels/name，僅允許 public base、apt/npm 拉取；無 registry push。

核心參數：

```text
--context=dir:///workspace
--dockerfile=/workspace/Dockerfile
--target=runtime
--destination=uptime-build-only:<source-id>
--no-push
--no-push-cache
--cache=false
--snapshot-mode=full
--tar-path=/result/image.tar
--digest-file=/result/image.digest
```

`--destination` 即使只寫 tar 仍需要；`--no-push` 本身不保證不推 cache，所以加 no-push-cache 且關 cache。不用 insecure／skip-TLS、snapshot-time 或 experimental use-new-run 省略內容。[官方 flags](https://github.com/GoogleContainerTools/kaniko#flag---tar-path)、[no-push-cache](https://github.com/GoogleContainerTools/kaniko#flag---no-push-cache)

## 完成與清理

必須觀察 executor exit0、Job Complete、runtime target 完整結束，取得 image digest、tar bytes/SHA、context身份、base image digest、建置log與時間；可用同Pod bounded wrapper 在成功後輸出純metadata。沒有 registry push，不需要建立／借用 registry Secret。保留去秘密的結果摘要後，由 root MCP 移除本次 build Job／context輸送資源，不動 demo namespace/PVC／artifact releases。若輸出只留 emptyDir，需先存 metadata 再清理；不假稱 tar 仍可下載。

失敗先記實際 npm/apt/native/snapshot 錯誤並交 Sol 修必要 Dockerfile，不對控制台或 node 動手。若時間／policy／registry公開拉取限制使本輪無法完成，交付直接列 Dockerfile actual build 未驗證；保留已通過的本機 build、postinstall 最小測試與獨立 artifact runtime 結果。

**image build 成功不等於該 image 實際服務成功。** 本方案不 push/import，因此 built-image runtime 與跨 node 實跑仍可標 not-run；不能把同 source artifact 在官方 Node base 跑通當成已執行這個 image。正式多 node 部署須用實際可拉取的 canonical image digest＋外部 PG。
