# API 斷言階段驗證

> 證據時間註記（2026-11-14 13:29 修訂）：以下為該階段當時結果，並非目前整個 working tree 的通過宣告。11:56 主機重啟後早期 `/tmp` logs 已遺失，保留歷史摘要但不可再聲稱原始 logs 可供查閱。最新狀態見 [證據索引](EVIDENCE_INDEX.md)。使用者已取消 4000 活躍負載驗證；既有相關 fixture 數字僅保留歷史意義。

2026-11-14，單一 Sol 實作、Astra 規劃與獨立審查。目標僅本機隔離 PostgreSQL/production build，未改 production。

- Node24.22.0，PostgreSQL16.14，`npm run build`成功，Nitro輸出33.7MB。完整log：`/tmp/uptime-phase2-build.log`。
- assertions/executor/checker/request envelope 單元15/15通過：typed comparisons、missing/null/false/zero、non-eval selector、all/any、fatal invalid JSON、redirect/decompression/timeouts、OAuth、request limits、AAD與preserve/clear。`/tmp/uptime-phase2-unit.log`。
- 最終production真PG、HTTP、Socket與獨立Chrome整合30/30通過：auth7、workspace10、request-secrets/assertions4、migration5、setup/bootstrap3、browser1。`/tmp/uptime-phase2-integration-final.log`。
- Chrome從共用表單新增rule、200但JSON不符時失敗、修正後通過、無效JSON可改回、保存重載write-only URL、只改名稱仍能真HTTP成功；截圖`/tmp/uptime-phase2-assertion-browser.png`。此為Playwright CLI，**未經MCP驗證**。
- `nuxt typecheck`當時記錄 114 筆診斷（未完整分類 baseline 差異，不能全部稱為既有）（含重複client/server檢查），主要為legacy UI colors/nullable props、profile欄位/schema、badge signatures、cluster lastHeartbeat、第三方types、seed workspace。新增phase2 helper/API/AssertionEditor/Results/共用MonitorForm沒有診斷。`/tmp/uptime-phase2-typecheck.log`。不宣稱全案typecheck通過。

## 安全與相容性

URL（含query）、headers、body、basic/OAuth credentials、其他協定request secrets與Docker host封存至AES256GCM，AAD綁workspace/environment/monitor。所有角色detail不下載既有request明文；configured flags、省略保留、clear明確清除，同欄replace與clear時replace優先。clone重新綁AAD並預設paused；push token僅新建/clone的provisioning一次性顯示。backup省略秘密，保留共用assertion AST。

editor是可使用workspace secrets的受信任操作者；可任改目的地意味能透過請求使用秘密。write-only/AES並不構成對此操作者的完整防外洩承諾。

HTTP使用單一deadline與真AbortSignal、1MiB解壓後上限、bounded keepalive池、每次redirect重驗並pin DNS IP。保留授權內網用途，禁止metadata/linklocal；可用HTTP_ALLOW_PRIVATE=false或HTTP_ALLOWED_HOSTS收緊。跨來源PUT/PATCH/DELETE 301/302/307/308拒絕，GET剝除私密headers，303 HEAD保持HEAD。錯誤與逐條結果沒有actual body/token/expected values。

NTLM/mTLS與HTTP proxy transport本輪明確不支援，UI不提供新設定，API明確拒絕；既有設定在執行時CONFIG_ERROR。沒有假裝以direct request忽略proxy。API試跑最多8個全域、每user1個、10/min；不寫history、不發notification。

Nitro2不await async plugins，且request hooks會capture吞掉throw。已用同步production secret validation＋真正`00-auth-ready`middleware阻擋API，共用securityReady讓scheduler等待。獨立DB壞envelope負例實測HTTP503且local fixture零outbound。legacy回填無key不改資料；成功後移除原欄位明文；已sealed但新敏感欄仍有明文也會再封存。需要保存APP_ENCRYPTION_KEY與資料庫備份才能還原。

## 當時尚待後續階段（歷史紀錄）

分散式lease/fencing、pause/edit stale-result防護、4000 monitor批次列表與retention屬phase4/5，這份報告沒有宣稱已完成。全量fresh npm ci將在加入官方Bruno parser後執行，先前僅dry-run成功。表單light模式標題對比與新增rule按鈕padding已在source修正，下一次build一起納入。
