# Astra review14：cluster regression 失敗分類

2026-11-14，Astra 唯讀 source/log；另以 ephemeral loopback Socket.IO server 作最小測試，無共用 app／DB／build／部署修改。Sol 負責測試修正。此文不宣稱修後整套已通過。

來源 `.data/validation-logs/deployment-cluster-regression.log`：18 tests，16 pass、1 fail、1 cancelled。API-only／兩 API state、push fanout、readiness blackhole 通過；LISTEN case 達30秒deadline；remote pause/edit case 在 draining 最後斷言失敗。原 full-suite HTTP515問題另見 `deployment-full-integration.log`。

## LISTEN／撤權 timeout

Sol 定位原 fixture subscribeCurrent() 對剛撤權但 client connected snapshot 尚未更新的 viewer 發出 subscribe，server authorization 會 disconnect 而不回 ACK；原 Promise 僅在 ACK callback resolve，沒有截止時間，因此 test 整體30秒timeout，不代表 LISTEN reconnect 自己等30秒。

Astra 用同 repo 安裝版本獨立重現：loopback port0 Socket.IO server 收到 subscribe_monitors 直接 disconnect、不 ACK。對兩個全新 client 分別執行原 emit 與 timeout(2000).emit，2.2秒觀察：

```json
[{"timed":false,"settled":false,"connected":false},{"timed":true,"settled":true,"connected":false}]
```

這證實 callback Promise 機制；沒有在原失敗 process 注入逐 await trace，故不虛稱直接追蹤到原行。修法為 bounded ACK await，仍保留 owner 兩 API 收新 state、foreign environment 零 delivery、撤權 viewer 零新事件且斷線的全部原斷言。須重跑該 case 才能宣稱 reconnect／revocation 通過。

## Remote pause/edit 的 false !== true

完整 stack 指向 cluster-socket.integration.test.ts 原 line90，`findFirst({where:{role:'worker'}})` 後比較 draining。此 case 自己先新增 offlineId 的 stale worker row（draining 預設 false）；無排序的 findFirst 未指定剛 SIGTERM 的真 worker，至少有兩個合格 rows。這是測試識別歧義，不能從該斷言推出 runtime drain 失敗。

正確修法在首輪取得真 worker instanceId，SIGTERM/exit 後用 findUnique 檢查同一 row 的 draining=true；不放寬為任一 worker draining，也不刪掉斷言。pause 中真HTTP關閉、zero heartbeat、新設定生效、scope／diagnostics 等前面斷言在此失敗前均已走過。修後仍需重跑。

## 500 monitors／HTTP515

原 full-suite stack 指 scheduler.integration.test.ts line176:57，為第二個 hits===500 斷言；前面的 heartbeat.count()===500 已過。因此已知是515次外部 HTTP、不是515次 accepted heartbeat。最新 regression 此 slice 記錄 requests500、HTTP/TCP峰值8、944claims／444deferrals、14.76秒，slice pass。

外部 I/O 至少一次、lease recovery 可重送的產品契約允許 hits≥accepted runs；保留 heartbeat500／state500、run唯一性與真連線上限斷言是合理的。但舊失敗未保存 per-request monitor/run/fence、leaseLost/stale counters，**尚未證明多出15次實際由 lease recovery 造成**。新測試可加這些去秘密診斷，若再多發就核對真因；不得只改 hits>=500 後回頭寫「已證皆為 fixture／正常 reclaim」。使用者已取消4000容量測試，此500是既有 bounded correctness slice，不新增更大 benchmark。

## 結論與下一 gate

目前有兩個具體 fixture 修法、一個未確診的歷史 HTTP重送觀察；沒有足夠證據把所有失敗一概歸為 stale fixtures。root 先等待修後 cluster 小套件通過，才凍結 runtime artifact；最終 full regression 另記 actual counts、artifact身份與 retained log。失敗歷史保留，不與成功重跑混為一次全套結果。
