# Astra 第四輪審查

日期：2026-11-14。唯讀審查 Bruno parser/importer/exporter/API/UI、通知 sender 與舊 scheduler；只修改文件，不修改產品程式。shared tree 正由 Sol 持續實作，以下區分初始重現與修後覆核，不代表整個 phase3 已驗收完成。

## 已重現並覆核修正

### 變數優先序

初始 `buildRequest` 把 root collection vars 一起合併到 primary，令 collection 壓過 environment。最小 fixture：collection `shared=collection`、manifest.variables `shared=environment`、header `X-Value: {{shared}}`，初始得到 `x-value=collection` 且 issues 空。修後只把 folder/request 合併 primary；Astra直接呼叫 parser 得到保留 `{{shared}}`、issues 空，符合平台 runtime 解析環境的契約。

### 秘密降級成普通變數

初始 parser 只收到混合 targetValues，已解密 secret `privateToken=REVIEW_SECRET_SENTINEL` 經 manifest.variables `{shared:'{{privateToken}}'}` 變成 `parsed.variables.shared=REVIEW_SECRET_SENTINEL`。owner import 路徑會將它明文寫 environment.variables，而 environment DTO 對 viewer 回傳 variables。此為 write-only secret 契約缺口，並非聲稱 editor 能直接修改環境。

修後 sourceState 將 secret names 傳 parser，resolver 追蹤引用；Astra直接重測 direct reference、兩層 alias、同名降級全部得到 `SECRET_TO_STATIC_VARIABLE`，parsed.variables 不含 sentinel。collection/env 優先序與 secret 回歸已加入 unit。

### 獨立測試證據

在目標 repo 執行 `node --import tsx --test tests/bruno.test.ts`：6/6 通過，包含官方 parser fixture、明確 unsupported blocks、path/cycle/secret、auth inheritance、export reparse、上述優先序與 taint 回歸。另用 stdin module 直接呼叫 parser 驗證四個最小案例。這些測試未寫 DB、未向外部發 HTTP，不能替代 Sol 的 production/PG/browser integration。

## 讀碼發現與後續驗證

### 預覽後手動編輯會被覆蓋

初始 HMAC 只含 brunoSource.updatedAt，手動 monitor PUT 不變更它，舊 replace preview 仍能覆蓋新設定。Sol 已在共同工作樹加入 monitor.configVersion、mutation increment、digest version 與 transaction 內 monitor ordered locks/re-read；Astra讀碼確認機制存在，production 409/rollback 案例由 Sol 的 integration 驗證。沒有獨立對共享 production 做修改。

### 既有 secret 被當作新模板重解讀

直接 parser fixture：request 不使用環境變數，但既有 target secret `literal{{unrelated}}`，仍回 `MISSING_VARIABLE`。平台一般 runtime 原本把變數替換值當 literal，Bruno parser 卻遍歷全部 targetValues 並遞迴；已要求區分 existing target opaque 字串與新匯入 source expressions。此為相容性問題，非資料外洩證據。

### 通知預設 channel 的 workspace 範圍

讀 `server/services/notification/sender.ts` 發現 defaultNotifications 仍按 monitor.userId 選取，未按 workspaceId。同一使用者建立兩 workspace 時，其他 workspace 的 default channel 會被選入通知列表。已直接要求 Sol 修正並用兩個 local mock sinks 驗證；沒有向真實 channel 發信。phase4 outbox Spec 另要求 scope FK/guard、秘密安全訊息與 bounded send。

### UI 目標切換

BrunoImport 的 manifest watcher 未包含 current workspace/environment；舊 digest 在新 scope 應被 API 拒絕，但秘密輸入仍留在畫面。要求切換目標清除 preview/secret/completed，避免使用者將舊秘密重新 preview 到另一環境。

## 尚未宣稱的範圍

本輪沒有重跑完整 production/PG、4,000 檔原子匯入或瀏覽器驗證；未經 MCP 驗證。parser raw scanner 是官方 parser 的補充，未因此宣稱支援完整 Bruno runtime。phase4 已另寫 [分散式排程 Spec](../specs/2026-11-14-distributed-scheduler.md)，本文件不代表 scheduler 已修改或可上多 Pod。
