import {allowedOrigins} from '../utils/allowed-origins'
import {initializeRuntime,drainRuntime} from '../services/monitor/runtime'
import {runtimeOptions} from '../services/monitor/runtime-config'
export default defineNitroPlugin(nitroApp=>{
  // Validate synchronously: Nitro does not await async plugin functions.
  runtimeOptions();allowedOrigins(useRuntimeConfig().public.appUrl)
  initializeRuntime().catch(()=>console.error('[Runtime] Initialization unavailable; readiness remains false'))
  nitroApp.hooks.hook('close',drainRuntime)
  process.once('SIGTERM',()=>{void drainRuntime()})
  process.once('SIGINT',()=>{void drainRuntime()})
})
