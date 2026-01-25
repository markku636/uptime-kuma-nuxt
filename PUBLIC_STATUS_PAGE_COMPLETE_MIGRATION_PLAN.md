# Public Status Page 完整移植計劃

## 📋 專案背景

從截圖可看出 Nuxt.js 版本的 Public Status Page (`/status/test1`) 存在以下問題：
1. 顯示 "Status Unknown" - 無法正確取得整體狀態
2. 顯示 "No monitors configured" - 無法正確載入 Monitor 列表
3. 頁面的群組與 Monitor 資料未正確從後端載入

本計劃旨在完成 Public Status Page 從 Vue + Node 版本到 Nuxt.js 版本的完整移植。

---

## 📊 現況分析

### 已完成的部分 ✅

| 類別 | 檔案/元件 | 狀態 | 說明 |
|------|-----------|------|------|
| 頁面 | `nuxtjs/pages/status/[slug].vue` | ✅ 已建立 | 基本架構完成 (722 行) |
| Composable | `nuxtjs/composables/usePublicStatusPage.ts` | ✅ 已建立 | 核心邏輯完成 (619 行) |
| API | `nuxtjs/server/api/v1/status-pages/[slug]/monitors.get.ts` | ✅ 已建立 | 分頁 API 完成 |
| API | `nuxtjs/server/api/v1/status-pages/[slug]/heartbeat.get.ts` | ✅ 已建立 | 心跳 API 完成 |
| API | `nuxtjs/server/api/v1/status-pages/[slug]/index.get.ts` | ✅ 已建立 | 基本設定 API |
| API | `nuxtjs/server/api/v1/status-pages/[slug]/index.put.ts` | ✅ 已建立 | 更新 API |
| API | `nuxtjs/server/api/v1/status-pages/[slug]/index.delete.ts` | ✅ 已建立 | 刪除 API |
| API | `nuxtjs/server/api/v1/status-pages/[slug]/incidents.post.ts` | ✅ 已建立 | 事件 API |
| API | `nuxtjs/server/api/v1/status-pages/[slug]/upload-logo.post.ts` | ✅ 已建立 | Logo 上傳 |
| 元件 | `nuxtjs/components/status/HeartbeatBar.vue` | ✅ 已建立 | 心跳條元件 |
| 元件 | `nuxtjs/components/status/Uptime.vue` | ✅ 已建立 | 運行時間元件 |
| 元件 | `nuxtjs/components/status/OverallStatus.vue` | ✅ 已建立 | 整體狀態元件 |
| 元件 | `nuxtjs/components/status/MonitorCard.vue` | ✅ 已建立 | Monitor 卡片 |
| 元件 | `nuxtjs/components/status/IncidentBanner.vue` | ✅ 已建立 | 事件橫幅 |
| 元件 | `nuxtjs/components/status/PublicGroupList.vue` | ✅ 已建立 | 分組列表 |
| 元件 | `nuxtjs/components/status/StatusGroup.vue` | ✅ 已建立 | 單一群組 |

### 🚨 關鍵問題發現

#### 資料庫表名不匹配問題

**原始 SQLite 資料庫表結構 (Vue + Node 版本)**:
```sql
-- status_page 表
CREATE TABLE status_page (...)

-- group 表 (群組)
CREATE TABLE "group" (
  id INTEGER PRIMARY KEY,
  status_page_id INTEGER,
  name VARCHAR(255),
  public BOOLEAN,
  weight INTEGER
)

-- monitor_group 表 (群組與 Monitor 關聯)
CREATE TABLE monitor_group (
  id INTEGER PRIMARY KEY,
  group_id INTEGER,
  monitor_id INTEGER,
  weight INTEGER,
  send_url BOOLEAN
)
```

**Prisma Schema 定義 (Nuxt.js 版本)**:
```prisma
model StatusPageGroup {
  @@map("status_page_groups")  // 表名不匹配！
}

model StatusPageMonitor {
  @@map("status_page_monitors") // 表名不匹配！
}
```

