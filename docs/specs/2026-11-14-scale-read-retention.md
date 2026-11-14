# Spec：4,000 API 的分頁讀取、狀態聚合與資料保留

狀態：🔵 待實作。日期：2026-11-14。Astra 規劃／審查，單一 Sol 實作。接續 phase4 lease/outbox/state；phase6 另做 K8s 與完整負載驗收。

## 分段與既有問題

5A 先完成 bounded API/UI/pickers/socket current state、共用 SQL uptime；5B 完成小時彙總與驗證後的 retention；5C 調整 busy-origin claim/defer 成本並給量測。每段保持可建置與獨立測試，不得先刪 raw 再補 rollup。

現有 `/api/v1/monitors` 回全部 monitor，每筆 include 50 heartbeats；dashboard、monitor index、store、維護與 status page pickers 都依賴全量回應。單純加 take=200 會令第 201 筆以後「消失」。history 用 offset+全 count，private uptime 一年資料全部載入 JS 且一天／週／月／年各掃一次。public heartbeat 的 row_number 雖只回 50 筆，內層仍掃所有歷史。socket 全 scope 訂閱又會每秒掃全 environment states。以上皆需一起調整契約與 consumers。

## 5A：列表、選擇器與目前狀態

### API 契約

`GET /api/v1/monitors` 增 `limit`（預設 100、最大 200）、opaque `cursor`、有限 `search`（≤200 chars）、`status`、`type`、必要 `tagId`；全部嚴格 schema 驗證。回 `{ok,data,page:{nextCursor,hasMore,limit},summary?}`，沒有未設上限的「all」。預設穩定 `id ASC` 或 `(weight,id)` 複合順序；實作選定後寫文件。變更排序／filter 必須重設 cursor，不把目前頁當完整集合。

cursor 至少綁 workspace/environment、sort/filter、版本與位置，採 HMAC 或等價 server 驗證；解碼長度有限，跨 scope／換 filter／竄改／不合法 ID 明確 400/409，不能退回全量。所有 cursor 值仍是查詢參數，不能拼接 SQL。查詢 scope 始終取已驗證 principal。新增／刪除資料時不因 offset 位移重複；可變排序欄或 status 在翻頁間改變，定義「重新整理從第一頁重新評估」，不宣稱任意並發修改下固定快照。

列表只讀 metadata、tags、MonitorState 與必要短 history bars，不能 hydrate 敏感設定或 include 全 raw models。UI 如保留 20 格 heartbeat bar，可用「可見這頁 ≤100 IDs」的 batch recent-history endpoint 一次取得每 ID ≤20 筆；預設 list 不附每個 monitor 50 筆。列表狀態來自 state，無 state=unknown/pending；paused 優先於舊 UP/DOWN，stale 與真的 DOWN 分開。配置詳情保留原 safe editor DTO，初始 history ≤50，更多由 cursor endpoint 載入。

新增 `GET /api/v1/monitors/summary`（或同等明確 endpoint）以 SQL group/aggregate 取得**整個目前 workspace/environment** 的 total/up/down/pending/maintenance/paused/stale counts；可選 filterSummary 另列。首頁統計不可只數當頁，不對 4,000 monitor N+1 查詢。`count=0`/空資料與無權限必須可區分。

新增 `POST /api/v1/monitors/state` 或 `GET .../state?ids=...` 與 `.../recent-heartbeats`，≤200 IDs；去重後檢核每個 ID 同 workspace/environment，混入外部 ID 整個 404，不以少回一筆暴露存在性。只讀 POST 仍需明確 viewer/read-key policy，不能被通用 POST=editor middleware 誤拒；採 GET 可避免此新增例外。選出的資料必須 bounded，不能無 IDs 預設全scope。

### UI 與 pickers 不丟功能

dashboard 與 monitors index 提供 server-side search/type/status、下一頁／上一頁（client 保存 cursor stack）、總數／當頁數、empty/loading/error。切 filter、scope、搜尋後清上一批資料與訂閱；debounce 搜尋且取消／忽略晚回舊請求。actions、grid/list、重要事件、paused、tags 與權限仍可用。新 monitor 不在目前頁時提供跳轉／重新搜尋，不能假裝已在列表。

