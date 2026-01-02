// composables/useSocket.ts
import type { Socket } from 'socket.io-client'

export const useSocket = () => {
  const { $socket } = useNuxtApp()
  
  const socket = ref<Socket | null>(null)
  const connected = ref(false)

  const connect = () => {
    if (!$socket) return
    
    socket.value = $socket.connect()
    
    socket.value?.on('connect', () => {
      connected.value = true
    })
    
    socket.value?.on('disconnect', () => {
      connected.value = false
    })
    
    return socket.value
  }

  const disconnect = () => {
    if ($socket) {
      $socket.disconnect()
    }
    socket.value = null
    connected.value = false
  }

  const emit = (event: string, data?: any) => {
    socket.value?.emit(event, data)
  }

  const on = (event: string, callback: (...args: any[]) => void) => {
    socket.value?.on(event, callback)
  }

  const off = (event: string, callback?: (...args: any[]) => void) => {
    socket.value?.off(event, callback)
  }

  const subscribeMonitors = () => {
    emit('subscribe_monitors')
  }

  const unsubscribeMonitors = () => {
    emit('unsubscribe_monitors')
  }

  const subscribeMonitor = (monitorId: number) => {
    emit('subscribe_monitor', monitorId)
  }

  const unsubscribeMonitor = (monitorId: number) => {
    emit('unsubscribe_monitor', monitorId)
  }

  const subscribeStatusPage = (slug: string) => {
    emit('subscribe_status_page', slug)
  }

  const unsubscribeStatusPage = (slug: string) => {
    emit('unsubscribe_status_page', slug)
  }

  return {
    socket: readonly(socket),
    connected: readonly(connected),
    connect,
    disconnect,
    emit,
    on,
    off,
    subscribeMonitors,
    unsubscribeMonitors,
    subscribeMonitor,
    unsubscribeMonitor,
    subscribeStatusPage,
    unsubscribeStatusPage,
  }
}