**問題**:
- Prisma 查詢 `status_page_groups` 表，但實際資料在 `group` 表
- Prisma 查詢 `status_page_monitors` 表，但實際資料在 `monitor_group` 表
- 這導致 API 無法取得任何群組和 Monitor 資料

### 待解決問題 ⚠️

1. **🔴 資料庫表名不匹配** - Prisma Schema 表名與原始資料庫不一致 (最關鍵問題)
2. **資料載入失敗** - `monitors.get.ts` 因表名問題無法查詢
3. **Heartbeat 資料缺失** - 心跳資料未正確載入到 Monitor
4. **狀態計算錯誤** - overallStatus 因無心跳資料而顯示 Unknown
5. **編輯模式功能不完整** - 部分編輯功能可能未正常運作
6. **缺少 autoRefreshInterval 欄位** - Prisma Schema 中 StatusPage 缺少此欄位
7. **缺少 showCertificateExpiry 欄位** - Prisma Schema 中 StatusPage 缺少此欄位

---

## 🔍 問題診斷計劃

### Phase 0: 問題診斷 (Day 1-2)

#### Task 0.1: 檢查 API 回應
```bash
# 測試 monitors API
curl http://localhost:3001/api/v1/status-pages/test1/monitors

# 測試 heartbeat API  
curl http://localhost:3001/api/v1/status-pages/test1/heartbeat
```

#### Task 0.2: 檢查 Prisma Schema
確認 `nuxtjs/prisma/schema.prisma` 中的以下 model 是否正確：
- `StatusPage`
- `Group` (status_page_group)
- `StatusPageMonitor` (status_page_monitor 或 monitor_group)
- `Monitor`
- `Heartbeat`

#### Task 0.3: 檢查資料庫資料
```sql
-- 檢查 status_page 表
SELECT * FROM status_page WHERE slug = 'test1';

-- 檢查 group 表
SELECT * FROM "group" WHERE status_page_id = (SELECT id FROM status_page WHERE slug = 'test1');

-- 檢查 monitor_group 表
SELECT * FROM monitor_group WHERE group_id IN (
  SELECT id FROM "group" WHERE status_page_id = (SELECT id FROM status_page WHERE slug = 'test1')
);
```

---

## 🛠️ 修復計劃

### Phase 0.5: 修復 Prisma Schema (Day 1-2) 🔴 最優先

#### 問題: 資料庫表名不匹配

Prisma Schema 中的表名與原始 SQLite 資料庫不一致，需要修正 `@@map` 映射。

#### Task 0.5.1: 修改 `prisma/schema.prisma`

