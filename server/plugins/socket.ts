import {initSocketServer} from '../services/socket'
import {runtimeOptions} from '../services/monitor/runtime-config'
import {runtimeState} from '../services/monitor/runtime'
export default defineNitroPlugin(nitroApp=>{
  nitroApp.hooks.hook('request',event=>{
    if(runtimeOptions().role==='worker'||!runtimeState.ready||runtimeState.draining)return
    const server=(event.node.req.socket as any)?.server
    if(server&&!server._socketInitialized){initSocketServer(server);server._socketInitialized=true}
  })
})
