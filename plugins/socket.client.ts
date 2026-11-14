// plugins/socket.client.ts
import { io, Socket } from 'socket.io-client'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  
  let socket: Socket | null = null

  const connect = () => {
    if (socket?.connected) return socket

    socket = io(config.public.appUrl as string, {
      transports: ['websocket'],
      autoConnect: true,
      auth: (callback) => {
        $fetch<{ ticket: string }>('/api/auth/socket-ticket', { method: 'POST' })
          .then(({ ticket }) => callback({ ticket }))
          .catch(() => callback({ ticket: '' }))
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect', () => {
      console.log('[Socket.io] Connected to server')
    })

    socket.on('disconnect', (reason) => {
      console.log('[Socket.io] Disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
      console.error('[Socket.io] Connection error:', error)
    })

    return socket
  }

  const disconnect = () => {
    if (socket) {
      socket.disconnect()
      socket = null
    }
  }

  const getSocket = () => socket

  return {
    provide: {
      socket: {
        connect,
        disconnect,
        getSocket,
      }
    }
  }
})
