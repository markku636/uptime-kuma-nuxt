// types/heartbeat.ts

export enum HeartbeatStatus {
  DOWN = 0,
  UP = 1,
  PENDING = 2,
  MAINTENANCE = 3,
}

export interface Heartbeat {
  id: bigint
  monitorId: number
  status: HeartbeatStatus
  time: Date
  msg?: string
  ping?: number
  important: boolean
  duration: number
}

export interface HeartbeatSummary {
  up: number
  down: number
  pending: number
  maintenance: number
  total: number
  avgPing: number
}