store/useMonitors 改為 page cache/明確 selected IDs，不能默默把 page data覆寫成「完整資料庫」。StatusPage MonitorSelector、MaintenanceDialog、MonitorForm parent/group/resource選擇器必須有 server search + load more，已選 IDs 即使不在當頁仍顯示安全名稱、可移除。保存傳完整已選集合；filter／翻頁不把原有 300 個關聯截成眼前 100 個。必要新增 bounded `ids` lookup（批次≤200）載入既有選擇。全選預設「當頁」，若產品提供全搜尋結果選取需明確 server query 範圍／上限與確認數量，不能暗中載入全部至DOM。

important events 獨立 scoped endpoint／bounded query（例如25筆），不是從當頁的20格 bars推導全workspace事件。viewer不見新增／編輯按鈕，API仍獨立守權限。

### Socket 與 StateBridge

dashboard/list只訂閱可見頁 IDs（上限200），detail訂閱單ID。新增batch subscribe/unsubscribe協定或共用現有single協定，但每socket總IDs有上限、packet大小/頻率有界，逐一驗scope，混入非法ID整批拒絕。舊 `subscribe_monitors` 不再由正常UI使用；保留相容時必須明確bounded或回需升級錯誤，不能無限scope訂閱。

StateBridge 只讀 local subscription IDs 分批≤200，不每秒掃所有 workspace的4,000 states。fresh membership批次驗證每批／短TTL失效策略要保留已驗過的idle revoke案例。每socket revision map退出訂閱時清理，重新訂閱應可取得當前快照。heartbeatId/revision以十進位字串跨JSON，前端用BigInt比大小，不用Number損失精度；snapshot晚回不得覆蓋較新socket資料。

MonitorState 成為自足安全投影，至少能輸出目前 status/time/ping/code/revision，必要 assertion summary；不把「raw heartbeatId仍存在」當發送當前狀態的必要條件。現有 clear-heartbeats 只delete raw、留下指向已刪heartbeat的state，bridge會無法送出；本輪修此契約，retention亦不應破壞目前狀態。

## History 與 public status

`GET /monitors/:id/heartbeats` 用 `(time DESC,id DESC)` cursor，limit預設50/max200，初次回固定上界以避免新插入心跳推擠翻頁；相同time以id解歧義。`from/to` 有界、history清除／retention後cursor失效或回空的語意明確。取消每頁全表 count，必要 total 用獨立cached/summary。舊 offset 僅可短相容且上限小、回deprecated資訊；不得繼續支援 offset100000 作主要讀取。

multi-monitor recent bars 用單次 SQL `LATERAL (... ORDER BY time DESC,id DESC LIMIT n)` 或等價 indexed top-N per monitor；不要對所有 raw rows做window再取n，也不要 JS Promise.all 每ID一查詢。索引 `(monitor_id,time DESC,id DESC)` 配合 scope驗證。

public status 保留published/sendUrl/secret白名單，page monitors與heartbeat IDs一起分頁，不因超過200靜默截斷。public请求只允許該status page關聯IDs；不能用「此monitor也在某公開頁」越過目前page。UPTIME badges與public頁共用下述聚合，不各寫一套計算。未發布頁與私有workspace隔離回歸保留。

## Uptime 的統一語意

採時間加權，與既有public頁的意圖一致；private舊calculator把`hb.duration`（距上一筆時間）記到當前status會顛倒轉移時間，禁止拿它直接累加做rollup。

