# Nuxt.js Cluster 部署計劃

## 概述

本計劃參考 `docker-compose-bun-cluster.yaml` 的架構，為 Nuxt.js 專案建立一個支援多節點叢集的 Docker Compose 配置。

## 架構設計

```
                    ┌─────────────────┐
                    │   Client        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   OpenResty     │
                    │   Load Balancer │
                    │   (Port 32400)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐    ┌───────▼───────┐    ┌───────▼───────┐
│   Nuxt App1   │    │   Nuxt App2   │    │   Nuxt App3   │
│   (Port 32411)│    │   (Port 32412)│    │   (Port 32413)│
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   (Port 32402)  │
                    └─────────────────┘
```

## 功能特性

### 1. 負載均衡
- **輪詢模式 (Round Robin)**: 預設將請求平均分配到所有健康節點
- **手動節點選擇**: 使用者可透過 API 或 Cookie 指定特定節點
- **Session 親和性**: WebSocket 連接保持在同一節點

### 2. 健康檢查
- 每 10 秒檢查各節點 `/api/health` 端點
- 自動排除不健康的節點
- 健康狀態儲存在 OpenResty 共享記憶體

### 3. 節點管理 API
- `GET /api/cluster/nodes` - 取得所有節點狀態
- `GET /api/cluster/current` - 取得當前選擇的節點
- `POST /api/cluster/switch` - 切換節點

### 4. 擴展性
- 支援動態新增/移除節點 (修改配置後重啟)
- 支援 5 個節點的配置 (可擴展)

## 檔案結構

```
nuxtjs/
├── docker-compose-cluster.yaml    # 叢集 Docker Compose 配置
├── docker-compose.yml             # 現有的基本配置
├── Dockerfile                     # Nuxt.js 應用映像
├── nginx/
│   ├── Dockerfile                 # OpenResty 映像
│   ├── nginx.conf                 # Nginx 配置
│   └── lua/
│       ├── node_router.lua        # 節點路由邏輯
│       ├── health_checker.lua     # 健康檢查模組
│       └── cluster_api.lua        # 叢集管理 API
└── data/
    ├── node1/                     # Node 1 資料目錄
    ├── node2/                     # Node 2 資料目錄
    ├── node3/                     # Node 3 資料目錄
    ├── node4/                     # Node 4 資料目錄
    └── node5/                     # Node 5 資料目錄
```

## 環境變數

### 共用環境變數
| 變數名稱 | 說明 | 預設值 |
|---------|------|--------|
| `DATABASE_URL` | PostgreSQL 連線字串 | `postgresql://postgres:postgres@db:5432/uptime_kuma` |
| `JWT_SECRET` | JWT 密鑰 | (需設定) |
| `NUXT_PUBLIC_APP_URL` | 公開 URL | `http://localhost:32400` |

### 節點專屬環境變數
| 變數名稱 | 說明 |
|---------|------|
| `NODE_ID` | 節點識別碼 (node1, node2, ...) |
| `NODE_NAME` | 節點顯示名稱 |

## 使用方式

### 啟動叢集
```bash
docker-compose -f docker-compose-cluster.yaml up -d --build
```

### 停止叢集
```bash
docker-compose -f docker-compose-cluster.yaml down
```

### 查看日誌
```bash
# 查看所有服務
docker-compose -f docker-compose-cluster.yaml logs -f

# 查看特定節點
docker-compose -f docker-compose-cluster.yaml logs -f app1
```

### 擴展節點
```bash
# 啟動額外節點 (如果配置了 app4, app5)
docker-compose -f docker-compose-cluster.yaml up -d app4 app5
```

## API 使用範例

### 取得節點狀態
```http
GET http://localhost:32400/api/cluster/nodes

Response:
[
  { "id": "node1", "name": "Node 1", "healthy": true, "lastCheck": 1706186400 },
  { "id": "node2", "name": "Node 2", "healthy": true, "lastCheck": 1706186400 },
  { "id": "node3", "name": "Node 3", "healthy": false, "lastCheck": 1706186390 }
]
```

### 切換節點
```http
POST http://localhost:32400/api/cluster/switch
Content-Type: application/json

{ "node": "node1" }

Response:
{ "success": true, "node": "node1", "message": "Switched to node1" }
```

### 切換回自動模式
```http
POST http://localhost:32400/api/cluster/switch
Content-Type: application/json

{ "node": "auto" }
```

## 連接埠對照表

| 服務 | 內部埠 | 外部埠 |
|------|--------|--------|
| OpenResty | 80 | 32400 |
| Nuxt App 1 | 3000 | 32411 |
| Nuxt App 2 | 3000 | 32412 |
| Nuxt App 3 | 3000 | 32413 |
| Nuxt App 4 | 3000 | 32414 |
| Nuxt App 5 | 3000 | 32415 |
| PostgreSQL | 5432 | 32402 |

## 實作步驟

1. ✅ 建立計劃文件
2. ⬜ 建立 `docker-compose-cluster.yaml`
3. ⬜ 更新 OpenResty Dockerfile
4. ⬜ 增強 nginx.conf 配置
5. ⬜ 更新 node_router.lua
6. ⬜ 新增 health_checker.lua
7. ⬜ 新增 cluster_api.lua
8. ⬜ 測試部署

## 注意事項

1. **資料庫遷移**: 只需在 app1 執行一次，其他節點會跳過
2. **Session 共享**: 使用 PostgreSQL 儲存 session，確保跨節點一致性
3. **靜態資源**: 所有節點共享相同的靜態資源
4. **健康檢查**: 確保 `/api/health` 端點正確實作

## 故障排除

### 節點無法連接
```bash
# 檢查節點健康狀態
curl http://localhost:32400/api/cluster/nodes

# 直接測試節點
curl http://localhost:32411/api/health
```

### 資料庫連接問題
```bash
# 檢查資料庫容器
docker logs nuxt-kuma-postgres

# 測試連接
docker exec -it nuxt-kuma-postgres psql -U postgres -d uptime_kuma
```
