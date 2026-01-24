# Public Status Page 移植計劃

## 📋 目標
將 Vue + Node 版本的 Public Status Page 功能完整移植到 Nuxt.js 版本，包含：
- 公開狀態頁面 (不需登入)
- 編輯模式 (需登入)
- 即時更新 (WebSocket)
- 分頁功能
- 分組顯示

---

## 📁 檔案結構對照

### Vue + Node 版本 (來源)
```
src/pages/
├── StatusPage.vue          # 主要狀態頁面 (2338行)
├── ManageStatusPage.vue    # 管理狀態頁面列表
└── AddStatusPage.vue       # 新增狀態頁面

src/components/
├── PublicGroupList.vue     # 分組列表元件 (459行)
├── HeartbeatBar.vue        # 心跳狀態條
├── Uptime.vue              # 運行時間顯示
├── Status.vue              # 狀態指示器
├── MaintenanceTime.vue     # 維護時間顯示
├── MonitorSettingDialog.vue # Monitor 設定對話框
└── Tag.vue                 # 標籤元件

server/routers/
├── status-page-router.js   # Status Page API 路由

server/model/
├── status_page.js          # Status Page 資料模型
```

### Nuxt.js 版本 (目標)
```
nuxtjs/pages/
├── status/
│   └── [slug].vue           # 公開狀態頁面 ✅ (簡易版已存在)
├── status-pages/
│   ├── index.vue            # 管理狀態頁面列表 (待確認)
│   ├── add.vue              # 新增狀態頁面 (待確認)
│   └── [id]/                # 編輯狀態頁面

nuxtjs/components/
├── status/
│   ├── PublicGroupList.vue      # 分組列表元件 🆕
│   ├── HeartbeatBar.vue         # 心跳狀態條 🆕
│   ├── OverallStatus.vue        # 整體狀態顯示 🆕
│   ├── IncidentBanner.vue       # 事件橫幅 🆕
│   ├── MaintenanceAlert.vue     # 維護提醒 🆕
│   ├── MonitorCard.vue          # Monitor 卡片 🆕
│   └── StatusPageEditor.vue     # 狀態頁編輯器 (Sidebar) 🆕

nuxtjs/server/api/v1/
├── status-pages/
│   ├── index.get.ts             # 列表 ✅
│   ├── index.post.ts            # 新增 ✅
│   └── [slug]/
│       ├── index.get.ts         # 取得單一 ✅
│       ├── index.put.ts         # 更新 ✅
│       ├── index.delete.ts      # 刪除 ✅
│       ├── incidents.post.ts    # 新增事件 ✅
│       ├── heartbeat.get.ts     # 心跳資料 🆕
│       └── monitors.get.ts      # 分頁 Monitor 列表 🆕
```

---

## 🎯 移植任務清單

### Phase 1: API 層補充 (後端)
| 優先序 | 任務 | 說明 | 狀態 |
|-------|------|------|-----|
| P0 | `heartbeat.get.ts` | 取得心跳資料 API，支援 monitorIds 篩選 | 🆕 |
| P0 | `monitors.get.ts` | 分頁取得 Monitor 列表，支援 group 篩選 | 🆕 |
| P1 | 更新 `[slug]/index.get.ts` | 支援分頁參數 (page, limit, group) | ⚙️ |
| P1 | 新增 `rss.get.ts` | RSS Feed 支援 | 🆕 |

### Phase 2: 共用元件 (前端)
| 優先序 | 任務 | 說明 | 狀態 |
|-------|------|------|-----|
| P0 | `HeartbeatBar.vue` | 90 格心跳狀態條 (size: small/mid/large) | 🆕 |
| P0 | `Uptime.vue` | 運行時間百分比顯示 (type: 24h/30d/1y) | 🆕 |
| P0 | `OverallStatus.vue` | 整體狀態指示器 (All Up/Partial Down/All Down) | 🆕 |
| P1 | `IncidentBanner.vue` | 事件公告橫幅 (style: info/warning/danger) | 🆕 |
| P1 | `MaintenanceAlert.vue` | 維護提醒區塊 | 🆕 |
| P1 | `MonitorCard.vue` | 單一 Monitor 顯示卡片 | 🆕 |

