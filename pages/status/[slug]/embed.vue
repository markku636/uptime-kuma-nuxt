<script setup lang="ts">
/**
 * Compact embeddable view of a public status page.
 * Intended to be framed by third-party sites; no app navigation, no editing,
 * no WebSocket live stream (the parent page auto-refreshes on its own cadence).
 */
definePageMeta({ layout: false })

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))
const {
  config,
  groups,
  incident,
  maintenanceList,
  overallStatusType,
  error,
  passwordRequired,
  init,
} = usePublicStatusPage(slug)

const statusLabel: Record<string, string> = {
  operational: 'All systems operational',
  'partial-outage': 'Partial outage',
  'major-outage': 'Major outage',
  maintenance: 'Under maintenance',
  unknown: 'Status unknown',
}
const statusColor: Record<string, string> = {
  operational: '#10b981',
  'partial-outage': '#f59e0b',
  'major-outage': '#ef4444',
  maintenance: '#3b82f6',
  unknown: '#9ca3af',
}
const tone = computed(() => statusLabel[overallStatusType.value] || statusLabel.unknown!)
const color = computed(() => statusColor[overallStatusType.value] || statusColor.unknown!)
const monitors = computed(() => groups.value.flatMap(group => group.monitorList))
const fullUrl = computed(() => `/status/${encodeURIComponent(slug.value)}`)
const latestUpdate = computed(() => incident.value?.updates?.at(-1) || null)
const activeMaintenance = computed(() => (maintenanceList.value || []).find(row => row.status === 'under-maintenance') || null)

useHead({
  title: () => `${config.value?.title || 'Status'} · Status`,
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
})

onMounted(async () => { await init() })
</script>

<template>
  <main class="sw-embed">
    <div v-if="passwordRequired" class="sw-note">This status page is password protected and cannot be embedded.</div>
    <div v-else-if="error" class="sw-note">{{ error }}</div>
    <template v-else>
      <header class="sw-head">
        <div>
          <strong class="sw-title">{{ config?.title || 'Status' }}</strong>
          <span class="sw-dot" :style="{ background: color }" aria-hidden="true"></span>
          <span class="sw-tone">{{ tone }}</span>
        </div>
        <a class="sw-link" :href="fullUrl" target="_blank" rel="noopener noreferrer">Details ↗</a>
      </header>
      <div v-if="activeMaintenance" class="sw-banner sw-maintenance">🔧 {{ activeMaintenance.title }}</div>
      <div v-else-if="incident" class="sw-banner" :class="`sw-${incident.style}`">
        <span class="sw-banner-title">{{ incident.title }}</span>
        <span v-if="latestUpdate" class="sw-banner-update">{{ latestUpdate.status }}: {{ latestUpdate.message }}</span>
      </div>
      <div v-if="!config && !groups.length" class="sw-note">Loading…</div>
      <ul v-else class="sw-list">
        <li v-for="monitor in monitors" :key="monitor.id" class="sw-row">
          <span class="sw-monitor-dot" :style="{ background: monitor.heartbeats?.at(-1)?.status === 0 ? '#ef4444' : monitor.heartbeats?.at(-1)?.status === 1 ? '#10b981' : '#9ca3af' }"></span>
          <span class="sw-name">{{ monitor.name }}</span>
          <span v-if="recentAveragePing(monitor.heartbeats) !== null" class="sw-uptime">{{ recentAveragePing(monitor.heartbeats) }}{{ (monitor.heartbeats || []).some((beat: any) => /^AUDIT_/.test(String(beat?.checkCode || ''))) ? '/100' : ' ms' }}</span>
          <span v-if="typeof monitor.uptime7 === 'number'" class="sw-uptime" title="7-day uptime">7d {{ monitor.uptime7.toFixed(2) }}%</span>
          <span v-if="typeof monitor.uptime30 === 'number'" class="sw-uptime" title="30-day uptime">30d {{ monitor.uptime30.toFixed(2) }}%</span>
          <span v-if="typeof monitor.uptime24 === 'number'" class="sw-uptime">{{ monitor.uptime24.toFixed(2) }}%</span>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.sw-embed { font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; color: #374151; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
@media (prefers-color-scheme: dark) {
  .sw-embed { color: #d1d5db; background: #111827; border-color: #374151; }
  .sw-title { color: #f9fafb; }
  .sw-link { color: #93c5fd; }
  .sw-row { border-top-color: #1f2937; }
  .sw-note, .sw-tone, .sw-uptime { color: #9ca3af; }
}
.sw-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.sw-title { font-size: 14px; color: #111827; }
.sw-dot, .sw-monitor-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-left: 10px; vertical-align: middle; }
.sw-monitor-dot { margin-left: 0; margin-right: 8px; flex: none; }
.sw-tone { margin-left: 5px; font-size: 12px; color: #6b7280; }
.sw-link { font-size: 12px; color: #2563eb; text-decoration: none; white-space: nowrap; }
.sw-link:hover { text-decoration: underline; }
.sw-list { list-style: none; margin: 0; padding: 0; }
.sw-row { display: flex; align-items: center; padding: 5px 0; border-top: 1px solid #f3f4f6; }
.sw-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sw-uptime { margin-left: 8px; color: #6b7280; font-variant-numeric: tabular-nums; }
.sw-note { padding: 12px; color: #6b7280; }
.sw-banner { margin-bottom: 8px; padding: 7px 9px; border-radius: 6px; background: #fef3c7; color: #92400e; font-size: 12px; }
.sw-maintenance { background: #dbeafe; color: #1e40af; }
.sw-danger { background: #fee2e2; color: #991b1b; }
.sw-primary, .sw-success { background: #d1fae5; color: #065f46; }
.sw-info { background: #e0e7ff; color: #3730a3; }
.sw-banner-title { font-weight: 600; }
.sw-banner-update { display: block; opacity: .85; margin-top: 2px; }
</style>