- 一筆heartbeat從其time起代表狀態，覆蓋至下一筆time／查詢end／可確認的freshness deadline三者最早者；查詢以半開區間 `[start,end)` 裁切，讀入start前最後一筆作邊界anchor。相同time按id決定後者狀態，零長度片段不重算。
- 長缺口不能讓最後UP無限延續。新增／保存可重現的coverage上限（例如當時monitor interval的2倍，且可設定明確上限），不能用「現在改過的interval」重算多年歷史。現有legacy沒有當時interval的部分使用文件化fallback並標記estimated；新樣本保存所需欄位或在commit時計算可用片段。
- statuses 0/1形成 downtime/up time；pending、maintenance及無樣本／stale缺口分別計數、排除可用率分母，不算UP。paused期間不能被舊UP延伸覆蓋；pause/resume配置事件需切斷coverage，或採足夠明確的state/history標記。
- `uptime=100*upMs/(upMs+downMs)`，分母0為`null`（UI N/A），不能0%或100%假裝有觀測。回up/down/unknown/maintenance/observed/window duration、coverage比例、samples與safe ping aggregates；整體uptime用總時間加權，不平均各monitor百分比。
- ping平均用`sum/count`，包含合法0ms，只取UP樣本；min/max沒有有效樣本=null。跨bucket不能平均各bucket avg。每天圖表以UTC bucket保存，顯示可轉使用者timezone，不能用本機日界混合server UTC。
- 當前24h/7d/30d/1y、daily history、dashboard、public/badge都用同一service。period只查所需窗口；不要一律parallel掃四次全年。短bar不拿來推導24h uptime。

5A可先用bounded SQL聚合而不將raw搬進JS，5B再替換內部來源為rollups+raw邊界；對外語意維持一致。API相容欄位若改為nullable，更新types/UI/tests，不以0隱藏無資料。

## 5B：小時 rollup 與 retention

新增 `HeartbeatHourly`（實際table可`heartbeat_hourly`）unique `(monitorId,bucketStart)`，含scope composite FK、up/down/unknown/maintenance duration、sample counts、pingSum/pingCount/min/max、必要first/last anchor資料與計算版本。若另加daily表，daily由hourly合併且不平均比例，首輪不是必需。

只封閉已完成的小時桶（可留5分鐘watermark）；每批有限monitor/bucket，使用advisory lease/DB鎖讓多worker不重複處理，upsert可重跑且同結果，checkpoint和該批rollup同transaction。過去桶重建不得將同一樣本重算成增量兩次。新commit不接受client指定過去time；若有migration/direct backfill的late samples，必須使相關bucket/checkpoint失效重建，不能忽略。

查詢完整封閉小時取rollup，左右不足一小時與尚未sealed區域取raw+anchor；切分互斥，不能rollup/raw雙算或缺邊界。raw刪除前只剩hourly而查詢非整點舊區間時，回明確hourly精度／對齊range，不能假裝精確還原桶內秒數。checkpoint落後時query不得偷偷少算已刪raw。

預設建議raw7天、hourly400天；這只是可調產品預設，不是磁碟保證。4,000 APIs@60秒=每日576萬筆，報告需量實際row/index bytes，不能忽略約4,032萬筆/7天raw容量。可先預設更短raw（例如48小時）並清楚UI/history說明；最終選值及需求空間由驗證報告記錄。

retention只有在該monitor必要時間桶已成功seal並核對checkpoint後，才可刪除cutoff以前raw；保留仍用於下一桶的前置anchor或將anchor安全存於checkpoint。每次DELETE有限批（例如1000），有限每輪時間／rows；使用time index，不一次全表delete。多workercleanup以PG鎖競爭，讓API/lease工作不被長鎖阻塞。failed rollup時零提前刪除；retention log只記counts/cutoffs。

歷史清除行為明確：「刪除歷史與彙總，保留目前operational state」，state可自足回傳且revision不倒退；清除與rollup競爭需monitor鎖或history generation/checkpoint失效機制，不能刪完後舊batch重新寫回舊統計。大scope清除採bounded批次/maintenance job並回進度，不啟無限巨大transaction。此是使用者明確按清除的操作，不由migration自動清空。

通知outbox retention也必須保留TLS去重語意。目前TLS dedupeKey在outbox，90天後刪除會讓仍在同certificate/threshold內的監測重新發信；不能把「清歷史」等同「忘記已通知」。可獨立小型dedupe ledger或按certificate有效期限／新certificate替換安全清理，測365天threshold與90天cleanup。普通已送status events保留可短，pending/processing不可當completed刪除。

