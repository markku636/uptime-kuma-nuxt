# Astra 第八輪：真 TCP 黑洞、控制 client 與交付證據

日期：2026-11-14。Astra 僅唯讀產品程式與獨立 SELECT 測試，修改本報告／規劃文件；產品修改仍由單一 Sol 執行。沒有停止共用 DB、操作既有 K8s namespace、commit 或 push。

## 已獨立重現的可靠性問題

`/tmp/uptime-runtime-drain-raw.log` 在4秒觀察時 drainPhase=registry，15.998秒仍未結束。當時 registry 已使用 workerPrisma，問題不是先前 general-client 旁路，而是 native connector 的 timeout 覆蓋不足。

Astra 使用本機 PostgreSQL 的唯讀 SELECT、單連線pool、socket_timeout3，透過獨立 TCP proxy 正常完成認證後停止雙向傳輸：

| 情境 | 觀察 | 證據 |
| --- | --- | --- |
| native6.19.1，重用已準備 SQL | 3003ms，P2010，query真正settle | `/tmp/astra-native-timeout-audit.log` |
| native6.19.1，全新 SQL | 8003ms仍pending，真destroy sockets後才settle | 同上 |
| 實際BoundedPgClient+adapter6.19.1，全新 SQL | 3013ms，CONTROL_QUERY_TIMEOUT，真正settle | `/tmp/astra-adapter-timeout-audit.log` |

[官方engine原始碼](https://github.com/prisma/prisma-engines/blob/6.19.0/quaint/src/connector/postgres/native/mod.rs#L607) 的statement prepare await在perform_io timeout外，支持上述原因。先前單純配置native URL timeout不足；新adapter持有真socket並destroy有必要。此重現只用SELECT，沒有對共用表新增／刪除資料。

## 立即交 Sol 的 P1：初始啟動無法自行恢復

新adapter實際拋 `PrismaClientKnownRequestError`、`code=CONTROL_QUERY_TIMEOUT`、沒有meta。審查時 `server/utils/database-errors.ts` 僅收native P1xxx/P2010SQLSTATE；`initializeRuntime`首次registry黑洞因此不排retry，ready永久false。已同步root/Sol，要求明確辨識已知transport transient（含真測碼），維持auth/schema/cipher fail-closed，新增初始registry失敗→網路恢復→自動ready的process測試。不要只測已成功啟動後的heartbeat恢復。

`BoundedPgClient`目前query promise/callback路徑在真正settle才清timer，timeout直接destroy自身stream；adapter使用的promise形態有覆蓋。transaction、pool飽和、TLS/schema選項、初次connect及正常idle後重用仍需在最終suite保留，不因三項黑洞過關就宣稱所有回歸完成。

## 驗證來源與限制

- Astra本輪獨立重現如上；未重跑完整production suite或K8s部署。
- Sol提供 `/tmp/uptime-control-adapter-blackhole.log`：3/3，HTTP914ms abort，maintenance真正query及relinquish6250ms結束，runtime drain在4秒觀察時complete，測試共4.215秒。這是Sol測試證據，非Astra獨立整套驗收。
- Root獨立unit31/31：`/tmp/uptime-root-unit-audit.log`；migration5/5：`/tmp/uptime-root-migration-audit.log`。
- Root最新typecheck共110診斷（原baseline453）；已識別phase5 WIP dashboard/monitor index及prisma seed新增差異，**不能稱110項全是既有錯誤**，也不能宣稱typecheck通過。
- 先前62/62為較早runtime穩定點，adapter與phase5變更後需新的完整回歸報告。500 smoke、4000 Bruno匯入都不等於4000活躍監測steady負載完成。

## 後續交付邊界

總Plan列表預設已與phase5詳細Spec統一為100（最大200）。phase5需連同UI/pickers/socket、時間加權uptime、rollup/retention一起驗收。

scheduled支援目前為HTTP、keyword、JSON query；push走事件共用commit。其餘legacy協定資料保留但不執行，必須在升級／交付文件明示，phase5/6優先不擴新adapter。

K8s單節點多Pod可驗worker接手、滾動更新與fanout，不能宣稱節點／DB HA。若使用官方Node base加既有artifact，可稱artifact在K8s實跑；Dockerfile build成功、image啟動、K8s artifact部署應各自列證據，不互相替代。
