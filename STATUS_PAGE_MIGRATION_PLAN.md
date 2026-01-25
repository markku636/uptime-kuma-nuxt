# Public Status Page 編輯功能遷移計劃

## 概述
將舊的 Vue 2 StatusPage.vue (2338 行) 完整遷移到 Nuxt.js 版本。

---

## 一、需要遷移的功能

### 1. 編輯側邊欄 (Edit Sidebar)
舊版位置: `src/pages/StatusPage.vue` 第 4-120 行

包含設定項目:
- [ ] Slug (URL 路徑)
- [ ] Title (標題)
- [ ] Description (描述，支援 Markdown)
- [ ] Footer Text (頁尾文字，支援 Markdown)
- [ ] Refresh Interval (自動刷新間隔)
- [ ] Theme (主題: auto/light/dark)
- [ ] Show Tags (顯示標籤)
- [ ] Show Powered By (顯示 Powered By)
- [ ] Show Certificate Expiry (顯示憑證到期)
- [ ] Domain Names List (網域名稱列表)
- [ ] Google Analytics ID
- [ ] Custom CSS (自訂 CSS，使用 Prism Editor)
- [ ] Delete 按鈕
- [ ] Save/Discard 按鈕

### 2. Logo 上傳功能
- [ ] ImageCropUpload 元件整合
- [ ] Logo 圖片裁剪與上傳
- [ ] Logo 預覽

### 3. Incident (事件) 管理
- [ ] 建立新 Incident
- [ ] 編輯現有 Incident
- [ ] 刪除/取消固定 Incident
- [ ] Incident 樣式選擇 (info/warning/danger/primary/light/dark)
- [ ] Markdown 內容支援

### 4. 群組 (Group) 管理
- [ ] 新增群組
- [ ] 拖曳排序群組
- [ ] 刪除群組
- [ ] 群組標籤頁切換

### 5. Monitor 管理
- [ ] 從下拉選單新增 Monitor 到群組
- [ ] 拖曳排序 Monitor
- [ ] 從群組移除 Monitor
- [ ] Monitor 設定 (send URL 等)

### 6. 分頁功能
- [ ] 分頁元件整合
- [ ] 每頁數量設定
- [ ] 頁碼切換

### 7. 即時更新
- [ ] WebSocket 連接狀態顯示
- [ ] 自動刷新倒數計時
- [ ] 最後更新時間顯示

### 8. 刪除確認對話框
- [ ] 確認刪除 Status Page

---

## 二、需要建立/修改的檔案

### 新增元件
1. `components/status-page/EditSidebar.vue` - 編輯側邊欄
2. `components/status-page/LogoUploader.vue` - Logo 上傳元件
3. `components/status-page/IncidentEditor.vue` - Incident 編輯器
4. `components/status-page/GroupManager.vue` - 群組管理
5. `components/status-page/MonitorSelector.vue` - Monitor 選擇器
6. `components/common/Editable.vue` - 可編輯文字元件
7. `components/common/ConfirmDialog.vue` - 確認對話框

### 修改檔案
1. `pages/status/[slug].vue` - 主頁面整合所有功能
2. `composables/usePublicStatusPage.ts` - 增加編輯相關方法
3. `server/api/v1/status-pages/[slug]/index.put.ts` - 更新 API

### 新增 API 端點
1. `server/api/v1/status-pages/[slug]/logo.post.ts` - Logo 上傳
2. `server/api/v1/status-pages/[slug]/groups.post.ts` - 新增群組
3. `server/api/v1/status-pages/[slug]/groups/[groupId].put.ts` - 更新群組
4. `server/api/v1/status-pages/[slug]/groups/[groupId].delete.ts` - 刪除群組
5. `server/api/v1/status-pages/[slug]/groups/[groupId]/monitors.post.ts` - 新增 Monitor 到群組

---

## 三、實作順序

### Phase 1: 基礎顯示 (已完成)
- [x] 公開 Status Page 顯示
- [x] Overall Status 狀態顯示
- [x] Monitor Groups 列表
- [x] 基本樣式

### Phase 2: 編輯側邊欄
1. 建立 EditSidebar.vue 元件
2. 實作基本設定欄位
3. 串接更新 API
4. Save/Discard 功能

### Phase 3: Logo 上傳
1. 整合 vue-image-crop-upload
2. 建立上傳 API
3. Logo 預覽與更新

### Phase 4: Incident 管理
1. 建立 IncidentEditor 元件
2. 實作 CRUD 功能
3. Markdown 預覽

### Phase 5: 群組與 Monitor 管理
1. 建立 GroupManager 元件
2. 拖曳排序 (vuedraggable)
3. Monitor 選擇器
4. 群組 CRUD

### Phase 6: 進階功能
1. 分頁整合
2. 即時更新優化
3. Custom CSS 編輯器
4. 確認對話框

---

## 四、技術注意事項

### 依賴套件
```json
{
  "vue-image-crop-upload": "^3.0.3",
  "vuedraggable": "^4.1.0",
  "marked": "^4.0.0",
  "dompurify": "^3.0.0",
  "prism-editor": "^1.3.0"
}
```

### Nuxt 3 適配
- 使用 Composition API
- 使用 useAsyncData/useFetch
- 使用 useUserSession 而非 vuex
- 使用 $fetch 而非 axios

### 樣式
- 使用 Tailwind CSS
- 維持與舊版相似的 UI/UX
- 響應式設計

---

## 五、預估時間

| Phase | 預估時間 |
|-------|---------|
| Phase 2 | 2-3 小時 |
| Phase 3 | 1-2 小時 |
| Phase 4 | 2-3 小時 |
| Phase 5 | 3-4 小時 |
| Phase 6 | 2-3 小時 |
| **總計** | **10-15 小時** |

---

## 六、開始實作

確認後，我將按照以下順序開始：

1. **立即**: 修正現有顯示問題
2. **Phase 2**: 建立編輯側邊欄
3. 逐步完成其他 Phase
