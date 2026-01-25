// server/services/socket/index.ts
import { Server as SocketServer, Socket } from 'socket.io'
import type { H3Event } from 'h3'
import { prisma } from '../../utils/prisma'
import { clusterConfig } from '../../utils/cluster-config'

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

    // Subscribe to node updates
    socket.on('subscribe_nodes', () => {
      socket.join('nodes')
      console.log(`[Socket.io] ${socket.id} subscribed to nodes`)
    })

    socket.on('unsubscribe_nodes', () => {
      socket.leave('nodes')
    })

    // ==========================================
    // Node Management Socket Events
    // ==========================================

    // Get list of all nodes
    socket.on('getNodeList', async (callback: (response: any) => void) => {
      try {
        const nodes = await prisma.node.findMany({
          orderBy: [
            { isPrimary: 'desc' },
            { nodeId: 'asc' }
          ]
        })

        callback({
          ok: true,
          nodes: nodes.map(node => ({
            id: node.id,
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            host: node.host,
            hostname: node.hostname,
            location: node.location,
            status: node.status,
            isPrimary: node.isPrimary,
            lastHeartbeat: node.lastHeartbeat?.toISOString(),
            createdAt: node.createdAt.toISOString(),
            updatedAt: node.updatedAt.toISOString()
          }))
        })
      } catch (e: any) {
        console.error('[Socket.io] getNodeList error:', e.message)
        callback({ ok: false, msg: e.message })
      }
    })

    // Add a new node
    socket.on('addNode', async (nodeData: {
      nodeId: string
      nodeName: string
      host?: string
      isPrimary?: boolean
    }, callback: (response: any) => void) => {
      try {
        const { nodeId, nodeName, host, isPrimary } = nodeData

        if (!nodeId || !nodeName) {
          throw new Error('Node ID and Node Name are required')
        }

        // Check if node ID already exists
        const existingNode = await prisma.node.findUnique({
          where: { nodeId }
        })

        if (existingNode) {
          throw new Error('Node ID already exists')
        }

        // If setting as primary, unset other primary nodes
        if (isPrimary) {
          await prisma.node.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false }
          })
        }

        // Create new node
        const node = await prisma.node.create({
          data: {
            nodeId,
            nodeName,
            host: host || null,
            hostname: host || null,
            isPrimary: isPrimary || false,
            status: 'offline',
            lastHeartbeat: new Date()
          }
        })

        console.log(`[Socket.io] Added node: ${nodeId} (${nodeName})${isPrimary ? ' as primary' : ''}`)

        // Broadcast updated node list to all subscribed clients
        await emitNodeList()

        callback({
          ok: true,
          msg: 'Node added successfully',
          node: {
            id: node.id,
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            host: node.host,
            isPrimary: node.isPrimary,
            status: node.status
          }
        })
      } catch (e: any) {
        console.error('[Socket.io] addNode error:', e.message)
        callback({ ok: false, msg: e.message })
      }
    })

    // Update an existing node
    socket.on('updateNode', async (nodeData: {
      nodeId: string
      nodeName?: string
      host?: string
      isPrimary?: boolean
    }, callback: (response: any) => void) => {
      try {
        const { nodeId, nodeName, host, isPrimary } = nodeData

        if (!nodeId) {
          throw new Error('Node ID is required')
        }

        // Check if node exists
        const existingNode = await prisma.node.findUnique({
          where: { nodeId }
        })

        if (!existingNode) {
          throw new Error('Node not found')
        }

        // If setting as primary, unset other primary nodes
        if (isPrimary && !existingNode.isPrimary) {
          await prisma.node.updateMany({
            where: { isPrimary: true },
            data: { isPrimary: false }
          })
        }

        // Update node
        const node = await prisma.node.update({
          where: { nodeId },
          data: {
            nodeName: nodeName || existingNode.nodeName,
            host: host !== undefined ? host : existingNode.host,
            isPrimary: isPrimary !== undefined ? isPrimary : existingNode.isPrimary,
            updatedAt: new Date()
          }
        })

        console.log(`[Socket.io] Updated node: ${nodeId} (${node.nodeName})${node.isPrimary ? ' as primary' : ''}`)

        // Broadcast updated node list
        await emitNodeList()

        callback({
          ok: true,
          msg: 'Node updated successfully',
          node: {
            id: node.id,
            nodeId: node.nodeId,
            nodeName: node.nodeName,
            host: node.host,
            isPrimary: node.isPrimary,
            status: node.status
          }
        })
      } catch (e: any) {
        console.error('[Socket.io] updateNode error:', e.message)
        callback({ ok: false, msg: e.message })
      }
    })

    // Delete a node
    socket.on('deleteNode', async (nodeId: string, callback: (response: any) => void) => {
      try {
        if (!nodeId) {
          throw new Error('Node ID is required')
        }

        // Check if node exists
        const existingNode = await prisma.node.findUnique({
          where: { nodeId }
        })

        if (!existingNode) {
          throw new Error('Node not found')
        }

        // Check if node has assigned monitors
        const monitorCount = await prisma.monitor.count({
          where: {
            OR: [
              { nodeId: nodeId },
              { assignedNode: nodeId }
            ]
          }
        })

        if (monitorCount > 0) {
          throw new Error(`Cannot delete node with ${monitorCount} assigned monitors. Please reassign monitors first.`)
        }

        // Delete node
        await prisma.node.delete({
          where: { nodeId }
        })

        console.log(`[Socket.io] Deleted node: ${nodeId}`)

        // Broadcast updated node list
        await emitNodeList()

        callback({
          ok: true,
          msg: 'Node deleted successfully'
        })
      } catch (e: any) {
        console.error('[Socket.io] deleteNode error:', e.message)
        callback({ ok: false, msg: e.message })
      }
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

// ==========================================
// Node Emit Functions
// ==========================================

/**
 * Broadcast node list to all subscribed clients
 */
export async function emitNodeList() {
  if (!io) return

  try {
    const nodes = await prisma.node.findMany({
      orderBy: [
        { isPrimary: 'desc' },
        { nodeId: 'asc' }
      ]
    })

    const nodeList = nodes.map(node => ({
      id: node.id,
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      host: node.host,
      hostname: node.hostname,
      location: node.location,
      status: node.status,
      isPrimary: node.isPrimary,
      lastSeen: node.lastSeen?.toISOString(),
      createdAt: node.createdAt.toISOString(),
      modifiedAt: node.modifiedAt.toISOString()
    }))

    io.to('nodes').emit('node_list', nodeList)
    console.log(`[Socket.io] Broadcast node_list to nodes room (${nodes.length} nodes)`)
  } catch (error) {
    console.error('[Socket.io] Failed to emit node list:', error)
  }
}

/**
 * Broadcast a single node update
 */
export function emitNodeUpdate(node: any) {
  if (!io) return

  io.to('nodes').emit('node_update', {
    id: node.id,
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    host: node.host,
    hostname: node.hostname,
    location: node.location,
    status: node.status,
    isPrimary: node.isPrimary,
    lastSeen: node.lastSeen?.toISOString?.() || node.lastSeen,
    modifiedAt: node.modifiedAt?.toISOString?.() || node.modifiedAt
  })
}

/**
 * Broadcast node status change (online/offline)
 */
export function emitNodeStatusChange(nodeId: string, status: 'online' | 'offline') {
  if (!io) return

  io.to('nodes').emit('node_status', { nodeId, status })
  console.log(`[Socket.io] Node ${nodeId} status changed to ${status}`)
}

/**
 * Broadcast node deletion
 */
export function emitNodeDelete(nodeId: string) {
  if (!io) return

  io.to('nodes').emit('node_delete', { nodeId })
}
