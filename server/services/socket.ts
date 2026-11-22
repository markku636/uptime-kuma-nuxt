import {SerialQueue} from '../utils/serial-queue'
import {allowedOrigins} from '../utils/allowed-origins'
import type { Server as HTTPServer } from 'node:http'
import { Server as SocketServer, type Socket } from 'socket.io'
import { workerPrisma as prisma } from '../utils/worker-prisma'
import { verifySocketTicket } from '../utils/socket-ticket'
import { monitorSummary, heartbeatSummary } from '../utils/serialize'
import {stateHeartbeat} from '../utils/monitor-query'
import { getMonitorTypeListForClient } from './monitor/types'

let io: SocketServer | null = null
interface AuthenticatedSocket extends Socket { data: { userId: number; sessionVersion: number; workspaceId: number; environmentId: number; sessionId?: string } }

async function validSocket(socket: AuthenticatedSocket) {
  const membership = await prisma.workspaceMember.findUnique({ where: { workspaceId_userId: {
    workspaceId: socket.data.workspaceId, userId: socket.data.userId } }, include: { user: { select: { active: true, sessionVersion: true } } } })
  if (!membership?.user.active || membership.user.sessionVersion !== socket.data.sessionVersion) return false
  if (socket.data.sessionId) {
    const tracked = await prisma.userSession.findFirst({
      where: { id: socket.data.sessionId, userId: socket.data.userId, revokedAt: null }, select: { id: true } })
    if (!tracked) return false
  }
  return !!await prisma.environment.findFirst({ where: { id: socket.data.environmentId, workspaceId: socket.data.workspaceId }, select: { id: true } })
}

export function initSocketServer(server: HTTPServer) {
  if (io) return io
  const origins=allowedOrigins(useRuntimeConfig().public.appUrl)
  io = new SocketServer(server, { cors: { origin: origins, credentials: true },transports:['websocket'],
    maxHttpBufferSize: 64 * 1024, pingTimeout: 60_000, pingInterval: 25_000 })
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const origin = socket.handshake.headers.origin
      if (origin && !origins.includes(origin)) throw new Error('Origin denied')
      const ticket = verifySocketTicket(socket.handshake.auth.ticket, useRuntimeConfig().session.password)
      socket.data.userId = ticket.userId
      socket.data.sessionVersion = ticket.sessionVersion
      socket.data.workspaceId = ticket.workspaceId
      socket.data.environmentId = ticket.environmentId
      socket.data.sessionId = ticket.sessionId
      if (!await validSocket(socket)) throw new Error('Session expired')
      next()
    } catch { next(new Error('Unauthorized')) }
  })
  io.on('connection', (socket: AuthenticatedSocket) => {
    socket.join(`user:${socket.data.userId}`)
    socket.join(`workspace:${socket.data.workspaceId}`)
    socket.join(`workspace:${socket.data.workspaceId}:environment:${socket.data.environmentId}`)
    const scopeRoom = `workspace:${socket.data.workspaceId}:environment:${socket.data.environmentId}:user:${socket.data.userId}`
    const authorizationQueue=new SerialQueue(32)
    let packetWindow=Date.now(),packetCount=0
    socket.use((packet, next) => {
      if(Date.now()-packetWindow>1000){packetWindow=Date.now();packetCount=0}
      if(++packetCount>20){socket.disconnect(true);return}
      void authorizationQueue.enqueue(async()=>{
      if(!socket.connected)return
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
      }).catch(()=>socket.disconnect(true))
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
    let subscriptionQueue=Promise.resolve(),pendingSubscriptions=0
    const subscriptionEvent=(event:string,handler:(...input:any[])=>unknown)=>socket.on(event,(...input:any[])=>{
      if(++pendingSubscriptions>32){socket.disconnect(true);return}
      subscriptionQueue=subscriptionQueue.then(async()=>{if(socket.connected)await handler(...input)}).catch(()=>{const callback=input.at(-1);if(typeof callback==='function')callback({ok:false,code:'SUBSCRIPTION_UNAVAILABLE'})}).finally(()=>{pendingSubscriptions--})
    })
    subscriptionEvent('subscribe_monitors',async(input?:number[]|Function,callback?:Function)=>{
      if(typeof input==='function'){callback=input;input=undefined}
      try{
        let ids:number[]
        if(input===undefined){const rows=await prisma.monitor.findMany({where:{workspaceId:socket.data.workspaceId,environmentId:socket.data.environmentId},select:{id:true},orderBy:{id:'asc'},take:201});if(rows.length>200){callback?.({ok:false,code:'PAGE_SUBSCRIPTION_REQUIRED'});socket.emit('subscription_error',{code:'PAGE_SUBSCRIPTION_REQUIRED'});return}ids=rows.map(row=>row.id)}
        else{if(!Array.isArray(input)||input.length>200||input.some(id=>!Number.isSafeInteger(id)||id<=0)){callback?.({ok:false,code:'INVALID_IDS'});return}ids=[...new Set(input)]}
        const rows=ids.length?await prisma.monitor.findMany({where:{workspaceId:socket.data.workspaceId,environmentId:socket.data.environmentId,id:{in:ids}},select:{id:true}}):[]
        if(rows.length!==ids.length){callback?.({ok:false,code:'MONITOR_NOT_FOUND'});return}
        for(const room of socket.rooms)if(room===`${scopeRoom}:monitors`||room.startsWith(`${scopeRoom}:monitor:`))socket.leave(room)
        const revisions:Map<number,bigint>=(socket.data as any).stateRevisions||=new Map()
        for(const id of revisions.keys())if(!ids.includes(id))revisions.delete(id)
        for(const id of ids)await socket.join(`${scopeRoom}:monitor:${id}`)
        callback?.({ok:true,count:ids.length,bounded:true})
      }catch{callback?.({ok:false,code:'SUBSCRIPTION_UNAVAILABLE'})}
    })
    subscriptionEvent('unsubscribe_monitors',()=>{for(const room of socket.rooms)if(room===`${scopeRoom}:monitors`||room.startsWith(`${scopeRoom}:monitor:`))socket.leave(room);(socket.data as any).stateRevisions?.clear()})
    subscriptionEvent('subscribe_monitor', async (id: number, callback?: Function) => {
      if (!Number.isSafeInteger(id)) return
      if([...socket.rooms].filter(room=>room.startsWith(`${scopeRoom}:monitor:`)).length>=200&&!socket.rooms.has(`${scopeRoom}:monitor:${id}`)){callback?.({ok:false,code:'SUBSCRIPTION_LIMIT'});return}
      try {
        const monitor = await prisma.monitor.findFirst({ where: { id, workspaceId: socket.data.workspaceId, environmentId: socket.data.environmentId }, select: { id: true } })
        if (!monitor) { callback?.({ ok: false, msg: 'Monitor not found' }); return }
        await socket.join(`${scopeRoom}:monitor:${id}`)
        callback?.({ ok: true })
      } catch { callback?.({ ok: false, msg: 'Unable to subscribe' }) }
    })
    subscriptionEvent('unsubscribe_monitor', (id:number)=>{socket.leave(`${scopeRoom}:monitor:${id}`);(socket.data as any).stateRevisions?.delete(id)})
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
      const heartbeat=beats.get(String(state.heartbeatId))||stateHeartbeat(state)
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
