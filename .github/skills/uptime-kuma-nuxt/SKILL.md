# SealWatch Nuxt - Copilot Skill

## 專案概述

這是使用 **Nuxt.js 4** 重構的 SealWatch 監控系統，支援高可用集群架構。

### 核心技術棧

| 層級 | 技術 |
|:---|:---|
| 框架 | Nuxt.js 4 (Vue 3) |
| 資料庫 | PostgreSQL (Prisma ORM) |
| 狀態管理 | Pinia |
| UI 元件 | Nuxt UI 4 |
| 負載均衡 | OpenResty (Nginx + Lua) |
| 容器化 | Docker Compose |
| 國際化 | @nuxtjs/i18n |

---

## 目錄結構速查

```
nuxtjs/
├── pages/                  # 頁面路由
│   ├── index.vue          # 首頁
│   ├── login.vue          # 登入頁
│   ├── dashboard/         # 儀表板頁面
│   └── settings.vue       # 設定頁
├── components/             # Vue 組件
│   ├── monitor/           # 監控相關組件
│   ├── dashboard/         # 儀表板組件
│   ├── status-page/       # 狀態頁面組件
│   ├── notification/      # 通知組件
│   └── common/            # 共用組件
├── composables/            # Vue Composables
│   ├── useMonitors.ts     # 監控邏輯
│   ├── useAuth.ts         # 認證邏輯
│   └── useSocket.ts       # WebSocket
├── stores/                 # Pinia 狀態管理
│   ├── monitor.ts         # 監控狀態
│   └── ui.ts              # UI 狀態
├── server/                 # Nuxt 伺服器端
│   ├── api/               # API 端點
│   │   ├── v1/            # RESTful API v1
│   │   ├── auth/          # 認證 API
│   │   └── cluster/       # 集群 API
│   ├── services/          # 業務邏輯
│   │   ├── monitor/       # 監控服務
│   │   └── notification/  # 通知服務
│   ├── jobs/              # 背景排程
│   └── middleware/        # 中介軟體
├── prisma/                 # Prisma ORM
│   ├── schema.prisma      # 資料庫 Schema
│   └── seed.ts            # 種子資料
├── nginx/                  # OpenResty 配置
│   ├── nginx.conf         # Nginx 配置
│   └── lua/               # Lua 腳本
├── layouts/                # 頁面佈局
├── locales/                # 國際化語言檔
└── assets/                 # 靜態資源
```

---

## 開發指引

### 啟動方式

#### Docker 集群模式（推薦）
```powershell
docker compose up -d --build
```

#### 單機開發模式
```powershell
# 安裝依賴
npm install

# 生成 Prisma Client
npm run db:generate

# 同步資料庫
npm run db:push

# 啟動開發伺服器
npm run dev
```

### 環境變數

| 變數 | 說明 | 範例 |
|:---|:---|:---|
| `DATABASE_URL` | PostgreSQL 連線 | `postgresql://user:pass@localhost:5432/db` |
| `JWT_SECRET` | JWT 密鑰 | `your-secret-key` |
| `NUXT_PUBLIC_APP_URL` | 公開 URL | `http://localhost:32400` |
| `NUXT_SESSION_PASSWORD` | Session 密碼 | `random-32-char-string` |
| `NODE_ID` | 節點 ID（集群） | `node1` |
| `IS_PRIMARY` | 是否主節點 | `true` |

---

## 常見開發任務

### 1. 新增 API 端點

檔案位置：`server/api/v1/`

```typescript
// server/api/v1/my-endpoint.get.ts
export default defineEventHandler(async (event) => {
    // 取得認證使用者
    const session = await requireUserSession(event)
    
    // 實作邏輯
    return {
        success: true,
        data: {}
    }
})
```

### 2. 新增 Composable

檔案位置：`composables/`

```typescript
// composables/useMyFeature.ts
export function useMyFeature() {
    const data = ref([])
    
    const fetchData = async () => {
        data.value = await $fetch('/api/v1/my-endpoint')
    }
    
    return {
        data,
        fetchData
    }
}
```

### 3. 新增組件

檔案位置：`components/`

```vue
<!-- components/my-feature/MyComponent.vue -->
<template>
    <UCard>
        <template #header>{{ title }}</template>
        <slot />
    </UCard>
</template>

<script setup lang="ts">
defineProps<{
    title: string
}>()
</script>
```

### 4. 新增服務

檔案位置：`server/services/`

```typescript
// server/services/my-service.ts
import { prisma } from '~/server/utils/prisma'

export class MyService {
    async getData() {
        return await prisma.myModel.findMany()
    }
}
```

### 5. 資料庫變更

```powershell
# 1. 修改 prisma/schema.prisma
# 2. 同步到資料庫
npm run db:push

# 3. 重新生成 Client
npm run db:generate
```

---

## API 端點速查

### 認證 API
| 端點 | 說明 |
|:---|:---|
| `POST /api/auth/login` | 登入 |
| `POST /api/auth/logout` | 登出 |
| `GET /api/auth/session` | 取得 Session |

### 集群 API
| 端點 | 說明 |
|:---|:---|
| `GET /api/cluster/nodes` | 節點列表 |
| `GET /api/cluster/current` | 當前節點 |
| `POST /api/cluster/switch` | 切換節點 |

### RESTful API v1
| 端點 | 說明 |
|:---|:---|
| `GET /api/v1/monitors` | 監控列表 |
| `POST /api/v1/monitors` | 建立監控 |
| `GET /api/v1/monitors/:id` | 取得監控 |
| `PUT /api/v1/monitors/:id` | 更新監控 |
| `DELETE /api/v1/monitors/:id` | 刪除監控 |
| `GET /api/v1/notifications` | 通知列表 |
| `GET /api/v1/status-pages` | 狀態頁面 |
| `GET /api/health` | 健康檢查 |

---

## 測試

### API 測試
使用 VS Code REST Client 開啟 `api-test.http`

---

## 程式碼風格

- 使用 TypeScript
- 遵循 Vue 3 Composition API
- 使用 Nuxt UI 元件庫
- 後端使用 async/await
- Prisma 處理資料庫操作

---

## 注意事項

1. **資料庫**：使用 PostgreSQL，透過 Prisma ORM 操作
2. **認證**：使用 nuxt-auth-utils 處理認證
3. **集群**：只有 `IS_PRIMARY=true` 的節點負責背景任務
4. **Lua 模組**：修改後需重啟 OpenResty 容器