```prisma
// 修正 StatusPageGroup - 映射到原始 "group" 表
model StatusPageGroup {
  id           Int     @id @default(autoincrement())
  statusPageId Int     @map("status_page_id")
  name         String
  weight       Int     @default(1000)
  public       Boolean @default(true)   // 原始表有此欄位

  statusPage StatusPage          @relation(fields: [statusPageId], references: [id], onDelete: Cascade)
  monitors   StatusPageMonitor[]

  @@map("group")  // <-- 修正: 映射到 "group" 表
}

// 修正 StatusPageMonitor - 映射到原始 "monitor_group" 表
model StatusPageMonitor {
  id        Int     @id @default(autoincrement())
  groupId   Int     @map("group_id")
  monitorId Int     @map("monitor_id")
  sendUrl   Boolean @default(false) @map("send_url")
  weight    Int     @default(1000)  // 原始表有此欄位

  group   StatusPageGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  monitor Monitor         @relation(fields: [monitorId], references: [id], onDelete: Cascade)

  @@map("monitor_group")  // <-- 修正: 映射到 "monitor_group" 表
}

// 確認 StatusPage 欄位完整
model StatusPage {
  id                    Int      @id @default(autoincrement())
  slug                  String   @unique
  title                 String
  description           String?
  icon                  String?
  theme                 String   @default("auto")
  published             Boolean  @default(true)
  showTags              Boolean  @default(false) @map("show_tags")
  showPoweredBy         Boolean  @default(true) @map("show_powered_by")
  showCertificateExpiry Boolean  @default(false) @map("show_certificate_expiry") // 新增
  autoRefreshInterval   Int      @default(300) @map("auto_refresh_interval")    // 新增
  customCss             String?  @map("custom_css")
  footerText            String?  @map("footer_text")
  googleAnalyticsId     String?  @map("google_analytics_id")
  searchEngineIndex     Boolean  @default(true) @map("search_engine_index")      // 新增
  password              String?                                                  // 新增
  userId                Int      @map("user_id")
  createdAt             DateTime @default(now()) @map("created_at")
  modifiedDate          DateTime? @map("modified_date")                          // 新增

  groups    StatusPageGroup[]
  incidents Incident[]

  @@index([userId])
  @@map("status_page")
}

// 確認 Incident 欄位完整
model Incident {
  id           Int       @id @default(autoincrement())
  statusPageId Int       @map("status_page_id")
  title        String
  content      String
  style        String    @default("warning") // info, warning, danger, primary, light, dark
  pin          Boolean   @default(true)
  active       Boolean   @default(true)      // 新增: 原始表有此欄位
  createdAt    DateTime  @default(now()) @map("created_date")
  updatedAt    DateTime? @map("last_updated_date")

  statusPage StatusPage @relation(fields: [statusPageId], references: [id], onDelete: Cascade)

  @@map("incident")
}
```

#### Task 0.5.2: 驗證原始資料庫結構

確認原始 SQLite 資料庫的完整結構：

```bash
# 連接到原始 SQLite 資料庫
sqlite3 data/kuma.db

# 檢查 group 表結構
.schema group

# 檢查 monitor_group 表結構
.schema monitor_group

# 檢查 status_page 表結構
.schema status_page

# 檢查 incident 表結構
.schema incident

# 檢查資料
SELECT * FROM status_page WHERE slug = 'test1';
SELECT * FROM "group" WHERE status_page_id = (SELECT id FROM status_page WHERE slug = 'test1');
```

#### Task 0.5.3: 重新生成 Prisma Client

```bash
cd nuxtjs
npx prisma generate
```

#### Task 0.5.4: 驗證修復

```bash
# 測試 API
curl http://localhost:3001/api/v1/status-pages/test1/monitors | jq
```

---

### Phase 1: 修復 API 層 (Day 3-5)

#### Task 1.1: 修復 `monitors.get.ts`

**問題**: API 可能無法正確查詢 Prisma 關聯

**檔案**: `nuxtjs/server/api/v1/status-pages/[slug]/monitors.get.ts`

**修復方向**:
1. 確認 Prisma include 語法正確
2. 確認 group 與 monitor 的關聯查詢
3. 添加詳細的錯誤日誌

```typescript
// 預期的查詢結構
const statusPage = await prisma.statusPage.findUnique({
  where: { slug },
  include: {
    groups: {
      orderBy: { weight: 'asc' },
      include: {
        monitors: {
          orderBy: { weight: 'asc' },
          include: {
            monitor: {
              include: {
                tags: true
              }
            }
          }
        }
      }
    },
    incidents: {
      where: { pin: true, active: true },
      take: 1
    }
  }
})
```

#### Task 1.2: 修復 `heartbeat.get.ts`

**問題**: 心跳資料未正確載入

**修復方向**:
1. 確認 heartbeat 表查詢正確
2. 確認時間範圍篩選正確 (最近 24 小時)
3. 計算 uptime 百分比

```typescript
// 預期的心跳查詢
const heartbeats = await prisma.heartbeat.findMany({
  where: {
    monitorId: { in: monitorIds },
    time: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
  },
  orderBy: { time: 'desc' },
  take: 100 // 每個 monitor 最多 100 筆
})
```

#### Task 1.3: 確認資料格式一致性

確保 API 回傳格式與 Composable 預期一致：

