// server/services/socket/index.ts
import { Server as SocketServer, Socket } from 'socket.io'
import type { H3Event } from 'h3'

let io: SocketServer | null = null

export function getSocketServer(): SocketServer | null {
  return io
}

export function initSocketServer(server: any): SocketServer {
  if (io) {
    return io
  }

  io = new SocketServer(server, {
    cors: {
      origin: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    // Handle authentication
    socket.on('authenticate', async (data: { token?: string }) => {
      // Implement token validation here if needed
      socket.emit('authenticated', { ok: true })
    })

    // Subscribe to monitor updates
    socket.on('subscribe_monitors', () => {
      socket.join('monitors')
      console.log(`[Socket.io] ${socket.id} subscribed to monitors`)
    })

    socket.on('unsubscribe_monitors', () => {
      socket.leave('monitors')
      console.log(`[Socket.io] ${socket.id} unsubscribed from monitors`)
    })

    // Subscribe to specific monitor
    socket.on('subscribe_monitor', (monitorId: number) => {
      socket.join(`monitor:${monitorId}`)
      console.log(`[Socket.io] ${socket.id} subscribed to monitor:${monitorId}`)
    })

    socket.on('unsubscribe_monitor', (monitorId: number) => {
      socket.leave(`monitor:${monitorId}`)
    })

    // Subscribe to status page
    socket.on('subscribe_status_page', (slug: string) => {
      socket.join(`status_page:${slug}`)
      console.log(`[Socket.io] ${socket.id} subscribed to status_page:${slug}`)
    })

    socket.on('unsubscribe_status_page', (slug: string) => {
      socket.leave(`status_page:${slug}`)
    })

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}, reason: ${reason}`)
    })

    socket.on('error', (error) => {
      console.error(`[Socket.io] Socket error for ${socket.id}:`, error)
    })
  })

  return io
}

// Emit functions for broadcasting updates
export function emitHeartbeat(monitorId: number, heartbeat: any) {
  if (!io) return
  
  io.to('monitors').emit('heartbeat', { monitorId, heartbeat })
  io.to(`monitor:${monitorId}`).emit('heartbeat', { monitorId, heartbeat })
}

export function emitMonitorList(monitors: any[]) {
  if (!io) return
  
  io.to('monitors').emit('monitor_list', monitors)
}

export function emitMonitorUpdate(monitor: any) {
  if (!io) return
  
  io.to('monitors').emit('monitor_update', monitor)
  io.to(`monitor:${monitor.id}`).emit('monitor_update', monitor)
}

export function emitMonitorDelete(monitorId: number) {
  if (!io) return
  
  io.to('monitors').emit('monitor_delete', { id: monitorId })
}

export function emitUptimeUpdate(monitorId: number, uptime: Record<string, number>) {
  if (!io) return
  
  io.to('monitors').emit('uptime', { monitorId, ...uptime })
  io.to(`monitor:${monitorId}`).emit('uptime', { monitorId, ...uptime })
}

export function emitStatusPageUpdate(slug: string, data: any) {
  if (!io) return
  
  io.to(`status_page:${slug}`).emit('status_page_update', data)
}

export function emitIncidentUpdate(slug: string, incident: any) {
  if (!io) return
  
  io.to(`status_page:${slug}`).emit('incident_update', incident)
}