### Phase 3: 主頁面重構 (前端)
| 優先序 | 任務 | 說明 | 狀態 |
|-------|------|------|-----|
| P0 | 重構 `status/[slug].vue` | 完整移植主狀態頁面功能 | ⚙️ |
| P0 | `PublicGroupList.vue` | 分組列表元件 (支援拖曳排序) | 🆕 |
| P1 | `StatusPageEditor.vue` | 右側編輯面板 (Sidebar) | 🆕 |
| P1 | 分組 Tab 切換 | Group Tabs 功能 | 🆕 |
| P1 | 分頁功能 | Pagination 功能 | 🆕 |

### Phase 4: 編輯模式 (前端)
| 優先序 | 任務 | 說明 | 狀態 |
|-------|------|------|-----|
| P1 | 編輯模式 Sidebar | 左側設定面板 | 🆕 |
| P1 | Logo 上傳 | 圖片裁剪上傳 | 🆕 |
| P1 | 事件編輯 | 建立/編輯/刪除事件 | 🆕 |
| P1 | Monitor 選擇器 | 選擇要顯示的 Monitor | 🆕 |
| P1 | 拖曳排序 | Group 和 Monitor 拖曳排序 | 🆕 |
| P2 | 自訂 CSS | Prism Editor + CSS 預覽 | 🆕 |
| P2 | 網域設定 | 自訂網域列表 | 🆕 |

### Phase 5: 進階功能
| 優先序 | 任務 | 說明 | 狀態 |
|-------|------|------|-----|
| P2 | 主題切換 | Auto/Light/Dark | 🆕 |
| P2 | 自動刷新 | 可設定刷新間隔 | 🆕 |
| P2 | Google Analytics | GA 追蹤整合 | 🆕 |
| P2 | 憑證到期顯示 | 顯示 SSL 憑證到期天數 | 🆕 |
| P3 | 維護模式 | 維護排程顯示 | 🆕 |
| P3 | Badge 生成 | 狀態 Badge 圖片 | 🆕 |

---

## 📐 元件設計規格

### 1. HeartbeatBar.vue
```vue
<template>
  <div class="heartbeat-bar" :class="sizeClass">
    <div 
      v-for="(beat, index) in beats" 
      :key="index"
      class="heartbeat-beat"
      :class="beatClass(beat)"
      :title="beatTooltip(beat)"
    />
  </div>
</template>

<script setup lang="ts">
interface Props {
  monitorId: number
  size?: 'small' | 'mid' | 'large'  // 預設 mid
  beatCount?: number                 // 預設 50
}
</script>
```

### 2. Uptime.vue
```vue
<template>
  <span class="uptime" :class="uptimeClass">
    {{ formattedUptime }}
  </span>
</template>

<script setup lang="ts">
interface Props {
  monitorId: number
  type?: '24' | '720' | '8760'  // 24h, 30d, 1y
  pill?: boolean                // 膠囊樣式
}
</script>
```

### 3. OverallStatus.vue
```vue
<template>
  <div class="overall-status shadow-box" :class="statusClass">
    <UIcon :name="statusIcon" class="status-icon" />
    <span>{{ statusText }}</span>
  </div>
</template>

<script setup lang="ts">
type OverallStatusType = 
  | 'all-up'           // 全部正常
  | 'partial-down'     // 部分異常
  | 'all-down'         // 全部異常
  | 'maintenance'      // 維護中
  | 'unknown'          // 未知

interface Props {
  status: OverallStatusType
}
</script>
```

### 4. PublicGroupList.vue
```vue
<template>
  <div class="public-group-list">
    <Draggable 
      v-model="groups"
      :disabled="!editMode"
      item-key="id"
    >
      <template #item="{ element: group }">
        <div class="group-section">
          <h2 class="group-title">
            <UIcon v-if="editMode" name="i-heroicons-bars-3" class="drag-handle" />
            {{ group.name }}
          </h2>
          
          <div class="monitor-list shadow-box">
            <MonitorCard 
              v-for="monitor in getPaginatedMonitors(group)"
              :key="monitor.id"
              :monitor="monitor"
              :edit-mode="editMode"
              :show-tags="showTags"
              :show-certificate-expiry="showCertificateExpiry"
            />
          </div>
        </div>
      </template>
    </Draggable>
  </div>
</template>
```

---

## 🗄️ API 設計規格

### GET /api/v1/status-pages/:slug/heartbeat
取得狀態頁的心跳資料（公開 API，不需認證）

