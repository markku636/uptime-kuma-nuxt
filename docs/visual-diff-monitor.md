# 網頁跑版監控（visual-diff）使用說明

SealWatch 的 `visual-diff` monitor 會定期用 Chromium 開啟目標頁，檢查有沒有跑版。它結合兩層判定：

1. **版面規則**：HTTP 狀態、水平溢出、必要元素是否存在／可見／夠大、破圖、JS 例外。
2. **截圖比對**：每個 viewport 與基準圖做像素差異；可遮蔽動態區塊。

## 建立監控

1. 新增監控 → Monitor Type 選 **視覺跑版 (Visual Diff)** → 填 URL。
   - 第一期只支援公開頁，或既有 basic auth／自訂 headers 可存取的頁面；需要登入（cookie/session）的頁面不適用。
2. 在「視覺跑版設定」填：

| 欄位 | 建議 | 說明 |
| --- | --- | --- |
| Viewports | desktop 1440×900、mobile 375×812 | 至少 1、最多 4 個；label 不可重複。跑版常只發生在某一個寬度。 |
| 必要元素 selector | `#hero`、`main` 等 | 元素消失／隱藏／尺寸太小會被判為跑版。 |
| 忽略區塊 selectors | `.timestamp, #ad` | 動態內容會造成誤報，建議先遮蔽。 |
| 水平溢出容許 | 2px | 比這個值更寬就報跑版。 |
| 差異比例閾值 | 0.02（2%） | 0–1；先從嚴（誤報多），上線觀察後再放寬。 |
| 差異像素上限 | 留空 | 可選的絕對值閾值；任一超標即報。 |
| 基準策略 | manual | manual：設定變更後要手動接受新基準；auto：自動更新失效基準。 |
| 擷取整頁 | 視需求 | **若頁面高度會變動（懶載入、無限捲動），建議關閉**，否則每次都會因尺寸不符而報跑版。 |

3. 第一次檢查只建立基準，狀態是正常（訊息會寫「已建立基準（待人工確認）」）。worker 會在每個 interval 繼續比對。

## 看結果與接受基準

監控詳情頁最上方會有「視覺跑版」區塊，每個 viewport 顯示：

- 狀態、差異百分比與像素數、版面規則摘要（HTTP／溢出／破圖／JS 錯誤）。
- 基準圖、本次截圖、差異圖（三張並排）。
- **接受為新基準** 按鈕：當你確認改版是預期的，按下去把本次截圖變成新基準；之後就不會再報同一個差異。

若修改了 monitor 設定（例如換 selector 或改 viewport），`configVersion` 會增加，舊基準會標為「基準已失效」，manual 策略下 checker 會回 DOWN 直到你接受新基準。

## 上線注意事項

- worker 的認領 SQL、runtime queue、序列化與 backup 都已包含 `visual-diff`，所以 monitor 會真的被排程。
- checker 用 bounded worker DB pool；中斷（lease 過期／deadline）會直接關掉瀏覽器頁面，不會佔住 slot。
- 執行環境需要 Chromium；Dockerfile runtime stage 已安裝，本機開発可用系統 Chrome（`channel: 'chrome'`）。
- 差異結果依 `keepDataPeriodDays` 保留；基準本身不刪。
- 試跑（trial）API 尚不支援 `visual-diff`，請直接建立 monitor 观察第一次檢查。