```typescript
// monitors.get.ts 預期回傳格式
{
  ok: true,
  data: {
    config: StatusPageConfig,
    incident: Incident | null,
    publicGroupList: PublicGroup[],
    groupTabs: GroupTab[],
    pagination: Pagination | null
  }
}

// heartbeat.get.ts 預期回傳格式
{
  ok: true,
  data: {
    heartbeatList: { [monitorId: number]: Heartbeat[] },
    uptimeList: { [key: string]: number }  // key = "monitorId_24" 等
  }
}
```

---

### Phase 2: 修復 Composable (Day 6-7)

#### Task 2.1: 修復 `usePublicStatusPage.ts`

**檔案**: `nuxtjs/composables/usePublicStatusPage.ts`

**修復項目**:

1. **初始化邏輯** - 確保 `init()` 正確調用 API
2. **錯誤處理** - 添加更詳細的錯誤訊息
3. **狀態計算** - 確保 `overallStatus` 正確計算

```typescript
// 修正 loadData 函數
async function loadData(options: { noPagination?: boolean } = {}) {
  try {
    loading.value = true
    error.value = null
    
    console.log('[usePublicStatusPage] Loading data for slug:', slugRef.value)

    const url = `/api/v1/status-pages/${slugRef.value}/monitors`
    console.log('[usePublicStatusPage] Fetching:', url)
    
    const response = await $fetch<any>(url)
    console.log('[usePublicStatusPage] Response:', response)

    if (response.ok && response.data) {
      config.value = response.data.config
      incident.value = response.data.incident
      groups.value = response.data.publicGroupList || []
      groupTabs.value = response.data.groupTabs || []
      pagination.value = response.data.pagination
      
      console.log('[usePublicStatusPage] Loaded groups:', groups.value.length)
    } else {
      error.value = response.message || 'Failed to load data'
      console.error('[usePublicStatusPage] API error:', response)
    }
  } catch (e: any) {
    error.value = e.data?.message || e.message || 'Failed to load status page'
    console.error('[usePublicStatusPage] Exception:', e)
  } finally {
    loading.value = false
  }
}
```

---

### Phase 3: 修復前端元件 (Day 8-10)

#### Task 3.1: 修復 `status/[slug].vue`

**問題**: 頁面可能未正確使用 Composable 資料

**修復項目**:
1. 確保 `publicGroupList` 正確綁定到 `StatusPublicGroupList`
2. 確保 `overallStatusConfig` 正確顯示
3. 確保 loading/error 狀態正確處理

#### Task 3.2: 修復 `StatusPublicGroupList.vue`

確保元件正確接收並渲染 groups：

```vue
<template>
  <div class="public-group-list">
    <template v-if="groups && groups.length > 0">
      <StatusGroup
        v-for="(group, index) in groups"
        :key="group.id"
        :group="group"
        :edit-mode="editMode"
        :show-certificate-expiry="showCertificateExpiry"
        @remove="$emit('removeGroup', index)"
        @removeMonitor="(monitorIndex) => $emit('removeMonitor', index, monitorIndex)"
      />
    </template>
    <div v-else class="text-center text-gray-500 py-8">
      No groups to display
    </div>
  </div>
</template>
```

#### Task 3.3: 修復 `StatusGroup.vue`

確保群組正確渲染 Monitor：

```vue
<template>
  <div class="status-group mb-6">
    <h3 class="text-lg font-semibold mb-4">{{ group.name }}</h3>
    <div class="space-y-3">
      <template v-if="group.monitorList && group.monitorList.length > 0">
        <StatusMonitorCard
          v-for="(monitor, index) in group.monitorList"
          :key="monitor.id"
          :monitor="monitor"
          :edit-mode="editMode"
          :show-certificate-expiry="showCertificateExpiry"
          @remove="$emit('removeMonitor', index)"
        />
      </template>
      <div v-else class="text-center text-gray-400 py-4">
        No monitors in this group
      </div>
    </div>
  </div>
</template>
```

