// server/plugins/socket.ts
import { initSocketServer } from '../services/socket'

export default defineNitroPlugin((nitroApp) => {
  // Socket.io initialization will be handled when the server starts
  // For Nitro, we need to hook into the server lifecycle
  
  nitroApp.hooks.hook('request', async (event) => {
    // Initialize socket server on first request if not already done
    // This is a workaround for Nitro's architecture
    const server = (event.node.req.socket as any)?.server
    
    if (server && !server._socketInitialized) {
      initSocketServer(server)
      server._socketInitialized = true
      console.log('[Socket.io] Server initialized')
    }
  })
})
