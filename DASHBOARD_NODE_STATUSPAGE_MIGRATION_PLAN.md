# Dashboard 列表排版、節點切換、Public Status Page 遷移計畫

> 建立日期: 2026-01-24
> 目的: 將原版 Uptime Kuma 的 Dashboard 列表排版、節點切換功能、Public Status Page 完整遷移至 Nuxt 版

---

## 📋 目錄

1. [Dashboard 列表排版遷移](#1-dashboard-列表排版遷移)
2. [節點切換功能遷移](#2-節點切換功能遷移)
3. [Public Status Page 遷移](#3-public-status-page-遷移)
4. [實作優先順序](#4-實作優先順序)

---

## 1. Dashboard 列表排版遷移

### 1.1 現況分析

**原版 Vue 版 (`src/pages/Dashboard.vue` + `src/components/MonitorList.vue`):**
```
┌────────────────────────────────────────────────────────┐
│                     Dashboard                           │
├─────────────────────┬──────────────────────────────────┤
│   Monitor List      │         Detail View              │
│  ┌───────────────┐  │  ┌────────────────────────────┐  │
│  │ [Select] 搜尋  │  │  │   Monitor 詳情 / Home     │  │
│  │ Show All Nodes │  │  │   Response Time Chart     │  │
│  ├───────────────┤  │  │   Heartbeat Bar           │  │
│  │ ▪ Monitor 1   │  │  │   Cert Info               │  │
│  │ ▪ Monitor 2   │  │  │   ...                     │  │
│  │ ▪ Monitor 3   │  │  └────────────────────────────┘  │
│  │ ...           │  │                                  │
│  └───────────────┘  │                                  │
│   (5 col / 12)      │         (7 col / 12)             │
└─────────────────────┴──────────────────────────────────┘
```

**Nuxt 版 (`nuxtjs/pages/dashboard/index.vue`):**
```
┌────────────────────────────────────────────────────────┐
│                     Dashboard                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Quick Stats: Up | Down | Maintenance | ...       │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Search + Filter                                  │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Important Events (Table)                         │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Monitors (Grid View / List View toggle)          │  │
│  │  ┌─────┐ ┌─────┐ ┌─────┐                        │  │
│  │  │Card1│ │Card2│ │Card3│ ...                    │  │
│  │  └─────┘ └─────┘ └─────┘                        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### 1.2 需遷移項目

| 功能 | 原版 | Nuxt 版 | 狀態 |
|------|------|---------|------|
| 左側 Monitor 列表面板 | ✅ `MonitorList.vue` | ❌ 缺少 | 🔴 待實作 |
| 右側詳情區域 | ✅ 嵌套路由 | ❌ 獨立頁面 | 🔴 待實作 |
| 列表項目 + Heartbeat Bar | ✅ `MonitorListItem.vue` | ✅ 部分存在 | 🟡 需完善 |
| Select 批次選擇模式 | ✅ 已實現 | ✅ 存在於 `MonitorListPanel` | 🟢 已有 |
| 列標題 (Monitor / Node / Status) | ✅ 已實現 | ❌ 缺少 | 🔴 待實作 |
| Grid/List 視圖切換 | ❌ 無 | ✅ 已實現 | 🟢 已有 |

### 1.3 實作計畫

#### Step 1: 調整 Dashboard 佈局

**修改 `pages/dashboard/index.vue`:**

```vue
<template>
  <div class="dashboard-container">
    <div class="row">
      <!-- 左側 Monitor 列表面板 (5/12) -->
      <div v-if="!isMobile" class="col-12 col-md-5 col-xl-4">
        <NuxtLink to="/monitors/add" class="btn btn-primary mb-3">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
          Add New Monitor
        </NuxtLink>
        <MonitorListPanel 
          :monitors="monitorsWithLiveData" 
          :show-all-nodes="showAllNodes"
          :current-node-id="currentNodeId"
          @toggle-show-all-nodes="toggleShowAllNodes"
          @open-node-switch="openNodeSwitchDialog"
        />
      </div>
      
      <!-- 右側詳情區域 (7/12) -->
      <div class="col-12 col-md-7 col-xl-8">
        <!-- 使用嵌套路由顯示 Monitor 詳情 -->
        <NuxtPage />
      </div>
    </div>
    
    <!-- Node Switch Dialog -->
    <NodeSwitchDialog 
      v-if="showNodeSwitchDialog"
      :nodes="lbNodes"
      :current-node="currentNodeId"
      :loading="lbLoading"
      :error="lbError"
      @switch-node="switchToNode"
      @clear-fixed-node="clearFixedNode"
      @close="showNodeSwitchDialog = false"
    />
  </div>
</template>
```

#### Step 2: 改進 MonitorListPanel 元件

**新增/修改 `components/dashboard/MonitorListPanel.vue`:**

```vue
<template>
  <div class="monitor-list-panel shadow-box">
    <!-- Header -->
    <div class="list-header">
      <div class="header-top">
        <button 
          class="btn btn-outline" 
          :class="{ active: selectMode }" 
          @click="selectMode = !selectMode"
        >
          Select
        </button>
        
        <!-- Node Toggle Section -->
        <div v-if="currentNodeId" class="node-toggle-section">
          <button class="btn btn-link btn-sm" @click="$emit('open-node-switch')">
            <small class="text-muted">
              Node: {{ showAllNodes ? 'All Nodes' : currentNodeId }}
            </small>
          </button>
          
          <div class="form-switch">
            <input 
              id="showAllNodes" 
              v-model="localShowAllNodes"
              type="checkbox"
              class="form-check-input"
              @change="$emit('toggle-show-all-nodes', localShowAllNodes)"
            />
            <label for="showAllNodes">
              <small>Show All Nodes</small>
            </label>
          </div>
        </div>
        
        <div class="search-wrapper">
          <UIcon name="i-heroicons-magnifying-glass" class="search-icon" />
          <input v-model="searchText" class="search-input" placeholder="Search..." />
        </div>
      </div>
      
      <!-- Column Headers -->
      <div class="column-headers">
        <div class="row">
          <div class="col-5"><small class="text-muted">Monitor</small></div>
          <div class="col-2 text-center"><small class="text-muted">Node</small></div>
          <div class="col-5"><small class="text-muted">Status</small></div>
        </div>
      </div>
    </div>
    
    <!-- Monitor List -->
    <div class="monitor-list scrollbar">
      <MonitorListItemSimple
        v-for="monitor in filteredMonitors"
        :key="monitor.id"
        :monitor="monitor"
        :select-mode="selectMode"
        :selected="selectedMonitors[monitor.id]"
        @toggle-select="toggleSelect(monitor.id)"
      />
    </div>
  </div>
</template>
```

#### Step 3: 改進 MonitorListItemSimple 元件

**修改 `components/dashboard/MonitorListItemSimple.vue`:**

需新增:
- Node 欄位顯示 (顯示 `monitor.nodeId` 或 `monitor.assignedNode`)
- Heartbeat bar 整合
- 群組折疊支援 (如果有 parent)

```vue
<template>
  <NuxtLink 
    :to="`/dashboard/monitors/${monitor.id}`"
    class="monitor-list-item"
    :class="{ 'selected': selected && selectMode }"
  >
    <div class="row align-items-center">
      <!-- 選擇框 -->
      <div v-if="selectMode" class="col-auto">
        <input 
          type="checkbox" 
          :checked="selected"
          @click.prevent.stop="$emit('toggle-select')"
        />
      </div>
      
      <!-- Monitor 名稱 + Status Icon -->
      <div class="col-5">
        <div class="d-flex align-items-center gap-2">
          <span :class="statusIndicatorClass"></span>
          <span class="monitor-name">{{ monitor.name }}</span>
        </div>
      </div>
      
      <!-- Node -->
      <div class="col-2 text-center">
        <small class="text-muted">{{ monitor.nodeId || '-' }}</small>
      </div>
      
      <!-- Heartbeat Bar -->
      <div class="col-5">
        <HeartbeatBarSimple :heartbeats="monitor.heartbeats" :size="50" />
      </div>
    </div>
  </NuxtLink>
</template>
```

#### Step 4: 新增嵌套路由

**新增 `pages/dashboard/monitors/[id].vue`:**

用於在 Dashboard 右側顯示 Monitor 詳情。

---

## 2. 節點切換功能遷移

### 2.1 現況分析

**原版功能 (`src/components/MonitorList.vue`):**
- 點擊 Node 標籤開啟節點切換對話框
- 顯示所有可用節點列表
- 顯示每個節點的 Monitor 數量
- 標記當前節點 (Current)
- 切換節點後重新載入頁面
- "Use Load Balancer (auto)" 清除固定節點

**OpenResty API 端點:**
```
GET  /lb/list-nodes          - 獲取節點列表
GET  /lb/fixed-node-status   - 獲取當前固定節點狀態
POST /lb/set-fixed-node      - 設定固定節點
GET  /lb/clear-fixed-node    - 清除固定節點
```

### 2.2 Nuxt 版實作狀態

| 功能 | 原版 | Nuxt 版 | 狀態 |
|------|------|---------|------|
| 節點列表 API | ✅ `/lb/list-nodes` | ✅ `/api/v1/nodes` | 🟢 已有 |
| 節點切換對話框 | ✅ `showNodeSwitchDialog` | ❌ 缺少 | 🔴 待實作 |
| 固定節點 Cookie | ✅ OpenResty 處理 | ❌ 缺少 | 🔴 待實作 |
| Header 節點顯示 | ✅ `$root.info.currentNodeId` | ❌ 缺少 | 🔴 待實作 |

### 2.3 實作計畫

#### Step 1: 新增 Node Switch Dialog 元件

**新增 `components/cluster/NodeSwitchDialog.vue`:**

```vue
<template>
  <div class="node-switch-backdrop" @click.self="$emit('close')">
    <div class="node-switch-modal">
      <div class="modal-header">
        <h5 class="modal-title">Select Node</h5>
        <button type="button" class="btn-close" @click="$emit('close')">×</button>
      </div>
      
      <div class="modal-body">
        <p class="mb-2 small text-muted">
          Choose which backend node OpenResty should route you to.
        </p>
        
        <div v-if="loading" class="text-center py-3">
          <span>Loading...</span>
        </div>
        
        <div v-else>
          <div v-if="error" class="alert alert-danger py-2 px-3 small">
            {{ error }}
          </div>
          
          <div v-if="nodes && nodes.length > 0">
            <button
              v-for="node in nodes"
              :key="node.id"
              type="button"
              class="btn w-100 mb-2 node-option-btn"
              :class="currentNode === node.nodeId ? 'btn-primary' : 'btn-outline-primary'"
              @click="$emit('switch-node', node.nodeId)"
            >
              <div class="d-flex justify-content-between align-items-center">
                <div>
                  <strong>{{ node.nodeId }}</strong>
                  <span v-if="currentNode === node.nodeId" class="badge bg-light text-dark ms-2">
                    Current
                  </span>
                </div>
                <small class="text-muted">
                  Monitors: {{ node.monitorCount || 0 }}
                </small>
              </div>
            </button>
          </div>
          
          <div v-else-if="!error" class="text-muted small">
            No nodes available from load balancer.
          </div>
        </div>
      </div>
      
      <div class="modal-footer d-flex justify-content-between">
        <button type="button" class="btn btn-outline-secondary btn-sm" @click="$emit('clear-fixed-node')">
          Use Load Balancer (auto)
        </button>
        <button type="button" class="btn btn-secondary btn-sm" @click="$emit('close')">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Node {
  id: number
  nodeId: string
  name: string
  url: string
  status: string
  monitorCount?: number
}

defineProps<{
  nodes: Node[]
  currentNode: string | null
  loading: boolean
  error: string | null
}>()

defineEmits<{
  (e: 'switch-node', nodeId: string): void
  (e: 'clear-fixed-node'): void
  (e: 'close'): void
}>()
</script>
```

#### Step 2: 新增 API 端點處理固定節點

**新增 `server/api/v1/cluster/set-fixed-node.post.ts`:**

```typescript
import { defineEventHandler, readBody, setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const { node } = await readBody(event)
  
  if (!node) {
    throw createError({
      statusCode: 400,
      message: 'Node ID is required'
    })
  }
  
  // 驗證節點存在
  const nodeExists = await prisma.clusterNode.findFirst({
    where: { nodeId: node, status: 'online' }
  })
  
  if (!nodeExists) {
    throw createError({
      statusCode: 404,
      message: `Node ${node} not found or offline`
    })
  }
  
  // 設定固定節點 Cookie
  setCookie(event, 'fixed_node', node, {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    httpOnly: false // 前端需要讀取
  })
  
  return { success: true, node }
})
```

**新增 `server/api/v1/cluster/clear-fixed-node.get.ts`:**

```typescript
import { defineEventHandler, deleteCookie } from 'h3'

export default defineEventHandler(async (event) => {
  deleteCookie(event, 'fixed_node', { path: '/' })
  return { success: true }
})
```

**新增 `server/api/v1/cluster/status.get.ts`:**

```typescript
import { defineEventHandler, getCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const fixedNode = getCookie(event, 'fixed_node')
  const currentNodeId = process.env.NODE_ID || 'node1'
  
  // 獲取所有節點及其 Monitor 數量
  const nodes = await prisma.clusterNode.findMany({
    where: { status: 'online' },
    select: {
      id: true,
      nodeId: true,
      name: true,
      url: true,
      status: true,
      isPrimary: true
    }
  })
  
  // 計算每個節點的 Monitor 數量
  const nodesWithCount = await Promise.all(
    nodes.map(async (node) => {
      const count = await prisma.monitor.count({
        where: { nodeId: node.nodeId }
      })
      return { ...node, monitorCount: count }
    })
  )
  
  return {
    currentNodeId,
    fixedNode: fixedNode || null,
    nodes: nodesWithCount
  }
})
```

#### Step 3: 新增 Composable

**新增 `composables/useClusterNode.ts`:**

```typescript
export function useClusterNode() {
  const currentNodeId = ref<string | null>(null)
  const fixedNode = ref<string | null>(null)
  const nodes = ref<any[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  const fetchClusterStatus = async () => {
    try {
      loading.value = true
      error.value = null
      
      const data = await $fetch('/api/v1/cluster/status')
      currentNodeId.value = data.currentNodeId
      fixedNode.value = data.fixedNode
      nodes.value = data.nodes
    } catch (e: any) {
      error.value = e.message || 'Failed to load cluster status'
    } finally {
      loading.value = false
    }
  }
  
  const switchToNode = async (nodeId: string) => {
    try {
      loading.value = true
      error.value = null
      
      await $fetch('/api/v1/cluster/set-fixed-node', {
        method: 'POST',
        body: { node: nodeId }
      })
      
      // 重新載入頁面以套用新節點
      window.location.reload()
    } catch (e: any) {
      error.value = e.message || 'Failed to switch node'
      throw e
    } finally {
      loading.value = false
    }
  }
  
  const clearFixedNode = async () => {
    try {
      loading.value = true
      error.value = null
      
      await $fetch('/api/v1/cluster/clear-fixed-node')
      
      // 重新載入頁面
      window.location.reload()
    } catch (e: any) {
      error.value = e.message || 'Failed to clear fixed node'
      throw e
    } finally {
      loading.value = false
    }
  }
  
  return {
    currentNodeId,
    fixedNode,
    nodes,
    loading,
    error,
    fetchClusterStatus,
    switchToNode,
    clearFixedNode
  }
}
```

---

## 3. Public Status Page 遷移

### 3.1 現況分析

**原版 Vue 版 (`src/pages/StatusPage.vue`):**
- 2338 行完整實現
- 包含編輯模式 sidebar
- 支援 Groups 管理
- 支援 Incidents 管理
- 支援 Custom CSS
- 支援 Domain Names 列表
- 支援 Google Analytics
- 支援 Uptime 計算 (24h, 30d, 1y)
- 即時 WebSocket 更新
- 響應式 Heartbeat bar

**Nuxt 版 (`nuxtjs/pages/status/[slug].vue`):**
- 379 行基礎實現
- ✅ 公開查看頁面
- ✅ WebSocket 即時更新
- ❌ 缺少編輯模式
- ❌ 缺少 Groups 管理
- ❌ 缺少 Incidents 完整管理
- ❌ 缺少 Custom CSS 編輯
- ❌ 缺少 Uptime 統計

### 3.2 需遷移項目

| 功能 | 原版 | Nuxt 版 | 狀態 |
|------|------|---------|------|
| 公開狀態頁面顯示 | ✅ | ✅ | 🟢 已有 |
| WebSocket 即時更新 | ✅ | ✅ | 🟢 已有 |
| 整體狀態 Banner | ✅ | ✅ | 🟢 已有 |
| Monitor 列表 | ✅ | ✅ 基礎版 | 🟡 需完善 |
| Heartbeat Bar (90天) | ✅ | ✅ 基礎版 | 🟡 需完善 |
| Groups 分組管理 | ✅ | ❌ | 🔴 待實作 |
| 編輯模式 Sidebar | ✅ | ❌ | 🔴 待實作 |
| Incidents 建立/編輯 | ✅ | ❌ 只有列表 | 🔴 待實作 |
| Custom CSS | ✅ | ✅ 套用 | 🟢 已有 |
| Custom CSS 編輯器 | ✅ | ❌ | 🔴 待實作 |
| Domain Names 管理 | ✅ | ❌ | 🔴 待實作 |
| Google Analytics | ✅ | ✅ | 🟢 已有 |
| Uptime % 計算 | ✅ (24h/30d/1y) | ❌ | 🔴 待實作 |
| Logo 上傳 | ✅ | ❌ | 🔴 待實作 |
| 主題切換 (Light/Dark/Auto) | ✅ | ❌ 使用系統主題 | 🟡 需實作 |
| Password 保護 | ✅ (Coming Soon) | ❌ | 📋 低優先 |

### 3.3 實作計畫

#### Step 1: 新增 Status Page 編輯路由

**建立目錄結構:**
```
pages/
  status-pages/
    [id]/
      index.vue     # 編輯頁面
      groups.vue    # Groups 管理
      incidents.vue # Incidents 管理
```

#### Step 2: 新增 Groups 管理功能

**資料庫 Schema (已有):**
```prisma
model StatusPageGroup {
  id           Int         @id @default(autoincrement())
  statusPageId Int
  name         String
  weight       Int         @default(0)
  statusPage   StatusPage  @relation(fields: [statusPageId], references: [id])
  monitors     StatusPageMonitor[]
}

model StatusPageMonitor {
  id        Int              @id @default(autoincrement())
  groupId   Int
  monitorId Int
  weight    Int              @default(0)
  group     StatusPageGroup  @relation(fields: [groupId], references: [id])
  monitor   Monitor          @relation(fields: [monitorId], references: [id])
}
```

**新增元件 `components/status-page/GroupManager.vue`:**

```vue
<template>
  <div class="group-manager">
    <div class="d-flex justify-content-between mb-3">
      <h4>Groups</h4>
      <button class="btn btn-primary btn-sm" @click="addGroup">
        <UIcon name="i-heroicons-plus" /> Add Group
      </button>
    </div>
    
    <draggable 
      v-model="groups" 
      item-key="id" 
      handle=".drag-handle"
      @end="updateGroupOrder"
    >
      <template #item="{ element: group }">
        <div class="group-item card mb-2">
          <div class="card-header d-flex align-items-center gap-2">
            <span class="drag-handle cursor-move">☰</span>
            <input 
              v-model="group.name" 
              class="form-control form-control-sm flex-grow-1"
              @blur="updateGroup(group)"
            />
            <button class="btn btn-outline-danger btn-sm" @click="deleteGroup(group.id)">
              <UIcon name="i-heroicons-trash" />
            </button>
          </div>
          <div class="card-body">
            <MonitorSelector 
              v-model="group.monitors"
              :available-monitors="availableMonitors"
              @update="updateGroupMonitors(group.id, $event)"
            />
          </div>
        </div>
      </template>
    </draggable>
  </div>
</template>
```

#### Step 3: 新增 Incidents 管理

**新增 `components/status-page/IncidentManager.vue`:**

```vue
<template>
  <div class="incident-manager">
    <div class="d-flex justify-content-between mb-3">
      <h4>Incidents</h4>
      <button class="btn btn-primary btn-sm" @click="createIncident">
        <UIcon name="i-heroicons-megaphone" /> Create Incident
      </button>
    </div>
    
    <div v-if="incidents.length === 0" class="text-muted">
      No incidents reported.
    </div>
    
    <div v-for="incident in incidents" :key="incident.id" class="incident-item card mb-2">
      <div class="card-body">
        <div class="d-flex justify-content-between">
          <div>
            <h5>{{ incident.title }}</h5>
            <p class="text-muted small">{{ incident.content }}</p>
          </div>
          <div class="btn-group">
            <button class="btn btn-outline btn-sm" @click="editIncident(incident)">
              Edit
            </button>
            <button 
              v-if="!incident.resolvedAt" 
              class="btn btn-success btn-sm" 
              @click="resolveIncident(incident.id)"
            >
              Resolve
            </button>
            <button class="btn btn-outline-danger btn-sm" @click="deleteIncident(incident.id)">
              Delete
            </button>
          </div>
        </div>
        <div class="d-flex gap-2 mt-2">
          <span :class="`badge bg-${incident.style}`">{{ incident.style }}</span>
          <small class="text-muted">Created: {{ formatDate(incident.createdAt) }}</small>
        </div>
      </div>
    </div>
    
    <!-- Incident Dialog -->
    <IncidentDialog 
      v-if="showDialog"
      :incident="editingIncident"
      :status-page-id="statusPageId"
      @save="saveIncident"
      @close="showDialog = false"
    />
  </div>
</template>
```

#### Step 4: 新增 Uptime 計算

**新增 `server/utils/uptime-calculator.ts`:**

```typescript
interface UptimeResult {
  uptime24h: number
  uptime30d: number
  uptime1y: number
  avgResponseTime24h: number
}

export async function calculateUptime(monitorId: number): Promise<UptimeResult> {
  const now = new Date()
  const h24Ago = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const d30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const y1Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  
  // 24 小時
  const beats24h = await prisma.heartbeat.findMany({
    where: { monitorId, time: { gte: h24Ago } },
    select: { status: true, ping: true }
  })
  
  const up24h = beats24h.filter(b => b.status === 1).length
  const uptime24h = beats24h.length > 0 ? (up24h / beats24h.length) * 100 : 0
  const avgPing = beats24h.filter(b => b.ping).reduce((a, b) => a + (b.ping || 0), 0) / beats24h.length
  
  // 30 天
  const beats30d = await prisma.heartbeat.findMany({
    where: { monitorId, time: { gte: d30Ago } },
    select: { status: true }
  })
  const up30d = beats30d.filter(b => b.status === 1).length
  const uptime30d = beats30d.length > 0 ? (up30d / beats30d.length) * 100 : 0
  
  // 1 年
  const beats1y = await prisma.heartbeat.findMany({
    where: { monitorId, time: { gte: y1Ago } },
    select: { status: true }
  })
  const up1y = beats1y.filter(b => b.status === 1).length
  const uptime1y = beats1y.length > 0 ? (up1y / beats1y.length) * 100 : 0
  
  return {
    uptime24h: Math.round(uptime24h * 100) / 100,
    uptime30d: Math.round(uptime30d * 100) / 100,
    uptime1y: Math.round(uptime1y * 100) / 100,
    avgResponseTime24h: Math.round(avgPing || 0)
  }
}
```

#### Step 5: 改進公開狀態頁面

**修改 `pages/status/[slug].vue`:**

需新增:
- Groups 分組顯示
- Uptime % 顯示
- Heartbeat bar tooltip 詳情
- 主題切換支援

---

## 4. 實作優先順序

### Phase 1: 節點切換功能 (高優先) ⏱️ 預估 4 小時

因為這是叢集部署的關鍵功能，且從截圖可見已有 UI 框架。

| 任務 | 預估時間 | 檔案 |
|------|----------|------|
| 1.1 新增 NodeSwitchDialog 元件 | 1h | `components/cluster/NodeSwitchDialog.vue` |
| 1.2 新增 API 端點 | 1h | `server/api/v1/cluster/*.ts` |
| 1.3 新增 useClusterNode composable | 0.5h | `composables/useClusterNode.ts` |
| 1.4 整合到 Dashboard | 1h | `pages/dashboard/index.vue` |
| 1.5 測試 | 0.5h | - |

### Phase 2: Dashboard 列表排版 (中優先) ⏱️ 預估 6 小時

| 任務 | 預估時間 | 檔案 |
|------|----------|------|
| 2.1 修改 Dashboard 佈局為左右分割 | 1.5h | `pages/dashboard/index.vue` |
| 2.2 改進 MonitorListPanel | 1.5h | `components/dashboard/MonitorListPanel.vue` |
| 2.3 改進 MonitorListItemSimple | 1h | `components/dashboard/MonitorListItemSimple.vue` |
| 2.4 新增嵌套路由 | 1h | `pages/dashboard/monitors/[id].vue` |
| 2.5 測試響應式設計 | 1h | - |

### Phase 3: Public Status Page 遷移 (中優先) ⏱️ 預估 10 小時

| 任務 | 預估時間 | 檔案 |
|------|----------|------|
| 3.1 新增 Groups 管理 | 2h | `components/status-page/GroupManager.vue` |
| 3.2 新增 Incidents 管理 | 2h | `components/status-page/IncidentManager.vue` |
| 3.3 新增 Uptime 計算 | 1.5h | `server/utils/uptime-calculator.ts` |
| 3.4 改進公開狀態頁面 | 2h | `pages/status/[slug].vue` |
| 3.5 新增編輯模式 Sidebar | 2h | `pages/status-pages/[id]/index.vue` |
| 3.6 測試 | 0.5h | - |

---

## 📁 新增檔案列表

```
nuxtjs/
├── components/
│   ├── cluster/
│   │   └── NodeSwitchDialog.vue          # 節點切換對話框
│   ├── dashboard/
│   │   └── MonitorListItemSimple.vue     # 改進版 (新增 Node 欄位)
│   └── status-page/
│       ├── GroupManager.vue              # Groups 管理
│       ├── IncidentManager.vue           # Incidents 管理
│       └── MonitorSelector.vue           # Monitor 選擇器
├── composables/
│   └── useClusterNode.ts                 # 叢集節點 composable
├── pages/
│   ├── dashboard/
│   │   ├── index.vue                     # 修改為左右分割
│   │   └── monitors/
│   │       └── [id].vue                  # Monitor 詳情嵌套頁
│   └── status-pages/
│       └── [id]/
│           ├── index.vue                 # 編輯主頁
│           ├── groups.vue                # Groups 管理頁
│           └── incidents.vue             # Incidents 管理頁
└── server/
    ├── api/v1/cluster/
    │   ├── status.get.ts                 # 叢集狀態
    │   ├── set-fixed-node.post.ts        # 設定固定節點
    │   └── clear-fixed-node.get.ts       # 清除固定節點
    └── utils/
        └── uptime-calculator.ts          # Uptime 計算工具
```

---

## ✅ 完成檢查清單

### Phase 1: 節點切換
- [ ] NodeSwitchDialog 元件已建立
- [ ] API 端點已實現
- [ ] Cookie 固定節點功能運作
- [ ] Dashboard 可開啟節點切換對話框
- [ ] 切換節點後頁面重新載入

### Phase 2: Dashboard 列表
- [ ] 左側 Monitor 列表面板
- [ ] 右側詳情區域 (嵌套路由)
- [ ] 列標題 (Monitor / Node / Status)
- [ ] Heartbeat bar 正常顯示
- [ ] 響應式設計 (手機版全寬)

### Phase 3: Public Status Page
- [ ] Groups 分組顯示
- [ ] Groups 管理 (CRUD + 拖拉排序)
- [ ] Incidents 建立/編輯/解決
- [ ] Uptime % 顯示 (24h/30d/1y)
- [ ] 編輯模式 Sidebar

---

## 🔗 相關文件

- [FEATURE_COMPARISON_PLAN.md](./FEATURE_COMPARISON_PLAN.md) - 功能比較總表
- [MIGRATION_CHECKLIST.md](./MIGRATION_CHECKLIST.md) - 遷移檢查清單
- [原版 MonitorList.vue](../src/components/MonitorList.vue) - 參考實現
- [原版 StatusPage.vue](../src/pages/StatusPage.vue) - 參考實現
