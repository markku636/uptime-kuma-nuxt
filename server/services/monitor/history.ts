// server/services/monitor/history.ts
// Heartbeat retention limits shared by the job and the settings routes.

/** Kept when the setting has never been saved (uptime-kuma's default) */
export const HISTORY_DEFAULT_DAYS = 180
/** About ten years: anything larger is "forever" in practice (use 0) */
export const HISTORY_MAX_DAYS = 3650
