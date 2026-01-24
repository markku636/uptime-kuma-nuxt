# Nuxt.js + OpenResty 叢集架構規劃

## ✅ 實作完成

## 目標
建立類似 Vue + Node 版本的叢集架構，支援：
1. **OpenResty 負載均衡/反向代理** - 處理請求路由與節點切換
2. **節點切換功能** - 可透過 `/dashboard` 介面手動切換連接的節點
3. **虛擬捲軸 (Virtual Scroll)** - 監控清單使用虛擬捲軸優化大量資料渲染

## 架構圖

```
                    ┌─────────────────────┐
                    │     Client          │
                    │  localhost:32400    │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     OpenResty       │
                    │    (Port 32400)     │
                    │  - 負載均衡         │
                    │  - 節點切換 API     │
                    │  - WebSocket 支援   │
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼─────────┐ ┌───────▼────────┐ ┌─────────▼─────────┐
│   Nuxt App 1      │ │   Nuxt App 2   │ │   Nuxt App 3      │
│   (Port 3001)     │ │   (Port 3002)  │ │   (Port 3003)     │
└─────────┬─────────┘ └───────┬────────┘ └─────────┬─────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    PostgreSQL       │
                    │    (Port 32402)     │
                    └─────────────────────┘
```

## 檔案結構

```
nuxtjs/
├── docker-compose.yml          # 更新：加入 OpenResty 和多節點
├── nginx/
│   ├── nginx.conf              # OpenResty 主配置
│   ├── Dockerfile              # OpenResty Dockerfile
│   └── lua/
│       ├── config.lua          # 配置
│       └── node_router.lua     # 節點路由邏輯
├── components/
│   └── monitor/
│       └── VirtualMonitorList.vue  # 虛擬捲軸列表組件
├── server/
│   └── api/
│       └── nodes/
│           ├── index.get.ts    # 取得節點列表
│           ├── current.get.ts  # 取得當前節點
│           └── switch.post.ts  # 切換節點
└── composables/
    └── useVirtualScroll.ts     # 虛擬捲軸 composable
```

## 1. Docker Compose 配置

### 服務列表
| 服務 | 映像 | Port | 說明 |
|------|------|------|------|
| openresty | 自建 | 32400:80 | 負載均衡/反向代理 |
| app1 | nuxt-kuma | 32411:3000 | Nuxt 節點 1 |
| app2 | nuxt-kuma | 32412:3000 | Nuxt 節點 2 |
| app3 | nuxt-kuma | 32413:3000 | Nuxt 節點 3 |
| db | postgres:16 | 32402:5432 | PostgreSQL 資料庫 |

## 2. OpenResty 功能

### 2.1 節點切換 API
- `GET /api/nodes` - 取得所有節點狀態
- `GET /api/nodes/current` - 取得當前連接的節點
- `POST /api/nodes/switch` - 切換到指定節點

### 2.2 請求路由
- 使用 Cookie 或 Header 記住用戶選擇的節點
- WebSocket 連線保持在同一節點
- 支援 Session Sticky

## 3. 虛擬捲軸實作

### 3.1 使用 @vueuse/virtual
```bash
yarn add @vueuse/core
```

### 3.2 VirtualMonitorList 組件
- 只渲染可見區域的項目
- 支援動態高度
- 支援搜尋和篩選

## 實作步驟

### Phase 1: Docker Compose 更新
1. ✅ 建立 OpenResty Dockerfile
2. ✅ 建立 nginx.conf
3. ✅ 更新 docker-compose.yml

### Phase 2: 節點切換功能
1. ⬜ 建立節點管理 API
2. ⬜ 建立 Lua 路由模組
3. ⬜ Dashboard 加入節點切換 UI

### Phase 3: 虛擬捲軸
1. ⬜ 安裝 @vueuse/core
2. ⬜ 建立 VirtualMonitorList 組件
3. ⬜ 整合到 Dashboard 頁面

---

## 快速開始

```bash
# 安裝依賴 (需要新增 @vueuse)
yarn add @vueuse/core @vueuse/nuxt

# 啟動叢集 (3 節點 + OpenResty)
cd nuxtjs
docker-compose up -d --build

# 或單節點開發模式
docker-compose -f docker-compose.single.yml up -d --build

# 存取
http://localhost:32400/dashboard
```

## 已建立的檔案

### Docker 配置
- `docker-compose.yml` - 叢集配置 (OpenResty + 3 Nuxt 節點)
- `docker-compose.single.yml` - 單節點開發配置

### OpenResty
- `nginx/Dockerfile` - OpenResty 映像
- `nginx/nginx.conf` - Nginx 配置 (含節點切換 API)
- `nginx/lua/node_router.lua` - 節點路由 Lua 模組

### 節點切換 UI
- `components/common/NodeSelector.vue` - 節點選擇器組件 (已加到 Header)
- `server/api/health.get.ts` - 健康檢查 API
- `server/api/node-info.get.ts` - 節點資訊 API

### 虛擬捲軸
- `components/monitor/VirtualMonitorList.vue` - 虛擬捲軸列表組件

## 節點切換 API

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/cluster/nodes` | GET | 取得所有節點狀態 |
| `/api/cluster/current` | GET | 取得當前選擇的節點 |
| `/api/cluster/switch` | POST | 切換節點 `{"node": "node1\|node2\|node3\|auto"}` |

## 使用虛擬捲軸

```vue
<template>
  <MonitorVirtualMonitorList
    :monitors="monitors"
    :loading="loading"
    :item-height="72"
    :container-height="600"
    @select="handleSelect"
  />
</template>
```
