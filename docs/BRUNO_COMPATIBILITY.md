# Bruno declarative subset

使用官方 `@usebruno/lang@0.41.0`，不執行 Bruno runner、CLI、JavaScript 或外部檔案。接受帶相對路徑的 .bru manifest，UI 可選 collection directory 或本平台匯出的 manifest JSON；不是 ZIP/OpenCollection YAML importer。

| 功能 | 本輪行為 |
| --- | --- |
| HTTP | GET/HEAD/POST/PUT/PATCH/DELETE/OPTIONS；每個 request 僅一個 HTTP block |
| headers/query | enabled entries；同層重複拒絕；內層覆蓋外層；query 以 URLSearchParams 正確編碼 |
| body | raw JSON/text/none；JSON 在靜態展開後驗證 |
| auth | none/inherit/basic/bearer；request > folder > collection；明確none不啟用閒置credentials |
| variables | request > inner folder > source/target environment > collection；disabled忽略；循環/缺值拒絕 |
| secrets | source env secret placeholders需填值或重用target；owner才可改target；secret依賴不能降成普通variables |
| target values | 既有target值與顯式secret輸入是opaque literal，內含`{{...}}`不會再次當程式或變數解析 |
| assertions | res.status/res.responseTime/res.text/res.body property/index/res.headers property；eq/ne/neq/gt/gte/lt/lte/contains/notContains/exists/notExists/isNull/isNotNull；expected用JSON literal |
| scripts/tests | 全部拒絕，包含空block；不會執行 |
| unsupported | settings/app、response vars、extends、typed annotations、path params、OAuth/digest/NTLM/mTLS、multipart/files/XML/GraphQL/gRPC/WebSocket、自訂methods/未知semantic欄位 |
| metadata | docs可忽略；bruno.json僅name/version/type/ignore，其他行為設定拒絕 |
| limits | 4000 requests/4500 files/20MiB source/128KiB每檔；10秒parse budget，檔間yield，最多2份解析且同user1份 |

preview不寫DB、不發網路、不回URL/headers/body/secret值；只顯示mapping、method、rule數及明確errors。commit重解析原檔，HMAC綁user/workspace/environment、manifest、environment狀態與source monitor configVersion，鎖列重查後原子寫入。create拒已存在identity；skip保留原項目；replace只改同source identity並暫停。source identity包含workspace、target environment、collectionId、source environment與path；不以顯示名稱覆寫。

source environment變更與監測寫入同一transaction。Monitor request配置與secret vars均AES-GCM；owner session才能改target environment，editor可重用已配置的target值。所有匯入監測預設paused，沒有匯入即執行或自動外部請求。

匯出限owner、最多20 monitors與200 secret placeholders。僅支援能表示成該子集的HTTP設定；timeout必須30秒、redirect10、TLS verify開啟、無proxy/upsideDown；any多rule、多個legacy status ranges等拒絕。URL/body/auth/query與header values用secret placeholders，原值不下載；header名稱及assertion定義會包含。原先被basic auth覆蓋的Authorization header不另匯出。schedule/通知/tag等association不在.bru表示範圍。匯出manifest需重新填secret值才能匯入；不是保密備份還原格式。

錯誤只回path/field/safe code，官方parser可能附原行的exception不出API與log。單次超過budget回明確錯誤；4000筆本機fixture匯入已另記錄實測，不代表任意複雜度輸入皆在10秒完成。
