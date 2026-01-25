# OpenResty for Nuxt.js Cluster

此資料夾包含 Nuxt.js 叢集所需的 OpenResty (Nginx + Lua) 配置。

## 目錄結構

```
openresty/
├── Dockerfile              # 叢集版 Dockerfile (動態路由)
├── Dockerfile.basic        # 基本版 Dockerfile (固定三節點)
├── nginx.conf              # 叢集版 Nginx 配置
├── nginx-basic.conf        # 基本版 Nginx 配置
├── conf.d/                 # 額外的 Nginx 配置片段
│   └── README.md
└── lua/
    ├── cluster_router.lua  # 叢集動態路由模組
    └── node_router.lua     # 基本節點路由模組
```

## 使用方式

### 基本版 (3 節點固定配置)

使用 `docker-compose.yml`:

```bash
docker-compose up -d --build
```

- 使用 `Dockerfile.basic` 和 `nginx-basic.conf`
- 固定 3 個節點 (app1, app2, app3)
- 透過 Cookie 手動切換節點

### 叢集版 (動態節點配置)

使用 `docker-compose-cluster.yaml`:

```bash
docker-compose -f docker-compose-cluster.yaml up -d --build
```

- 使用 `Dockerfile` 和 `nginx.conf`
- 支援 1-5 個節點動態配置
- 透過環境變數 `CLUSTER_NODES` 配置節點
- 自動健康檢查和故障轉移
- 輪詢負載均衡

## API 端點

### 節點管理

| 端點 | 方法 | 說明 |
|------|------|------|
| `/api/cluster/nodes` | GET | 取得所有節點狀態 |
| `/api/cluster/current` | GET | 取得當前選擇的節點 |
| `/api/cluster/switch` | POST | 切換節點 |
| `/api/cluster/stats` | GET | 取得叢集統計資訊 (僅叢集版) |

### 健康檢查

| 端點 | 方法 | 說明 |
|------|------|------|
| `/health` | GET | OpenResty 健康狀態 |

## Lua 模組

### cluster_router.lua (叢集版)

功能:
- 從環境變數載入節點配置
- 定期健康檢查 (可設定間隔)
- 動態輪詢負載均衡
- Cookie 親和性支援
- 自動故障轉移

### node_router.lua (基本版)

功能:
- 固定 3 節點配置
- 定期健康檢查
- Cookie 親和性支援

## 環境變數

### 叢集版 (`docker-compose-cluster.yaml`)

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `CLUSTER_NODES` | 節點配置 (JSON 格式) | 預設 3 節點 |
| `HEALTH_CHECK_INTERVAL` | 健康檢查間隔 (秒) | 10 |
| `HEALTH_CHECK_TIMEOUT` | 健康檢查超時 (毫秒) | 5000 |

## 範例: 切換節點

```bash
# 切換到 node1
curl -X POST http://localhost:32400/api/cluster/switch \
  -H "Content-Type: application/json" \
  -d '{"node": "node1"}'

# 切換回自動模式
curl -X POST http://localhost:32400/api/cluster/switch \
  -H "Content-Type: application/json" \
  -d '{"node": "auto"}'
```

## 回應標頭

API 請求會在回應標頭中包含節點資訊:

- `X-Served-By`: 處理請求的節點 ID
