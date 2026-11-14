import type { Server as HTTPServer } from 'node:http'
import { Server as SocketServer, type Socket } from 'socket.io'
import { workerPrisma as prisma } from '../utils/worker-prisma'
import { verifySocketTicket } from '../utils/socket-ticket'
import { monitorSummary, heartbeatSummary } from '../utils/serialize'
import { getMonitorTypeListForClient } from './monitor/types'

let io: SocketServer | null = null
interface AuthenticatedSocket extends Socket { data: { userId: number; sessionVersion: number; workspaceId: number; environmentId: number } }

async function validSocket(socket: AuthenticatedSocket) {
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: {
    workspaceId: socket.data.workspaceId, userId: socket.data.userId } }, include: { user: { select: { active: true, sessionVersion: true } } } })
  return !!membership?.user.active && membership.user.sessionVersion === socket.data.sessionVersion
    && !!await prisma.environment.findFirst({ where: { id: socket.data.environmentId, workspaceId: socket.data.workspaceId }, select: { id: true } })
}

export function initSocketServer(server: HTTPServer) {
  if (io) return io
  const allowedOrigin = new URL(useRuntimeConfig().public.appUrl).origin
  io = new SocketServer(server, { cors: { origin: allowedOrigin, credentials: true },transports:['websocket'],
    maxHttpBufferSize: 64 * 1024, pingTimeout: 60_000, pingInterval: 25_000 })
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const origin = socket.handshake.headers.origin
      if (origin && origin !== allowedOrigin) throw new Error('Origin denied')
      const ticket = verifySocketTicket(socket.handshake.auth.ticket, useRuntimeConfig().session.password)
      socket.data.userId = ticket.userId
      socket.data.sessionVersion = ticket.sessionVersion
      socket.data.workspaceId = ticket.workspaceId
      socket.data.environmentId = ticket.environmentId
      if (!await validSocket(socket)) throw new Error('Session expired')
      next()
    } catch { next(new Error('Unauthorized')) }
  })
  io.on('connection', (socket: AuthenticatedSocket) => {
    socket.join(`user:${socket.data.userId}`)
    socket.join(`workspace:${socket.data.workspaceId}`)
    socket.join(`workspace:${socket.data.workspaceId}:environment:${socket.data.environmentId}`)
    const scopeRoom = `workspace:${socket.data.workspaceId}:environment:${socket.data.environmentId}:user:${socket.data.userId}`
    socket.use(async (packet, next) => {
      try {
        if (!await validSocket(socket)) { socket.disconnect(true); return }
        // The old mutation handlers had separate, incomplete authorization. Use REST.
        if (!['subscribe_monitors', 'unsubscribe_monitors', 'subscribe_monitor', 'unsubscribe_monitor',
          'getMonitorList', 'getMonitor', 'getMonitorTypeList', 'loginByToken'].includes(packet[0])) {
          const callback = packet.at(-1)
          if (typeof callback === 'function') callback({ ok: false, code: 'REST_REQUIRED', msg: 'Use the authenticated REST API' })
          return
        }
        next()
      } catch { socket.disconnect(true) }
    })
    socket.on('loginByToken', (_token, callback) => {
      if (typeof callback === 'function') callback({ ok: true })
    })
    socket.on('getMonitorTypeList', callback => {
      if (typeof callback === 'function') callback({ ok: true, monitorTypeList: getMonitorTypeListForClient() })
    })
    socket.on('getMonitorList', async callback => {
      if (typeof callback !== 'function') return
      try {
        const monitors = await prisma.monitor.findMany({ where: { workspaceId: socket.data.workspaceId, environmentId: socket.data.environmentId },
          include: { tags: { include: { tag: true } } }, orderBy: { id: 'asc' }, take: 200 })
        callback({ ok: true, monitors: monitors.map(monitorSummary) })
      } catch { callback({ ok: false, msg: 'Unable to load monitors' }) }
    })
    socket.on('getMonitor', async (id, callback) => {
      if (typeof callback !== 'function' || !Number.isSafeInteger(id)) return
      try {
        const monitor = await prisma.monitor.findFirst({ where: { id, workspaceId: socket.data.workspaceId, environmentId: socket.data.environmentId } })
        callback(monitor ? { ok: true, monitor: monitorSummary(monitor) } : { ok: false, msg: 'Monitor not found' })
      } catch { callback({ ok: false, msg: 'Unable to load monitor' }) }
    })
    socket.on('subscribe_monitors', () => socket.join(`${scopeRoom}:monitors`))
    socket.on('unsubscribe_monitors', () => socket.leave(`${scopeRoom}:monitors`))
    socket.on('subscribe_monitor', async (id: number, callback?: Function) => {
      if (!Number.isSafeInteger(id)) return
      try {
        const monitor = await prisma.monitor.findFirst({ where: { id, workspaceId: socket.data.workspaceId, environmentId: socket.data.environmentId }, select: { id: true } })
        if (!monitor) { callback?.({ ok: false, msg: 'Monitor not found' }); return }
        await socket.join(`${scopeRoom}:monitor:${id}`)
        callback?.({ ok: true })
      } catch { callback?.({ ok: false, msg: 'Unable to subscribe' }) }
    })
    socket.on('unsubscribe_monitor', (id: number) => socket.leave(`${scopeRoom}:monitor:${id}`))
  })
  return io
}

export function getIO() { return io }
export const getSocketServer = getIO
export function disconnectUserSockets(userId: number) { io?.in(`user:${userId}`).disconnectSockets(true) }