#### Task 3.4: 修復 `MonitorCard.vue`

確保 Monitor 卡片正確顯示：

```vue
<template>
  <div class="monitor-card bg-white dark:bg-gray-800 rounded-lg shadow p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <!-- Status Indicator -->
        <div 
          class="w-3 h-3 rounded-full"
          :class="statusClass"
        ></div>
        
        <!-- Monitor Name -->
        <span class="font-medium">{{ monitor.name }}</span>
      </div>
      
      <!-- Uptime -->
      <StatusUptime
        v-if="monitor.uptime24 !== undefined"
        :value="monitor.uptime24"
        type="24"
      />
    </div>
    
    <!-- Heartbeat Bar -->
    <StatusHeartbeatBar
      v-if="monitor.heartbeats && monitor.heartbeats.length > 0"
      :heartbeats="monitor.heartbeats"
      class="mt-3"
    />
  </div>
</template>
```

---

### Phase 4: 修復編輯模式 (Day 11-13)

#### Task 4.1: 修復 `StatusPageEditSidebar.vue`

**檔案**: `nuxtjs/components/status-page/EditSidebar.vue` (如果不存在則創建)

需要包含以下設定項目：
- Slug 編輯
- 標題編輯
- 描述編輯 (Markdown)
- 頁尾文字 (Markdown)
- 自動刷新間隔
- 主題選擇 (Auto/Light/Dark)
- 顯示標籤開關
- 顯示 Powered By 開關
- 顯示憑證到期開關
- 網域名稱列表
- Google Analytics ID
- 自訂 CSS (需要程式碼編輯器)
- 刪除按鈕

#### Task 4.2: 修復儲存功能

確保 `saveStatusPage()` 正確調用 PUT API：

```typescript
async function saveStatusPage() {
  try {
    saving.value = true
    
    const payload = {
      slug: draftConfig.value.slug,
      title: draftConfig.value.title,
      description: draftConfig.value.description,
      icon: draftConfig.value.icon,
      theme: draftConfig.value.theme,
      autoRefreshInterval: draftConfig.value.autoRefreshInterval,
      showTags: draftConfig.value.showTags,
      showPoweredBy: draftConfig.value.showPoweredBy,
      showCertificateExpiry: draftConfig.value.showCertificateExpiry,
      footerText: draftConfig.value.footerText,
      customCSS: draftConfig.value.customCSS,
      googleAnalyticsId: draftConfig.value.googleAnalyticsId,
      domainNameList: draftConfig.value.domainNameList,
      publicGroupList: draftGroups.value.map(g => ({
        id: g.id > 0 ? g.id : undefined, // 新群組用 undefined
        name: g.name,
        weight: g.weight,
        monitorList: g.monitorList.map(m => ({ 
          id: m.id,
          sendUrl: m.sendUrl 
        }))
      }))
    }

    const response = await $fetch(`/api/v1/status-pages/${slugRef.value}`, {
      method: 'PUT',
      body: payload
    })

    if (response.ok) {
      // 更新主狀態
      config.value = { ...draftConfig.value } as StatusPageConfig
      groups.value = draftGroups.value
      unsavedChanges.value = false
      return { success: true }
    }
    
    return { success: false, error: response.message }
  } catch (e) {
    return { success: false, error: e.message }
  } finally {
    saving.value = false
  }
}
```

#### Task 4.3: 修復事件 CRUD

**創建事件**:
```typescript
async function postIncident(incidentData: Incident) {
  const response = await $fetch(`/api/v1/status-pages/${slug}/incidents`, {
    method: 'POST',
    body: incidentData
  })
  // ...
}
```

**取消置頂**:
```typescript
async function unpinIncident() {
  const response = await $fetch(`/api/v1/status-pages/${slug}/incident`, {
    method: 'DELETE'
  })
  // ...
}
```

---

### Phase 5: 修復即時更新 (Day 14-15)

#### Task 5.1: 實作 WebSocket 心跳更新

