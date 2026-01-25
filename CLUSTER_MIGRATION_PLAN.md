# 多節點叢集功能遷移計劃

> 建立日期: 2026-01-25
> 最後更新: 2026-01-25
> 狀態: **Phase 1, 2 & 3 已完成** ✅

## 📊 遷移進度總覽

| 類別 | 原始檔案 | Nuxt.js 檔案 | 遷移狀態 |
|------|---------|-------------|---------|
| **環境偵測** | `server/util/cluster-env.js` | `server/utils/cluster-config.ts` | ✅ 完成 |
| **節點 Model/DB** | `server/model/node.js` | Prisma schema (Node) | ✅ 完成 |
| **節點生命週期** | `server/util/node-lifecycle.js` | `server/utils/node-initializer.ts` | ⚠️ 部分完成 |
| **Socket 處理器** | `server/socket-handlers/node-socket-handler.js` | `server/services/socket/index.ts` | ✅ **已完成** |
| **健康檢查** | `lua/health_check.lua` | `server/services/node-health-checker.ts` | ✅ 完成 |
| **動態節點發現** | `lua/dynamic_upstream.lua` | `server/services/dynamic-node-discovery.ts` | ✅ 完成 |
| **監控器分配** | `lua/middleware.lua` | `server/services/monitor-distributor.ts` | ✅ 完成 |
| **監控器調和** | `server/monitor-reconciler.js` | `server/jobs/reconcile-monitors.ts` | ✅ **已完成** |
| **API 端點** | ❌ 無 (僅 socket) | `server/api/cluster/*.ts` (3個) | ✅ **已完成** |
| **型別定義** | ❌ 無 | `types/cluster.ts` | ✅ 新增 |
| **Nginx/Lua 路由** | 5 個檔案 | 5 個檔案 | ✅ 完成 |

---

## ✅ 已完成遷移的功能

### 1. 叢集環境偵測
| 原始位置 | Nuxt.js 位置 | 說明 |
|---------|-------------|------|
| `server/util/cluster-env.js` | `server/utils/cluster-config.ts` | K8s/Docker Compose 環境偵測、節點主機名稱建構 |

### 2. 節點資料庫模型
| 原始位置 | Nuxt.js 位置 | 說明 |
|---------|-------------|------|
| `server/model/node.js` | `prisma/schema.prisma` (Node model) | 節點 CRUD 操作、心跳更新 |

### 3. 節點健康檢查
| 原始位置 | Nuxt.js 位置 | 說明 |
|---------|-------------|------|
| `lua/health_check.lua` | `server/services/node-health-checker.ts` (393行) | 節點健康監控、狀態更新、監控器重新分配 |

### 4. 動態節點發現
| 原始位置 | Nuxt.js 位置 | 說明 |
|---------|-------------|------|
| `lua/dynamic_upstream.lua` | `server/services/dynamic-node-discovery.ts` | 從 DB 取得線上節點、負載平衡選擇 |

### 5. 監控器分配與路由
| 原始位置 | Nuxt.js 位置 | 說明 |
|---------|-------------|------|
| `lua/middleware.lua` | `server/services/monitor-distributor.ts` (322行) | 監控器分配邏輯、節點選擇、hash 路由 |

### 6. 節點啟動初始化
| 原始位置 | Nuxt.js 位置 | 說明 |
|---------|-------------|------|
| `server/util/node-lifecycle.js` | `server/utils/node-initializer.ts` | 啟動時節點註冊 |
| - | `server/plugins/01-node-init.ts` | 伺服器啟動時初始化節點 |
| - | `server/plugins/04-node-health.ts` | 啟動健康檢查服務 |

### 7. 型別定義 (新增)
| Nuxt.js 位置 | 說明 |
|-------------|------|
| `types/cluster.ts` (192行) | 叢集、節點、健康檢查完整介面定義 |

### 8. REST API 端點 (新增)
| Nuxt.js 位置 | 說明 |
|-------------|------|
| `server/api/cluster/nodes.get.ts` | 取得叢集節點列表 |
| `server/api/cluster/current.get.ts` | 取得當前節點資訊 |
| `server/api/cluster/switch.post.ts` | 切換節點 |

---

## ✅ 已完成的遷移任務 (Phase 1 & 2)

### Task 1.1: 啟用 reconcile-monitors.ts 節點過濾 ✅

**檔案**: `server/jobs/reconcile-monitors.ts`

**變更內容**:
- 導入 `isClusterMode` 和 `getCurrentNodeId` 函式
- 在叢集模式下啟用節點過濾邏輯
- 只執行分配給當前節點的監控器

### Task 1.2: 修復 nodes.get.ts API ✅

**檔案**: `server/api/cluster/nodes.get.ts`

**變更內容**:
- 移除硬編碼的節點清單
- 改用 Prisma 查詢資料庫中的節點
- 增加監控器計數功能
- 保留即時健康檢查備援

### Task 2.1: 新增 Socket 節點事件處理器 ✅

**檔案**: `server/services/socket/index.ts`

