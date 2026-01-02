// types/socket.ts

export enum SocketEvent {
  // Client -> Server
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  SUBSCRIBE_MONITORS = 'subscribe_monitors',
  UNSUBSCRIBE_MONITORS = 'unsubscribe_monitors',
  SUBSCRIBE_STATUS_PAGE = 'subscribe_status_page',
  UNSUBSCRIBE_STATUS_PAGE = 'unsubscribe_status_page',

  // Server -> Client
  HEARTBEAT = 'heartbeat',
  HEARTBEAT_LIST = 'heartbeat_list',
  MONITOR_LIST = 'monitor_list',
  MONITOR_UPDATE = 'monitor_update',
  MONITOR_DELETE = 'monitor_delete',
  UPTIME_LIST = 'uptime_list',
  IMPORTANT_HEARTBEAT_LIST = 'important_heartbeat_list',
  AVG_PING = 'avg_ping',
  STATUS_PAGE_LIST = 'status_page_list',
  STATUS_PAGE_UPDATE = 'status_page_update',
  INCIDENT_UPDATE = 'incident_update',
  AUTO_LOGIN = 'auto_login',
  INFO = 'info',
}

export interface SocketMessage<T = unknown> {
  event: SocketEvent
  data: T
}

export interface HeartbeatMessage {
  monitorId: number
  heartbeat: {
    status: number
    time: string
    msg?: string
    ping?: number
    duration: number
  }
}

export interface MonitorListMessage {
  monitors: Array<{
    id: number
    name: string
    type: string
    active: boolean
    status: number
  }>
}

export interface UptimeMessage {
  monitorId: number
  period: '24h' | '7d' | '30d' | '1y'
  uptime: number
}
