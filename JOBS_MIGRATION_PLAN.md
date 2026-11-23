# NuxtJS Jobs 遷移計劃

## 📋 概述

原版 SealWatch (`server/jobs.js`) 定義了 3 個背景定時任務，需要遷移到 NuxtJS 版本。

---

## 📊 遷移狀態總覽

| Job 名稱 | Cron 間隔 | 功能說明 | 遷移狀態 | 優先級 |
|---------|----------|---------|---------|-------|
| `clear-old-data` | `14 03 * * *` (每天凌晨 3:14) | 清理過期的 heartbeat 和 stat_daily 資料 | ❌ **需遷移** | 🔴 高 |
| `incremental-vacuum` | `*/5 * * * *` (每 5 分鐘) | SQLite 專用的資料庫優化 | ✅ **不需要** | - |
| `reconcile-monitors` | `*/1 * * * *` (每 1 分鐘) | 叢集模式下同步 monitor 狀態 | ⚠️ **評估中** | 🟡 中 |

---

## 🔴 Job 1: clear-old-data（高優先級）

### 原版功能分析 (`server/jobs/clear-old-data.js`)

```javascript
// 執行時間：每天凌晨 3:14
// 功能：
// 1. 呼叫 Database.clearHeartbeatData() - 清理記憶體中的 heartbeat 資料
// 2. 讀取 keepDataPeriodDays 設定（預設 365 天）
// 3. 刪除超過保留期限的 heartbeat 記錄
// 4. 刪除超過保留期限的 stat_daily 記錄
// 5. SQLite: 執行 PRAGMA optimize
```

### NuxtJS 遷移細節

#### 需要處理的資料表

| 資料表 | NuxtJS Prisma Model | 刪除條件 |
|-------|---------------------|---------|
| `heartbeat` | ✅ `Heartbeat` | `time < NOW() - keepDataPeriodDays` |
| `stat_daily` | ❌ **不存在** | 需確認是否需要新增 |

#### 設定項目

- **設定 key**: `keepDataPeriodDays`
- **NuxtJS 預設值**: `180` (從 `prisma/seed.ts` 確認)
- **原版預設值**: `365`
- **儲存位置**: `Setting` model

### 遷移步驟

1. **建立 Job 目錄結構**
   ```
   nuxtjs/server/jobs/
   ├── index.ts           # Job 管理器（使用 croner）
   └── clear-old-data.ts  # 清理舊資料 Job
   ```

2. **實作 clear-old-data.ts**
   ```typescript
   // 使用 Prisma 執行刪除
   import { prisma } from '../utils/prisma'
   
   export async function clearOldData() {
     // 1. 讀取 keepDataPeriodDays 設定
     const setting = await prisma.setting.findUnique({
       where: { key: 'keepDataPeriodDays' }
     })
     const keepDays = parseInt(setting?.value || '180')
     
     if (keepDays < 1) {
       console.log('[ClearOldData] Data deletion disabled')
       return
     }
     
     // 2. 計算刪除時間點
     const cutoffDate = new Date()
     cutoffDate.setDate(cutoffDate.getDate() - keepDays)
     
     // 3. 刪除過期 heartbeat
     const result = await prisma.heartbeat.deleteMany({
       where: {
         time: { lt: cutoffDate }
       }
     })
     
     console.log(`[ClearOldData] Deleted ${result.count} old heartbeats`)
   }
   ```

3. **修改 `server/plugins/00-database.ts`**
   - 在初始化後啟動 Job scheduler

---

## 🟡 Job 2: reconcile-monitors（中優先級）

### 原版功能分析 (`server/monitor-reconciler.js`)

```javascript
// 執行時間：每 1 分鐘
// 功能：叢集模式下同步 monitor 狀態
// 1. 根據 UPTIME_KUMA_NODE_ID 或 NODE_ID 環境變數判斷當前節點
// 2. 查詢應該由當前節點執行的 monitors（assigned_node 或 node_id 匹配）
// 3. 啟動新分配的 monitors
// 4. 停止不再屬於當前節點的 monitors
```

### NuxtJS 現況分析

**目前 `scheduler.ts` 的問題：**

1. ❌ 只在啟動時載入 monitors，**不會動態更新**
2. ❌ 沒有支援 `assigned_node` 或 `node_id` 欄位
3. ❌ 無法在叢集模式下正確分配 monitors

**需要確認的問題：**

- 是否需要支援叢集模式？
- `Monitor` Prisma model 是否需要新增 `assignedNode` / `nodeId` 欄位？

### 現有 Monitor Model 欄位

```prisma
model Monitor {
  id              Int       @id @default(autoincrement())
  name            String
  active          Boolean   @default(true)
  // ... 其他欄位
  // ❌ 缺少 assignedNode
  // ❌ 缺少 nodeId
}
```

### 現有 Node Model

