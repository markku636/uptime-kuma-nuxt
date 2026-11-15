# Astra 第九輪：phase5讀取／狀態與新增maintenance交付

日期：2026-11-14。主機重啟後，以repo `977624b`加共享工作樹phase5 WIP為準；舊`/tmp`logs與測試PG已消失，舊68/68只保留為文件中的歷史證據，最終仍須重跑。Astra只審查與修改文件，Sol保持唯一產品實作者。

## 已交 Sol 的 phase5 修正

1. **Socket訂閱非同步競態**：審查時single subscribe在await查DB前檢200上限，既有195IDs同時送20個有效single subscribe可一起通過。batch replacement也可因舊查詢晚回覆蓋最新頁。要求每socket序列化mutation或epoch+commit時重驗上限，並測快速翻頁／unsubscribe與舊pending subscribe競態。這是讀碼finding，Astra未獨立啟動完整socket fixture。
2. **Bruno replace漏pause coverage**：importer傳`{id,interval}`給新fenceMonitorData，缺既有active；active monitor替換成paused時，沒有寫PAUSED邊界，舊UP仍延至coverage deadline。要求從已鎖定真row取active並沿共用pause處理，加入active→replace-paused手算區間測試。
3. **Dashboard stale無法即時恢復**：新UP heartbeat只更新heartbeatsMap，但getMonitorStatus/getStatusText先採fetch時viewStatus=stale，仍顯示STALE直到refresh。需以最新revision/state重新衍生status，並節流刷新全scope summary。不可每heartbeat觸發多次summary查詢。

上述Sol已收到並就地修改中；完成狀態以其後測試報告為準，本報告不將WIP當已通過。

## 讀碼確認的 phase5 方向

- list cursor含scope/filter/sort HMAC，lookup/state/recent IDs有上限且mixed foreign整批拒絕；list採metadata白名單與self-contained state，沒有讀出request secrets。
- history `(time,id)`排序與cursor包含初次上界，recent用indexed LATERAL top-N。新SQL uptime用前置anchor、preceding state、coverage snapshot，ping0納入平均，沒有樣本回null。
- StateBridge不再要求raw heartbeat存在才送snapshot；可由state構造安全heartbeat。仍須完整production測clear raw→socket/current state與跨scope拒絕。
- 已選IDs由分頁picker另外lookup，不能把當頁集合當完整關聯；maintenance workspace跨environment既有關聯的安全名稱與保留需求已納新增Spec。

## 時區疑慮撤回與校正證據

Astra第一次臨時PG fixture誤建`time TIMESTAMP(3)`，觀察到Asia/Taipei與UTC結果不同；該型別**不符合本repo**，此finding已明確撤回並同步root/Sol，沒有要求產品修改。

核對實際baseline `heartbeats.time TIMESTAMPTZ`、schema `@db.Timestamptz`、state migration `checked_at TIMESTAMPTZ(3)`後，Astra在獨立transaction建立同型TEMP table（commit自動刪除），執行真rawUptimeWindows：UP00:00→DOWN00:01、查UTC前60秒。UTC、Asia/Taipei、Asia/Kathmandu三個session均得到uptime100、upMs60000、unknownMs0。未碰產品表或共用設定。monitorStatusSql原疑慮也因checkedAt同為TIMESTAMPTZ撤回。

## 新增需求中的已重現 maintenance 問題

直接import真getMaintenanceStatus，無DB，固定輸入相對於當前UTC時段：

- `dayjs.utc('10:00','HH:mm').isValid()`為false；module只載utc/timezone，未載customParseFormat。當前weekday+當前hour應在timeRange內，實際回scheduled。
- 僅在隔離測試process載customParseFormat後，recurring-interval於指定timeRange開始前6小時仍回under-maintenance，原因是generateCron固定`* * * * *`未用起始HH:mm。
- single沒有start/end仍回under-maintenance，API目前也未按strategy要求日期，可能產生永久維護。

UI亦有可定位的舊契約缺口：maintenance add引用不存在MaintenanceEdit；edit讀寫無handler的單數GET/PUT；Dialog用monitors及array body而API期待monitorIds／JSONstrings，可能忽略關聯或400。現有Swagger仍說Get all monitors／success envelope等舊契約，不能當新REST文件。

修正與驗收已在 [新增REST/maintenance/UI 🔵 Spec](../specs/2026-11-14-rest-maintenance-ui-delivery.md)：沿plural canonical CRUD、純時間計算、策略驗證、固定clock/timezone/boundary tests、真worker maintenance零outbound、API-key/role矩陣、共用表單及OpenAPI同步。

## 交付規劃更新

同份Spec包含desktop/mobile介面、雙HTTPS origin與同host socket、負載後精確清4000留5demo。公開demo使用獨立持久化PVC／保留namespace，發布前關閉初始setup；臨時benchmark cleanup不刪已交付測試站。root負責既有production FRP/DNS/TLS，Astra沒有操作網域或cluster。Phase6 K8s/load Spec仍有效，新增要求不能替代原4000活躍steady／fault／storage證據。