**Query Parameters:**
| 參數 | 類型 | 說明 |
|-----|------|-----|
| monitorIds | string | 逗號分隔的 Monitor ID 列表 (可選) |
| interval | number | 資料範圍秒數 (可選) |

**Response:**
```json
{
  "ok": true,
  "data": {
    "heartbeatList": {
      "1": [{ "status": 1, "time": "...", "ping": 50 }, ...],
      "2": [{ "status": 1, "time": "...", "ping": 30 }, ...]
    },
    "uptimeList": {
      "1_24": 0.9987,
      "2_24": 1.0
    }
  }
}
```

### GET /api/v1/status-pages/:slug/monitors
取得狀態頁的 Monitor 列表（支援分頁）

**Query Parameters:**
| 參數 | 類型 | 說明 |
|-----|------|-----|
| group | number | 篩選特定群組 ID (可選) |
| page | number | 頁碼，預設 1 |
| limit | number | 每頁筆數，預設 10，最大 50 |

**Response:**
```json
{
  "ok": true,
  "data": {
    "groups": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "totalPages": 5
    },
    "groupTabs": [
      { "id": 1, "name": "Web Services", "count": 20 },
      { "id": 2, "name": "Databases", "count": 15 }
    ]
  }
}
```

---

## 🔄 狀態頁資料流