```prisma
model Node {
  id           Int       @id @default(autoincrement())
  nodeId       String    @unique @map("node_id")
  nodeName     String    @map("node_name")
  status       String    @default("unknown")
  active       Boolean   @default(true)
  isPrimary    Boolean   @default(false)
  // ...
}
```

### 遷移決策

#### 選項 A: 簡化版（單節點模式）

如果不需要叢集支援，只需增加動態監控更新：

```typescript
// 每分鐘檢查 DB 變化，同步 monitor 狀態
export async function reconcileMonitors() {
  const activeMonitors = await prisma.monitor.findMany({
    where: { active: true }
  })
  
  const desiredIds = new Set(activeMonitors.map(m => m.id))
  const runningIds = new Set(jobs.keys())
  
  // 啟動新的
  for (const monitor of activeMonitors) {
    if (!runningIds.has(monitor.id)) {
      startMonitorJob(monitor)
    }
  }
  
  // 停止移除的
  for (const id of runningIds) {
    if (!desiredIds.has(id)) {
      stopMonitorJob(id)
    }
  }
}
```

#### 選項 B: 完整版（叢集模式）

需要：
1. 新增 Monitor 欄位：`assignedNode`, `nodeId`
2. 實作完整的節點分配邏輯
3. 處理節點故障轉移

---

## 📝 實作計劃

### Phase 1: 基礎架構（建議先完成）

1. **建立 Job 管理系統**
   - 使用 `croner` 套件（已在 yarn.lock 中）
   - 建立統一的 Job 註冊與管理機制

2. **檔案結構**
   ```
   nuxtjs/server/
   ├── jobs/
   │   ├── index.ts              # Job manager (croner)
   │   ├── clear-old-data.ts     # 清理舊資料
   │   └── reconcile-monitors.ts # 同步 monitors (選用)
   ├── plugins/
   │   └── 00-database.ts        # 修改：新增 initBackgroundJobs()
   ```

### Phase 2: 實作 clear-old-data

1. 建立 `jobs/clear-old-data.ts`
2. 整合到 Job manager
3. 測試刪除功能

### Phase 3: 實作 reconcile-monitors（可選）

根據是否需要叢集支援決定實作方式：

- **不需叢集**: 實作簡化版，只同步 active 狀態變化
- **需要叢集**: 擴展 Prisma schema，實作完整版

---

## 🔧 技術細節

### 使用 Croner 套件

```typescript
// jobs/index.ts
import Cron from 'croner'
import { clearOldData } from './clear-old-data'
import { reconcileMonitors } from './reconcile-monitors'

interface Job {
  name: string
  interval: string
  handler: () => Promise<void>
  instance?: Cron
}

const jobs: Job[] = [
  {
    name: 'clear-old-data',
    interval: '14 03 * * *',  // 每天凌晨 3:14
    handler: clearOldData
  },
  {
    name: 'reconcile-monitors',
    interval: '*/1 * * * *',  // 每分鐘
    handler: reconcileMonitors
  }
]

export async function initBackgroundJobs() {
  const timezone = 'UTC' // 或從設定讀取
  
  for (const job of jobs) {
    job.instance = new Cron(
      job.interval,
      { name: job.name, timezone },
      job.handler
    )
    console.log(`[Jobs] Started: ${job.name}`)
  }
}

export function stopBackgroundJobs() {
  for (const job of jobs) {
    if (job.instance) {
      job.instance.stop()
      console.log(`[Jobs] Stopped: ${job.name}`)
    }
  }
}
```

### PostgreSQL vs SQLite 差異

| 功能 | SQLite (原版) | PostgreSQL (NuxtJS) |
|-----|--------------|---------------------|
| 時間計算 | `DATETIME('now', '-N hours')` | `NOW() - INTERVAL 'N days'` |
| 優化 | `PRAGMA optimize` | `VACUUM` (通常自動) |
| WAL | 需手動 checkpoint | 自動管理 |

---

## ✅ 待辦事項清單

- [ ] 確認是否需要叢集模式支援
- [ ] 建立 `jobs/` 目錄結構
- [ ] 實作 `jobs/index.ts` (Job manager)
- [ ] 實作 `jobs/clear-old-data.ts`
- [ ] 修改 `plugins/00-database.ts` 啟動 Jobs
- [ ] (選用) 實作 `jobs/reconcile-monitors.ts`
- [ ] (選用) 擴展 `Monitor` model 支援 `assignedNode`
- [ ] 測試 Job 執行
- [ ] 確認 `stat_daily` 是否需要新增

---

## 📚 參考資源

- 原版 Jobs: `server/jobs.js`, `server/jobs/*.js`
- 原版 Reconciler: `server/monitor-reconciler.js`
- NuxtJS Scheduler: `nuxtjs/server/services/monitor/scheduler.ts`
- Croner 文件: https://github.com/hexagon/croner