## 5C：busy-origin 成本與公平

phase4的500個200ms同origin兩worker smoke：實際TCP max8，但defer約3645次；有界並發正確，重複claim→decrypt→env query→defer仍浪費DB。新增可量的claimed/completed/deferred、每個成功run的DB操作數、origin cache命中率、等待時間及不同origin公平性。

採有上限/TTL的origin hint/cooldown、按目前可用origin容量調claim，或等價設計，避免每poll重試同一批飽和origin。hint不得儲存raw secret URL/hostname到公開DB/metrics；如持久化key用不可逆opaque值並綁config/env version。hint只作效能，不是權限／lease權威；env/URL/config變更後失效或短TTL內恢復，新origin不被舊cooldown長期餓死。釋放slot仍以實際I/O停止為準，不在記憶體建立4,000個隱藏Promise queue。

比較相同fixture/hardware/worker options前後，至少把deferred/completed顯著降低（目標≤2，無法達到需記瓶頸及實數），throughput/lag不變差。另測1個慢origin+多個快origin、4000不同path同origin、不同workspace公平；不得為降低defer而讓一個慢origin卡整批。per-origin限制是每process或全cluster須明列，不能拿單process數字當全cluster保證。

## DB 與回復

| 物件 | 變更 | 回復與安全 |
| --- | --- | --- |
| heartbeats | `(monitor_id,time DESC,id DESC)`、retention time index；必要coverage/interval snapshot | expand/backfill；legacy估計明列；raw刪除只能備份恢復 |
| monitor_states | 自足safe summary、必要freshness/coverage欄位 | raw刪除不使current state失效；revision單調 |
| heartbeat_hourly | scope FK、monitor+bucket unique、time index | 可由保留raw重建；raw已刪後保留此表，不能以rollback drop |
| rollup checkpoints/job state | per-monitor watermark/anchor/generation，或等價模型 | 同批rollup原子提交；清history防舊job回填 |
| optional origin hints | opaque key/version/due，不存raw URL | 可清cache，不能影響fence correctness |
| notification dedupe | 若與outbox分離則保留semantic key | outbox cleanup不可重啟TLS舊通知 |

遷移先expand→真PG fixture→backfill可重跑→對照raw聚合→啟用rollup reader→最後才開retention。預設migration不得立即刪使用者歷史；以明確設定啟用並記cutoff。部署回復保留rollup/raw/checkpoints，先停cleanup再回前一相容版本。

## 受影響檔案

- `server/api/v1/monitors/index.get.ts`、`[id].get.ts`、`[id]/heartbeats.get.ts`、`[id]/uptime.get.ts`；新增 `summary.get.ts`、`state.get.ts`、`recent-heartbeats.get.ts`、`events.get.ts`（實際同責任路徑可同步文件調整）。
- 新增 `server/utils/pagination.ts`、`server/utils/monitor-query.ts`；`server/utils/serialize.ts`、`public-status.ts`、`request-session.ts`／`workspace.ts`（僅必要read policy）；`server/api/v1/status-pages/[slug]/monitors.get.ts`、兩種 status-page heartbeat alias、public/badge APIs。
- `server/services/uptime/calculator.ts`；新增 `server/services/uptime/rollup.ts`、`retention.ts`、`queries.ts`；`server/services/monitor/commit-result.ts`、`cleanup.ts`、`runtime.ts`、`worker.ts`、`leases.ts`、`runtime-config.ts`、`server/utils/monitor-mutation.ts`、`server/api/v1/maintenance/clear-heartbeats.post.ts`。
- `server/services/events/state-bridge.ts`、`server/services/socket.ts`；socket client plugin/composable；`stores/monitor.ts`、`composables/useMonitors.ts`、`useUptime.ts`、`usePublicStatusPage.ts`、必要新增page/state composable。
- `pages/dashboard/index.vue`、`pages/monitors/index.vue`、`pages/monitors/[id]/index.vue`；`components/monitor/{MonitorList,MonitorListFilter,MonitorListItem,MonitorCard,MonitorForm,MonitorSummary,MonitorGroupList,VirtualMonitorList,HeartbeatBar,UptimeChart,UptimeHistory,PingChart}.vue`（僅實際consumer）。
- `components/dashboard/MonitorListPanel.vue`、`MonitorListItemSimple.vue`；`components/status-page/MonitorSelector.vue`、`StatusPageForm.vue`；`components/maintenance/MaintenanceDialog.vue`、`MaintenanceList.vue`；public status page/grid/pagination實際consumer、`components/status/MonitorCard.vue`。
- `types/monitor.ts`、`types/heartbeat.ts`、`shared/types/**`；`prisma/schema.prisma`、新增 `prisma/migrations/20261114050000_read_rollups/migration.sql`（拆migration先同步實際名）。
- `.env.example`、新增 `scripts/benchmark-read-paths.ts` 或 `.mjs`、`scripts/benchmark-origin-pressure.ts`；必要npm scripts。
- 新增 `tests/pagination.test.ts`、`tests/read-paths.integration.test.ts`、`tests/rollup.integration.test.ts`、`tests/retention.integration.test.ts`、`tests/scale-browser.integration.test.ts`；既有 workspace/auth/public/socket/runtime tests必要回歸。
- 新增 `docs/validation/scale-read-retention.md`、benchmark JSON evidence、`docs/DATA_RETENTION.md`；更新API文件／總計畫，明列分頁相容性與uptime無觀測語意。