**新增事件**:
- `subscribe_nodes` / `unsubscribe_nodes` - 訂閱節點更新
- `getNodeList` - 取得節點清單
- `addNode` - 新增節點
- `updateNode` - 更新節點
- `deleteNode` - 刪除節點

### Task 2.2: 新增廣播功能 ✅

**檔案**: `server/services/socket/index.ts`

**新增函式**:
- `emitNodeList()` - 廣播節點清單
- `emitNodeUpdate()` - 廣播單一節點更新
- `emitNodeStatusChange()` - 廣播節點狀態變更
- `emitNodeDelete()` - 廣播節點刪除

---

## ⚠️ 部分完成 - 後續改善

### 節點生命週期管理

**原始位置**: `server/util/node-lifecycle.js`

**Nuxt.js 位置**: `server/utils/node-initializer.ts`

**缺少的功能** (優先級: 低):
- `cleanupOfflineNodes()` - 定期清理離線節點
- `markStaleNodesOffline()` - 標記過期節點
- 定時清理排程器 (每 30 秒)

---

## 📋 剩餘任務清單

### Phase 3: 測試與驗證 ✅ 已完成

- [x] **Task 3.1**: 重新建構 Docker 叢集測試 - ✅ 完成
- [x] **Task 3.2**: 驗證節點 API 正確運作 - ✅ 測試通過
  - `/api/cluster/nodes` - 返回 `isPrimary`, `monitorCount`
  - `/api/cluster/current` - 返回當前節點資訊
  - `/api/health` - 返回節點健康狀態
- [x] **Task 3.3**: 驗證 reconcile-monitors job 運行 - ✅ 在日誌中確認

### Phase 4: 後續改善 (優先級: 低)

- [ ] **Task 4.1**: 新增節點清理排程器
- [ ] **Task 4.2**: 確認節點管理 UI 頁面完整

---

## 📁 正確的檔案對照表

### 原始後端 (server/)

| 檔案路徑 | 說明 | 遷移狀態 |
|---------|------|---------|
| `server/util/cluster-env.js` (271行) | 叢集環境偵測 | ✅ 完成 |
| `server/util/node-lifecycle.js` | 節點生命週期管理 | ⚠️ 部分 |
| `server/model/node.js` | 節點 ORM 模型 | ✅ 完成 |
| `server/socket-handlers/node-socket-handler.js` (149行) | Socket 節點處理 | ❌ 未遷移 |
| `server/monitor-reconciler.js` (60行) | 監控器調和 | ⚠️ 部分 |

### Lua 層 (lua/)

| 檔案路徑 | 說明 | 遷移狀態 |
|---------|------|---------|
| `lua/config.lua` | 叢集配置 | ✅ 完成 |
| `lua/db.lua` | 資料庫連線 | ✅ 完成 |
| `lua/dynamic_upstream.lua` | 動態節點發現 | ✅ 完成 |
| `lua/health_check.lua` (678行) | 健康檢查 | ✅ 完成 |
| `lua/middleware.lua` (534行) | 請求中間件/路由 | ✅ 完成 |
| `lua/logger.lua` | 日誌工具 | ✅ 完成 |

### Nuxt.js 後端 (nuxtjs/server/)

| 檔案路徑 | 說明 | 對應原始檔案 |
|---------|------|-------------|
| `server/utils/cluster-config.ts` | 叢集配置 | `cluster-env.js` |
| `server/utils/node-initializer.ts` | 節點初始化 | `node-lifecycle.js` |
| `server/services/node-health-checker.ts` (393行) | 健康檢查 | `health_check.lua` |
| `server/services/dynamic-node-discovery.ts` | 動態發現 | `dynamic_upstream.lua` |
| `server/services/monitor-distributor.ts` (322行) | 監控器分配 | `middleware.lua` |
| `server/jobs/reconcile-monitors.ts` (90行) | 監控器調和 | `monitor-reconciler.js` |
| `server/plugins/01-node-init.ts` | 節點初始化插件 | 新增 |
| `server/plugins/04-node-health.ts` | 健康檢查插件 | 新增 |
| `server/api/cluster/nodes.get.ts` | 節點列表 API | 新增 |
| `server/api/cluster/current.get.ts` | 當前節點 API | 新增 |
| `server/api/cluster/switch.post.ts` | 切換節點 API | 新增 |
| `server/services/socket/index.ts` (122行) | Socket 服務 | 部分對應 |
| `types/cluster.ts` (192行) | 型別定義 | 新增 |

---

## 🎯 下一步行動

### 立即處理 (Phase 1)
1. **啟用節點過濾** - 取消 `reconcile-monitors.ts` 第 26-35 行註解
2. **修復節點 API** - 改用 Prisma 查詢取代硬編碼

### 本週完成 (Phase 2)
3. **Socket 處理器遷移** - 在 `socket/index.ts` 加入節點事件

### 後續
4. 完整測試叢集功能
5. 更新部署文件

---

## 📝 備註

- 原始檔案路徑已修正 (之前寫錯了一些檔名)
- 所有 Nuxt.js 檔案路徑已驗證存在
- Monitor model 需確認有 `assignedNode` 和 `nodeId` 欄位才能啟用叢集過濾
