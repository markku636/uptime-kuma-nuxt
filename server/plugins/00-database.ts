// server/plugins/00-database.ts
// This plugin runs first (00- prefix) to ensure scheduler starts after database is ready
// Database tables are created by docker-entrypoint.sh using prisma/init.sql

import { initializeScheduler } from '../services/monitor/scheduler'
import { initBackgroundJobs, stopBackgroundJobs } from '../jobs'

export default defineNitroPlugin(async (nitroApp) => {
  console.log('[App] Starting initialization...')
  
  try {
    // Database tables should already be created by docker-entrypoint.sh
    // Initialize the monitor scheduler
    console.log('[Scheduler] Initializing monitor scheduler...')
    await initializeScheduler()
    console.log('[Scheduler] Monitor scheduler initialized successfully')

    // Initialize background jobs (clear-old-data, reconcile-monitors, etc.)
    console.log('[Jobs] Initializing background jobs...')
    await initBackgroundJobs()
    console.log('[Jobs] Background jobs initialized successfully')
  } catch (error) {
    console.error('[App] Initialization failed:', error)
  }

  // Register shutdown hook to stop background jobs gracefully
  nitroApp.hooks.hook('close', () => {
    console.log('[App] Shutting down...')
    stopBackgroundJobs()
  })
})
