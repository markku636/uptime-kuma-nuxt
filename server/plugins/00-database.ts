// server/plugins/00-database.ts
// This plugin runs first (00- prefix) to ensure scheduler starts after database is ready
// Database tables are created by docker-entrypoint.sh using prisma/init.sql

import { initializeScheduler } from '../services/monitor/scheduler'

export default defineNitroPlugin(async () => {
  console.log('[App] Starting initialization...')
  
  try {
    // Database tables should already be created by docker-entrypoint.sh
    // Initialize the monitor scheduler
    console.log('[Scheduler] Initializing monitor scheduler...')
    await initializeScheduler()
    console.log('[Scheduler] Monitor scheduler initialized successfully')
  } catch (error) {
    console.error('[App] Initialization failed:', error)
  }
})