```
┌─────────────────────────────────────────────────────────────┐
│                      Public Status Page                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐  │
│  │  onMounted   │────►│ Fetch Config │───►│ Init Socket  │  │
│  └──────────────┘     └──────────────┘    └──────────────┘  │
│                                                   │          │
│                                                   ▼          │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐  │
│  │ Auto Refresh │◄────│ Heartbeat WS │◄───│ Subscribe    │  │
│  │   Timer      │     │   Updates    │    │  Monitors    │  │
│  └──────────────┘     └──────────────┘    └──────────────┘  │
│         │                    │                              │
│         ▼                    ▼                              │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │ updateTimer  │     │ Update UI    │                      │
│  │ Countdown    │     │ Components   │                      │
│  └──────────────┘     └──────────────┘                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 UI/UX 考量

### 主題支援
- Auto: 跟隨系統設定
- Light: 淺色主題
- Dark: 深色主題
- 自訂 CSS: 允許使用者自訂樣式

### 響應式設計
- 桌面版: Sidebar + 主內容區
- 平板版: 收合式 Sidebar
- 手機版: 單欄式佈局，Tab 水平滾動

### 元件庫
- 使用 Nuxt UI 元件 (UCard, UBadge, UButton, UTabs, UModal)
- 使用 VueUse 的 useIntervalFn、useStorage
- 使用 vuedraggable-es 做拖曳排序

---

## 📅 實作順序建議

### Week 1: 基礎元件
1. ✅ 建立 `HeartbeatBar.vue`
2. ✅ 建立 `Uptime.vue`  
3. ✅ 建立 `OverallStatus.vue`
4. ✅ 實作 `heartbeat.get.ts` API

### Week 2: 主頁面
5. ✅ 重構 `status/[slug].vue`
6. ✅ 建立 `PublicGroupList.vue`
7. ✅ 建立 `MonitorCard.vue`
8. ✅ 實作 WebSocket 即時更新

### Week 3: 分頁與 Tab
9. ✅ 實作 Group Tabs
10. ✅ 實作分頁功能
11. ✅ 實作 `monitors.get.ts` API

### Week 4: 編輯模式
12. ✅ 建立 `StatusPageEditor.vue` Sidebar
13. ✅ 實作事件 CRUD
14. ✅ 實作 Monitor 選擇器
15. ✅ 實作拖曳排序

### Week 5: 進階功能
16. ✅ Logo 上傳功能
17. ✅ 自訂 CSS 編輯器
18. ✅ 主題切換
19. ✅ 自動刷新

### Week 6: 優化與測試
20. ✅ 效能優化 (虛擬列表)
21. ✅ 單元測試
22. ✅ E2E 測試
23. ✅ 文件更新

---

## 🔧 技術債與注意事項

### 從 Vue 2 到 Vue 3 的調整
- `$root` → 使用 Pinia store 或 provide/inject
- `$refs` → 使用 template ref
- `$emit` → 使用 defineEmits
- `$forceUpdate` → 使用 reactive key 或 computed
- `this.$route` → 使用 useRoute()

### 從 Socket.io 到 Nuxt 的調整
- 使用 Composable 封裝 socket 邏輯
- 在 onMounted 中初始化連線
- 在 onUnmounted 中清理連線

### 從 axios 到 $fetch 的調整
- 使用 `$fetch` 或 `useFetch`
- 使用 `useAsyncData` 處理 SSR
- 錯誤處理使用 createError

---

## ✅ 完成標準

### 功能完整性
- [ ] 公開狀態頁可正常顯示
- [ ] 所有 Monitor 心跳狀態即時更新
- [ ] 分組功能正常運作
- [ ] 分頁功能正常運作
- [ ] 編輯模式可正常儲存
- [ ] 事件 CRUD 功能完整
- [ ] Logo 上傳功能正常
- [ ] 自訂 CSS 功能正常

### 效能指標
- [ ] 首次載入 < 3 秒
- [ ] WebSocket 重連機制正常
- [ ] 大量 Monitor (100+) 不卡頓

### 相容性
- [ ] Chrome/Firefox/Safari/Edge 支援
- [ ] 手機/平板響應式正常
- [ ] 深色模式正常顯示

---

## 📝 附錄：原版功能清單

### StatusPage.vue 功能 (2338 行)
1. **基本資訊顯示**
   - Logo 顯示/上傳
   - 標題編輯
   - 描述 (支援 Markdown)
   - 頁尾文字 (支援 Markdown)

2. **狀態顯示**
   - 整體狀態指示器 (All Up/Partial/Down/Maintenance)
   - 分組顯示
   - Monitor 列表 (名稱、心跳條、運行時間)
   - 標籤顯示
   - 憑證到期顯示

3. **事件系統**
   - 事件橫幅 (info/warning/danger/primary/light/dark)
   - 事件 CRUD
   - Markdown 內容
   - 時間顯示

4. **維護系統**
   - 維護提醒區塊
   - 維護時間顯示

5. **設定選項**
   - Slug 網址
   - 自動刷新間隔
   - 主題選擇
   - 顯示標籤開關
   - 顯示 Powered By 開關
   - 顯示憑證到期開關
   - 自訂網域
   - Google Analytics
   - 自訂 CSS

6. **編輯功能**
   - 編輯模式切換
   - 新增/刪除分組
   - 新增/刪除 Monitor
   - 拖曳排序
   - 儲存/放棄變更

7. **分頁功能**
   - 分組 Tab 切換
   - 頁碼導航
   - 每頁筆數設定

8. **即時更新**
   - WebSocket 心跳更新
   - 自動刷新計時器
   - 最後更新時間顯示

---

## 📊 資料結構詳細規格

### Status Page Config 物件
```typescript
interface StatusPageConfig {
  id: number
  slug: string                    // URL 路徑 (a-z, 0-9, - only)
  title: string                   // 頁面標題
  description?: string            // 描述 (支援 Markdown)
  icon: string                    // Logo URL 或 data:// URL
  theme: 'auto' | 'light' | 'dark'
  autoRefreshInterval: number     // 自動刷新間隔 (秒), 預設 300
  published: boolean              // 是否公開
  showTags: boolean               // 是否顯示標籤
  showPoweredBy: boolean          // 是否顯示 Powered By
  showCertificateExpiry: boolean  // 是否顯示憑證到期
  customCSS?: string              // 自訂 CSS
  footerText?: string             // 頁尾文字 (支援 Markdown)
  googleAnalyticsId?: string      // GA Tag ID
  domainNameList: string[]        // 自訂網域列表
}
```

### Incident (事件) 物件
```typescript
interface Incident {
  id?: number
  title: string
  content: string                 // 支援 Markdown
  style: 'info' | 'warning' | 'danger' | 'primary' | 'light' | 'dark'
  pin: boolean                    // 是否置頂
  createdDate?: string
  lastUpdatedDate?: string
}
```

### Group (分組) 物件
```typescript
interface PublicGroup {
  id: number
  name: string
  weight: number                  // 排序權重
  monitorList: PublicMonitor[]    // Monitor 列表
}
```

### Monitor (監控項目) 物件
```typescript
interface PublicMonitor {
  id: number
  name: string
  sendUrl: boolean                // 是否顯示連結
  url?: string                    // Monitor URL
  type?: string                   // http, keyword, json-query 等
  tags?: Tag[]                    // 標籤列表
  validCert?: boolean             // 憑證是否有效
  certExpiryDaysRemaining?: number // 憑證到期天數
}
```

### Heartbeat (心跳) 物件
```typescript
interface Heartbeat {
  status: 0 | 1 | 2 | 3           // 0=Down, 1=Up, 2=Pending, 3=Maintenance
  time: string                    // ISO 時間
  ping?: number                   // 延遲 (ms)
  msg?: string                    // 錯誤訊息
}
```

### Pagination (分頁) 物件
```typescript
interface Pagination {
  total: number                   // 總筆數
  currentPage: number             // 目前頁碼
  totalPages: number              // 總頁數
  perPage: number                 // 每頁筆數
  hasNextPage: boolean
  hasPrevPage: boolean
}
```

### GroupTab (分組標籤) 物件
```typescript
interface GroupTab {
  id: number | 'all'              // 群組 ID 或 'all'
  name: string                    // 群組名稱
  count: number                   // Monitor 數量
}
```

---

## 🔌 Socket.io 事件規格

### 客戶端發送事件 (Client → Server)

| 事件名稱 | 參數 | 說明 |
|---------|------|-----|
| `getStatusPage` | `(slug, callback)` | 取得狀態頁設定 (需登入) |
| `saveStatusPage` | `(slug, config, imgDataUrl, publicGroupList, callback)` | 儲存狀態頁 |
| `deleteStatusPage` | `(slug, callback)` | 刪除狀態頁 |
| `addStatusPage` | `(title, slug, callback)` | 新增狀態頁 |
| `postIncident` | `(slug, incident, callback)` | 發布/編輯事件 |
| `unpinIncident` | `(slug, callback)` | 取消置頂事件 |
| `getAllMonitors` | `(callback)` | 取得所有節點的 Monitor (編輯模式用) |

### 伺服器發送事件 (Server → Client)

| 事件名稱 | 資料 | 說明 |
|---------|------|-----|
| `heartbeat` | `{ monitorId, heartbeat }` | 心跳更新 |
| `statusPageList` | `{ [id]: StatusPage }` | 狀態頁列表 |

---

## 🎨 CSS 樣式變數

### 顏色變數
```scss
// 狀態顏色
$primary: #5cdd8b;          // Up / 正常
$danger: #dc3545;           // Down / 異常
$warning: #f8a306;          // Pending / 等待中
$maintenance: #1747f5;      // Maintenance / 維護中