目前使用輪詢方式，可考慮改用 WebSocket：

```typescript
// 選項 1: 保持輪詢 (目前實作)
function startAutoRefresh() {
  const interval = ((config.value?.autoRefreshInterval || 300) + 10) * 1000
  
  refreshInterval = setInterval(async () => {
    const monitorIds = groups.value.flatMap(g => g.monitorList.map(m => m.id))
    await loadHeartbeat(monitorIds)
  }, interval)
}

// 選項 2: 使用 WebSocket (進階)
function connectWebSocket() {
  const socket = useSocket()
  
  socket.on('heartbeat', (data: { monitorId: number, heartbeat: Heartbeat }) => {
    // 更新對應 monitor 的心跳
    for (const group of groups.value) {
      const monitor = group.monitorList.find(m => m.id === data.monitorId)
      if (monitor) {
        if (!monitor.heartbeats) monitor.heartbeats = []
        monitor.heartbeats.push(data.heartbeat)
        // 保持最多 100 筆
        if (monitor.heartbeats.length > 100) {
          monitor.heartbeats.shift()
        }
      }
    }
  })
}
```

---

### Phase 6: 測試與驗證 (Day 16-18)

#### Task 6.1: 功能測試清單

| 測試項目 | 預期結果 | 狀態 |
|----------|----------|------|
| 載入狀態頁 | 正確顯示標題、描述、Logo | ⬜ |
| 顯示群組 | 顯示所有群組及 Monitor | ⬜ |
| 顯示心跳 | 每個 Monitor 顯示心跳條 | ⬜ |
| 顯示 Uptime | 顯示 24h/30d uptime | ⬜ |
| 整體狀態 | 正確計算 All Up/Partial/Down | ⬜ |
| 事件顯示 | 顯示置頂事件 | ⬜ |
| 維護顯示 | 顯示維護提醒 | ⬜ |
| 編輯模式 | 可進入/退出編輯模式 | ⬜ |
| 儲存變更 | 可儲存設定變更 | ⬜ |
| 新增群組 | 可新增群組 | ⬜ |
| 刪除群組 | 可刪除群組 | ⬜ |
| 新增 Monitor | 可添加 Monitor 到群組 | ⬜ |
| 刪除 Monitor | 可從群組移除 Monitor | ⬜ |
| 拖曳排序 | 可拖曳排序群組/Monitor | ⬜ |
| 事件 CRUD | 可創建/編輯/刪除事件 | ⬜ |
| Logo 上傳 | 可上傳新 Logo | ⬜ |
| 自訂 CSS | CSS 正確套用 | ⬜ |
| 主題切換 | Auto/Light/Dark 正確切換 | ⬜ |
| 自動刷新 | 心跳定時更新 | ⬜ |
| 刪除頁面 | 可刪除狀態頁 | ⬜ |

#### Task 6.2: 跨瀏覽器測試

- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

#### Task 6.3: 響應式測試

- [ ] 桌面版 (1920px+)
- [ ] 筆電版 (1366px)
- [ ] 平板版 (768px)
- [ ] 手機版 (375px)

---

## 📁 需要修改/建立的檔案清單

### 🔴 Prisma Schema (最優先)

| 檔案 | 動作 | 優先序 | 說明 |
|------|------|--------|------|
| `prisma/schema.prisma` | 修改 | **P0** | 修正 StatusPageGroup 映射到 `group` 表 |
| `prisma/schema.prisma` | 修改 | **P0** | 修正 StatusPageMonitor 映射到 `monitor_group` 表 |
| `prisma/schema.prisma` | 修改 | **P0** | 添加 StatusPage 缺少的欄位 |
| `prisma/schema.prisma` | 修改 | **P0** | 添加 Incident 缺少的 `active` 欄位 |

### 後端 API