// Delivery rechecks current membership and session version, including idle connections.
async function deliver(workspaceId: number, environmentId: number | null, event: string, payload: any, monitorId?: number) {
  if (!io) return
  const members = await prisma.workspaceMember.findMany({ where: { workspaceId, user: { active: true } },
    select: { userId: true, user: { select: { sessionVersion: true } } } })
  const allowed = new Map(members.map(member => [member.userId, member.user.sessionVersion]))
  const room = environmentId === null ? `workspace:${workspaceId}` : `workspace:${workspaceId}:environment:${environmentId}`
  for (const socket of await io.in(room).fetchSockets()) {
    if (allowed.get(socket.data.userId) !== socket.data.sessionVersion) { socket.disconnect(true); continue }
    const scoped = `workspace:${workspaceId}:environment:${socket.data.environmentId}:user:${socket.data.userId}`
    if (monitorId === undefined || socket.rooms.has(`${scoped}:monitors`) || socket.rooms.has(`${scoped}:monitor:${monitorId}`)) {
      socket.emit(event, payload)
    }
  }
}
export async function emitHeartbeat(monitorId: number, heartbeat: any) {
  try {
    const monitor = await prisma.monitor.findUnique({ where: { id: monitorId }, select: { workspaceId: true, environmentId: true } })
    if (monitor) await deliver(monitor.workspaceId, monitor.environmentId, 'heartbeat', { monitorId, heartbeat: heartbeatSummary(heartbeat) }, monitorId)
  } catch { console.error('[Socket] Unable to deliver heartbeat; clients can resync via REST') }
}
export async function broadcastMaintenanceList(userId: number) {
  if (!io) return
  const workspaces = await prisma.maintenance.findMany({ where: { userId }, distinct: ['workspaceId'], select: { workspaceId: true } })
  for (const { workspaceId } of workspaces) {
    const list = await prisma.maintenance.findMany({ where: { workspaceId } })
    await deliver(workspaceId, null, 'maintenanceList', list)
  }
}
export async function emitNodeList() {}
export function emitNodeStatusChange(_nodeId: string, _status: string) {}

/** Local subscription inventory; never enumerate monitors that no local client requested. */
export function localStateSubscriptions(){
  const scopes=new Map<string,{workspaceId:number;environmentId:number;all:boolean;ids:Set<number>}>()
  for(const socket of io?.sockets.sockets.values()||[]){
    const {workspaceId,environmentId,userId}=socket.data,key=`${workspaceId}:${environmentId}`,prefix=`workspace:${workspaceId}:environment:${environmentId}:user:${userId}`
    const all=socket.rooms.has(`${prefix}:monitors`),ids=[...socket.rooms].filter(room=>room.startsWith(`${prefix}:monitor:`)).map(room=>Number(room.split(':').at(-1))).filter(Number.isSafeInteger)
    if(!all&&!ids.length)continue
    const scope=scopes.get(key)||{workspaceId,environmentId,all:false,ids:new Set<number>()};scope.all||=all;for(const id of ids)scope.ids.add(id);scopes.set(key,scope)
  }
  return [...scopes.values()]
}
/** Batch permissions are fresh for each delivery; each socket tracks its own resync cursor. */
export async function deliverMonitorStates(states:any[],heartbeats:any[]){
  if(!io||!states.length)return 0
  const workspaces=[...new Set(states.map(state=>state.workspaceId))]
  const members=await prisma.workspaceMember.findMany({where:{workspaceId:{in:workspaces},user:{active:true}},select:{workspaceId:true,userId:true,user:{select:{sessionVersion:true}}}})
  const allowed=new Map(members.map(member=>[`${member.workspaceId}:${member.userId}`,member.user.sessionVersion]))
  const beats=new Map(heartbeats.map(row=>[String(row.id),row]));let delivered=0
  for(const socket of io.sockets.sockets.values()){
    if(!workspaces.includes(socket.data.workspaceId))continue
    if(allowed.get(`${socket.data.workspaceId}:${socket.data.userId}`)!==socket.data.sessionVersion){socket.disconnect(true);continue}
    const prefix=`workspace:${socket.data.workspaceId}:environment:${socket.data.environmentId}:user:${socket.data.userId}`,all=socket.rooms.has(`${prefix}:monitors`)
    const revisions:Map<number,bigint>=socket.data.stateRevisions||=(new Map())
    for(const state of states){
      if(state.workspaceId!==socket.data.workspaceId||state.environmentId!==socket.data.environmentId||!all&&!socket.rooms.has(`${prefix}:monitor:${state.monitorId}`))continue
      if((revisions.get(state.monitorId)||0n)>=state.revision)continue
      const heartbeat=beats.get(String(state.heartbeatId));if(!heartbeat)continue
      revisions.set(state.monitorId,state.revision)
      if(revisions.size>5000)revisions.delete(revisions.keys().next().value!)
      socket.emit('heartbeat',{monitorId:state.monitorId,revision:String(state.revision),heartbeat:heartbeatSummary(heartbeat)});delivered++
    }
  }
  return delivered
}
export function stateNeedsDelivery(state:any){
  if(!io)return false
  for(const socket of io.sockets.sockets.values()){
    if(state.workspaceId!==socket.data.workspaceId||state.environmentId!==socket.data.environmentId)continue
    const prefix=`workspace:${socket.data.workspaceId}:environment:${socket.data.environmentId}:user:${socket.data.userId}`
    if(!socket.rooms.has(`${prefix}:monitors`)&&!socket.rooms.has(`${prefix}:monitor:${state.monitorId}`))continue
    if((socket.data.stateRevisions?.get(state.monitorId)||0n)<state.revision)return true
  }
  return false
}