// 背景顏色
$dark-header-bg: #161b22;
$dark-border-color: #2e2e2e;
$dark-font-color: #c0c0c0;

// 動畫
$easing-in: ease-in-out;
```

### HeartbeatBar 樣式規格
```scss
// 尺寸設定
.size-big {
  beatWidth: 10px;
  beatHeight: 30px;
  beatHoverAreaPadding: 4px;
}

.size-mid {
  beatWidth: 5px;
  beatHeight: 16px;
  beatHoverAreaPadding: 2px;
}

.size-small {
  beatWidth: 3px;
  beatHeight: 10px;
  beatHoverAreaPadding: 1px;
}
```

### Sidebar 樣式規格
```scss
.sidebar {
  width: 300px;
  height: 100vh;
  position: fixed;
  left: 0;
  top: 0;
  
  .sidebar-body {
    height: calc(100% - 70px);
    overflow-y: auto;
  }
  
  .sidebar-footer {
    height: 70px;
    position: fixed;
    bottom: 0;
  }
}

.main.edit {
  margin-left: 300px;
}
```

---

## 🔧 HeartbeatBar 元件詳細規格

### Props
| Prop | 類型 | 預設值 | 說明 |
|------|------|-------|-----|
| `size` | `'big' \| 'mid' \| 'small'` | `'big'` | 尺寸 |
| `monitorId` | `number` | 必填 | Monitor ID |
| `heartbeatList` | `Heartbeat[]` | `null` | 心跳列表 (可選，否則從 store 取得) |

### 計算邏輯
```typescript
// 顯示的心跳數量根據容器寬度動態計算
const maxBeat = Math.floor(containerWidth / (beatWidth + beatHoverAreaPadding * 2))

// 短列表 = 空白填充 + 實際心跳 (從最新往前取)
const shortBeatList = [...placeholders, ...beatList.slice(-maxBeat)]