| 檔案 | 動作 | 優先序 |
|------|------|--------|
| `server/api/v1/status-pages/[slug]/monitors.get.ts` | 驗證 | P0 |
| `server/api/v1/status-pages/[slug]/heartbeat.get.ts` | 驗證 | P0 |
| `server/api/v1/status-pages/[slug]/index.put.ts` | 驗證 | P1 |
| `server/api/v1/status-pages/[slug]/incidents.post.ts` | 驗證 | P1 |
| `server/api/v1/status-pages/[slug]/incident.delete.ts` | 建立 | P1 |

### Composables

| 檔案 | 動作 | 優先序 |
|------|------|--------|
| `composables/usePublicStatusPage.ts` | 修復 | P0 |

### 頁面

| 檔案 | 動作 | 優先序 |
|------|------|--------|
| `pages/status/[slug].vue` | 修復 | P0 |

### 元件

| 檔案 | 動作 | 優先序 |
|------|------|--------|
| `components/status/PublicGroupList.vue` | 驗證/修復 | P0 |
| `components/status/StatusGroup.vue` | 驗證/修復 | P0 |
| `components/status/MonitorCard.vue` | 驗證/修復 | P0 |
| `components/status/HeartbeatBar.vue` | 驗證/修復 | P0 |
| `components/status/Uptime.vue` | 驗證/修復 | P1 |
| `components/status/OverallStatus.vue` | 驗證/修復 | P1 |
| `components/status/IncidentBanner.vue` | 驗證/修復 | P1 |
| `components/status-page/EditSidebar.vue` | 建立/修復 | P2 |
| `components/status-page/IncidentEditor.vue` | 建立 | P2 |

---

## 🚀 執行計劃

### Week 1: 資料庫修復與 API 驗證
- **Day 1-2: 修復 Prisma Schema (Phase 0.5)** 🔴 最優先
  - 修正 `@@map` 表名映射 (group, monitor_group)
  - 添加缺少的欄位 (autoRefreshInterval, showCertificateExpiry, etc.)
  - 重新生成 Prisma Client
  - 驗證 API 可正確取得資料
- Day 3-5: 修復 API 層 (Phase 1)
  - 驗證並修正 monitors.get.ts
  - 驗證並修正 heartbeat.get.ts
  - 確保資料格式一致性

### Week 2: 前端修復
- Day 6-7: 修復 Composable (Phase 2)
- Day 8-10: 修復前端元件 (Phase 3)

### Week 3: 編輯模式與測試
- Day 11-13: 修復編輯模式 (Phase 4)
- Day 14-15: 修復即時更新 (Phase 5)
- Day 16-18: 測試與驗證 (Phase 6)

---

## ✅ 完成標準

### 功能完整性 Checklist

- [ ] 公開狀態頁可正常顯示 (不需登入)
- [ ] 所有群組正確顯示
- [ ] 所有 Monitor 正確顯示
- [ ] 心跳條即時顯示
- [ ] Uptime 百分比正確顯示
- [ ] 整體狀態正確計算
- [ ] 事件橫幅正確顯示
- [ ] 維護提醒正確顯示
- [ ] 編輯模式可正常運作 (需登入)
- [ ] 儲存功能正常
- [ ] 刪除功能正常
- [ ] Logo 上傳正常
- [ ] 自訂 CSS 正常套用
- [ ] 主題切換正常
- [ ] 自動刷新正常運作

### 效能指標

- [ ] 首次載入 < 3 秒
- [ ] 心跳更新延遲 < 1 秒
- [ ] 100+ Monitor 不卡頓

---

## 📝 附錄: 快速除錯指令

```bash
# 檢查 Nuxt.js 開發伺服器
cd nuxtjs
npm run dev

# 檢查 API 回應
curl -s http://localhost:3001/api/v1/status-pages/test1/monitors | jq

# 檢查 Prisma 資料庫連線
npx prisma studio

# 重新生成 Prisma Client
npx prisma generate

# 同步資料庫 Schema
npx prisma db push
```

---

*計劃建立日期: 2026-01-25*
*預計完成時間: 3 週*
*優先序: P0 (關鍵功能)*