## 驗收與量測

- [ ] 真PG至少4,000 monitors、兩workspace/兩env、同time history資料；list≤limit、cursor完整遍歷不缺/重、filter跨頁、cursor跨scope/竄改拒絕、權限無退化。
- [ ] dashboard全scope統計與頁資料分離；search可找到第3,999筆；status-page／maintenance picker能選第201筆之外，保存原有大集合不丟項；viewer UI+API矩陣。
- [ ] 查詢次數有上限，不隨頁monitor數做JS N+1；list payload與DOM節點bounded，histories不include全量；至少4,000 monitors × 1,440 heartbeat（576萬rows）或合理分階段真資料量，報告不得將小fixture計畫推論當大型實測。
- [ ] EXPLAIN(ANALYZE,BUFFERS) list/recent LATERAL/history cursor/summary/rollup/retention，記actual rows/buffers/時間；不能只貼索引存在。
- [ ] uptime：UP→DOWN方向、窗口前anchor、同timestamp、多次pause/resume、maintenance/pending、長gap、0ms ping、無資料null、UTC跨日、interval修改、raw/rollup接縫均手算fixture對照。
- [ ] rollup重跑不倍增、兩worker搶同batch、checkpoint crash rollback、late data處理、先aggregate再delete、缺rollup不刪raw、history clear與rollup競爭、current state於raw刪除後可送socket。
- [ ] socket只訂當頁：翻頁/切scope清理、最多200IDs、惡意/外部ID拒、晚snapshot不覆蓋新revision、LISTEN斷線resync、idle revoke繼續有效。
- [ ] retention小批不長時間阻塞lease/API；TLS dedupe超90天仍有效；pendingoutbox不誤刪。無MCP則報告明列未經MCP。
- [ ] 在指定本機fixture量read API p50/p95、RSS、event-loop lag、DBpool wait、socket掃描rows/sec，目標單頁p95<500ms；busy-origin前後同條件比較。4,000 active監測完整steady10分鐘及K8s故障驗收屬phase6，未完成前不可宣稱。

5A 實際拆分：新增 `server/api/v1/monitors/lookup.get.ts`（GET ids≤200）、`composables/useMonitorPage.ts`、`composables/useMonitorPicker.ts`、`components/monitor/MonitorPagination.vue`。列表排序id ASC，cursor綁完整scope/filter；list僅一筆current-state相容heartbeat，不是raw history；bars另batch。

實際額外consumer修正：`pages/status-pages/[id]/edit.vue`、`pages/maintenance/[id]/edit.vue` 直接使用共用遠端 MonitorSelector，避免原有錯誤response envelope與全量USelectMenu。