// 動畫：新心跳進入時向左滑動
const barStyle = move ? { transform: `translateX(-${beatWidth + beatHoverAreaPadding * 2}px)` } : {}
```

### 心跳顏色
```typescript
const beatClass = (beat) => ({
  'empty': beat === 0,           // aliceblue / #848484 (dark)
  'down': beat.status === 0,     // $danger (#dc3545)
  'pending': beat.status === 2,  // $warning (#f8a306)
  'maintenance': beat.status === 3, // $maintenance (#1747f5)
  // 預設 (status === 1): $primary (#5cdd8b)
})
```

### Tooltip 格式
```typescript
const getBeatTitle = (beat) => {
  let title = formatDateTime(beat.time)
  if (beat.ping) title += ` | ${beat.ping} ms`
  if (beat.msg) title += ` - ${beat.msg}`
  return title
}
```

---

## 🔧 Uptime 元件詳細規格

### Props
| Prop | 類型 | 預設值 | 說明 |
|------|------|-------|-----|
| `monitor` | `Monitor` | 必填 | Monitor 物件 |
| `type` | `'24' \| '720' \| '1y'` | `'24'` | 時間範圍 |
| `pill` | `boolean` | `false` | 膠囊樣式 |

### 計算邏輯
```typescript
// 從 uptimeList 取得 (格式: monitorId_type)
const key = `${monitor.id}_${type}`
const uptime = uptimeList[key]

// 顯示格式
const display = Math.round(uptime * 10000) / 100 + '%'

// 顏色 (根據最後心跳狀態)
const color = {
  0: 'danger',      // Down
  1: 'primary',     // Up
  2: 'warning',     // Pending
  3: 'maintenance', // Maintenance
  default: 'secondary'
}
```

---

## 🔧 OverallStatus 計算邏輯

```typescript
// 狀態常數
const STATUS_PAGE_ALL_UP = 0
const STATUS_PAGE_PARTIAL_DOWN = 1
const STATUS_PAGE_ALL_DOWN = 2
const STATUS_PAGE_MAINTENANCE = 3

function calculateOverallStatus(heartbeats: Heartbeat[]): number {
  if (heartbeats.length === 0) return -1
  
  let status = STATUS_PAGE_ALL_UP
  let hasUp = false
  
  for (const beat of heartbeats) {
    if (beat.status === MAINTENANCE) {
      return STATUS_PAGE_MAINTENANCE // 優先顯示維護中
    } else if (beat.status === UP) {
      hasUp = true
    } else {
      status = STATUS_PAGE_PARTIAL_DOWN
    }
  }
  
  if (!hasUp) {
    status = STATUS_PAGE_ALL_DOWN
  }
  
  return status
}

// 顯示設定
const statusConfig = {
  [-1]: { icon: 'question-circle', text: 'No Services', color: 'gray' },
  [STATUS_PAGE_ALL_UP]: { icon: 'check-circle', text: 'All Systems Operational', color: 'ok' },
  [STATUS_PAGE_PARTIAL_DOWN]: { icon: 'exclamation-circle', text: 'Partially Degraded Service', color: 'warning' },
  [STATUS_PAGE_ALL_DOWN]: { icon: 'times-circle', text: 'Degraded Service', color: 'danger' },
  [STATUS_PAGE_MAINTENANCE]: { icon: 'wrench', text: 'Under Maintenance', color: 'maintenance' },
}
```

---

## 🔧 自動刷新邏輯

```typescript
// 初始化計時器
const autoRefreshInterval = config.autoRefreshInterval || 300 // 秒

// 心跳更新間隔 = autoRefreshInterval + 10 秒
const feedInterval = setInterval(() => {
  updateHeartbeatList()
}, (autoRefreshInterval + 10) * 1000)

// 倒數計時器
const updateCountdown = setInterval(() => {
  const countdown = dayjs.duration(
    lastUpdateTime.add(autoRefreshInterval, 'seconds').add(10, 'seconds').diff(dayjs())
  )
  
  if (countdown.as('seconds') < 0) {
    clearInterval(updateCountdown)
  } else {
    updateCountdownText = countdown.format('mm:ss')
  }
}, 1000)
```

---

## 🔧 Slug 驗證規則

```typescript
// 正規表達式: a-z, 0-9, - (不能以 - 開頭或結尾)
const slugRegex = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/

function checkSlug(slug: string): void {
  if (typeof slug !== 'string') {
    throw new Error('Slug must be string')
  }
  
  slug = slug.trim()
  
  if (!slug) {
    throw new Error('Slug cannot be empty')
  }
  
  if (!slug.match(slugRegex)) {
    throw new Error('Invalid Slug')
  }
}
```

---

## 🔧 Logo 上傳規格

```typescript
// 接受格式
const acceptedFormat = 'data:image/png;base64,'

