# Astra 第三輪審查

日期：2026-11-14。範圍：phase2 requestSecrets、monitor input、trial、CRUD DTO；只改文件與Spec，未改產品程式。

## 獨立驗證

執行`tsx --test tests/assertions.test.ts tests/http-request.test.ts tests/monitor-secrets.test.ts tests/variables.test.ts tests/auth.test.ts`：所選5個檔案14/14通過。含前輪cross-origin redirect、header stripping與HEAD303回歸。Sol的21/21 production/PG/socket結果本輪未獨立重跑，不能混為同一份驗證。

## 可重現發現

### 1. clear/replace的試跑與保存語意不同

`monitorSecretUpdate`先clear後套updates；`[id]/test.post.ts`先套updates後clear。同一payload `headers={X-Test:new}, clearSecrets=[headers]`，Astra直接呼叫helper與試跑路徑合併邏輯，得到保存headers=new、試跑headers=null。這會使預覽與實際執行不同。要求共用merge policy或共同schema拒絕同欄衝突，並加入回歸。

### 2. dockerHost仍可洩漏URL帳密

`sensitiveMonitorFields`未包含dockerHost，而checker接受HTTPS/TCP URL。Astra以`https://user:REVIEW_DOCKER_SECRET@internal.example`建立helper fixture，經sealMonitor與monitorEditorDTO後，該字串仍同時出現在DB寫入物件與DTO。要求納入封存／遮罩或拒userinfo；擴充backfill須覆蓋已sealed但仍帶新增欄位明文的rows。

此外POST有numeric dockerHost同workspace驗證，PUT未做相同驗證；應補一致關聯負例。既有checker目前把numeric dockerHost當invalid format，因此本輪不把它誇大為已證實的外部資源存取，但API隔離契約仍缺口。

### 3. 背景排程未等待security bootstrap

`00-auth-security.ts`透過request hook等待backfill/API key upgrade，但`00-database.ts`獨立初始化scheduler，沒有await同一ready。security bootstrap失敗時HTTP可能503，背景checks仍已開始。要求共用初始化順序，並以失敗fixture確認zero outbound checks；此項為讀碼發現，本輪沒有啟停production重現。

## UI／相容性註記

MonitorForm仍提供NTLM/mTLS/proxy等設定，但新HTTPexecutor會回CONFIG_ERROR。首版可明確不支援，但應在表單／API validation告知，不能保存後才顯示泛用失敗。此項已直接通知Sol，實際功能修復由Sol處理。

以上三項及驗收已補`docs/specs/2026-11-14-api-assertions.md`並直接交Sol；待修正後再結案。

後續狀態：Sol 回報三項已修、request update/trial 共用 merge、dockerHost 擴充 backfill 覆蓋已 sealed rows，並將共用 securityReady 接到 `00-auth-ready` middleware（Nitro request hook 的 throw 不足以當 gate）。Sol 回報 phase2 production integration 最終 30/30、unit 15/15，包含 Chrome 表單與 bootstrap failure zero outbound；見 [phase2 驗證](api-assertions.md)。Astra 本輪未獨立重跑該完整 production suite，故此處標記為「已修，具 Sol 測試證據」，不把它寫成 Astra 獨立全數覆核。
