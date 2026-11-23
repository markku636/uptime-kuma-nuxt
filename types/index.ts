// types/index.ts

export * from './monitor'
export * from './heartbeat'
export * from './notification'
export * from './status-page'
export * from './socket'
export * from './cluster'

export interface Tag {
  id: number
  name: string
  color?: string
  value?: string
  workspaceId?: number
  createdAt?: Date
}

export interface User {
  id: number
  username: string
  active: boolean
  timezone: string
  twofaStatus: boolean
  createdAt: Date
}

export interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  message?: string
  error?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number
  page: number
  pageSize: number
  totalPages: number
}