// 尺寸
const logoWidth = 128
const logoHeight = 128

// 儲存路徑
const filename = `logo${statusPageId}.png`
const savePath = `/upload/${filename}?t=${Date.now()}`

// 驗證
if (imgDataUrl.startsWith('data:')) {
  if (!imgDataUrl.startsWith(acceptedFormat)) {
    throw new Error('Only allowed PNG logo.')
  }
  // 儲存檔案
} else {
  // 使用 URL
}
```

---

## 🔧 Nuxt.js Composable 設計

### useStatusPage.ts
```typescript
export function useStatusPage(slug: Ref<string>) {
  const config = ref<StatusPageConfig | null>(null)
  const groups = ref<PublicGroup[]>([])
  const incident = ref<Incident | null>(null)
  const maintenanceList = ref<Maintenance[]>([])
  const heartbeatList = ref<Record<number, Heartbeat[]>>({})
  const uptimeList = ref<Record<string, number>>({})
  const loading = ref(true)
  const error = ref<string | null>(null)
  
  // 分頁狀態
  const pagination = ref<Pagination | null>(null)
  const activeTab = ref<number | 'all'>('all')
  const page = ref(1)
  const perPage = ref(10)
  
  // 載入資料
  async function loadData() { ... }
  
  // 載入心跳
  async function loadHeartbeat(monitorIds?: number[]) { ... }
  
  // 切換 Tab
  function switchTab(tabId: number | 'all') { ... }
  
  // 換頁
  function changePage(newPage: number) { ... }
  
  return {
    config, groups, incident, maintenanceList,
    heartbeatList, uptimeList, loading, error,
    pagination, activeTab, page, perPage,
    loadData, loadHeartbeat, switchTab, changePage
  }
}
```

### useStatusPageEdit.ts
```typescript
export function useStatusPageEdit(slug: Ref<string>) {
  const socket = useSocket()
  const editMode = ref(false)
  const saving = ref(false)
  
  // 編輯狀態
  const configDraft = ref<StatusPageConfig | null>(null)
  const groupsDraft = ref<PublicGroup[]>([])
  const imgDataUrl = ref<string>('/icon.svg')
  
  // 事件編輯
  const incidentDraft = ref<Incident | null>(null)
  const editIncidentMode = ref(false)
  
  // 方法
  function enterEditMode() { ... }
  function save() { ... }
  function discard() { ... }
  function addGroup() { ... }
  function removeGroup(index: number) { ... }
  function addMonitor(groupIndex: number, monitor: Monitor) { ... }
  function removeMonitor(groupIndex: number, monitorIndex: number) { ... }
  function postIncident() { ... }
  function unpinIncident() { ... }
  
  return {
    editMode, saving, configDraft, groupsDraft, imgDataUrl,
    incidentDraft, editIncidentMode,
    enterEditMode, save, discard, addGroup, removeGroup,
    addMonitor, removeMonitor, postIncident, unpinIncident
  }
}
```

---

## 📱 響應式斷點

```scss
// 手機版
@media (max-width: 768px) {
  .sidebar {
    width: 100%;
    height: auto;
    position: relative;
  }
  
  .main.edit {
    margin-left: 0;
  }
  
  .kuma-tabs {
    overflow-x: auto;
    .kuma-tab {
      flex: 1;
      min-width: auto;
    }
  }
  
  h1 {
    font-size: 22px;
  }
  
  .overall-status {
    font-size: 20px;
  }
}
```

---

## 🧪 測試案例

### 單元測試
1. `HeartbeatBar` - 正確計算 maxBeat
2. `HeartbeatBar` - 正確顯示狀態顏色
3. `Uptime` - 正確計算百分比
4. `OverallStatus` - 正確計算整體狀態
5. `Slug` - 正確驗證格式

### E2E 測試
1. 公開狀態頁可訪問
2. 心跳更新即時顯示
3. 分頁功能正常
4. Tab 切換正常
5. 編輯模式進入/退出
6. 儲存/放棄變更
7. 事件 CRUD
8. Logo 上傳

---

*計劃建立日期: 2026-01-25*
*最後更新: 2026-01-25*
*預計完成時間: 6 週*
