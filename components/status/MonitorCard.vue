<template>
  <div class="status-monitor-card" :class="{ 'edit-mode': editMode }">
    <div class="monitor-row">
      <!-- Left side: Status + Name -->
      <div class="monitor-info">
        <!-- Drag handle (edit mode) -->
        <UIcon
          v-if="editMode"
          name="i-heroicons-bars-3"
          class="drag-handle text-gray-400 cursor-grab"
        />
        
        <!-- Remove button (edit mode) -->
        <UButton
          v-if="editMode"
          icon="i-heroicons-x-mark"
          size="xs"
          color="error"
          variant="ghost"
          class="remove-btn"
          @click="emit('remove')"
        />
        
        <!-- Uptime badge -->
        <StatusUptime
          :percentage="monitor.uptime24"
          :status="lastHeartbeatStatus"
          pill
        />
        
        <!-- Monitor name with optional link and full URL -->
        <div class="min-w-0">
          <a
            v-if="showLink && monitor.url"
            :href="monitor.url"
            :title="monitor.url"
            target="_blank"
            rel="noopener noreferrer"
            class="monitor-name block"
          >
            {{ monitor.name }}
          </a>
          <span v-else class="monitor-name block">{{ monitor.name }}</span>
          <code v-if="showLink && monitor.url" class="monitor-url">{{ monitor.url }}</code>
        </div>
        
        <!-- Toggle public URL link (edit mode) -->
        <UButton
          v-if="editMode"
          :icon="monitor.sendUrl ? 'i-heroicons-link' : 'i-heroicons-link-slash'"
          size="xs"
          :color="monitor.sendUrl ? 'primary' : 'neutral'"
          variant="ghost"
          :title="monitor.sendUrl ? 'Hide URL on public status page' : 'Show URL on public status page'"
          @click="emit('update:sendUrl', !monitor.sendUrl)"
        />
      </div>
      
      <!-- Right side: Tags + Cert + Heartbeat -->
      <div class="monitor-details">
        <!-- Certificate expiry -->
        <UBadge
          v-if="showCertificateExpiry && monitor.certExpiryDaysRemaining !== undefined"
          :color="certExpiryColor"
          variant="subtle"
          size="xs"
        >
          {{ $t('Cert Exp.') }}: {{ certExpiryText }}
        </UBadge>
        
        <!-- Tags -->
        <div v-if="showTags && monitor.tags?.length" class="tags">
          <UBadge
            v-for="tag in monitor.tags"
            :key="tag.id || tag.name"
            :style="{ backgroundColor: tag.color }"
            size="xs"
          >
            {{ tag.name }}
          </UBadge>
        </div>
        
        <span v-if="avgPing !== null" class="text-xs text-gray-500 tabular-nums" :title="'Average response time of recent checks'">
          {{ avgPing }} ms
        </span>
        <span v-if="typeof monitor.uptime30 === 'number'" class="text-xs text-gray-400" title="30-day uptime">
          30d {{ monitor.uptime30.toFixed(2) }}%
        </span>
        <span v-if="lastCheckLabel" class="text-xs text-gray-400" :title="'Last check time'">
          {{ lastCheckLabel }}
        </span>

        <!-- Heartbeat bar -->
        <StatusHeartbeatBar
          :heartbeats="monitor.heartbeats || []"
          size="mid"
          class="heartbeat-bar"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tag {
  id?: number
  name: string
  color?: string
}

interface Heartbeat {
  status: number
  time: string
  ping?: number
  msg?: string
}

interface Monitor {
  id: number
  name: string
  url?: string
  sendUrl?: boolean
  type?: string
  uptime24?: number
  uptime30?: number
  validCert?: boolean
  certExpiryDaysRemaining?: number
  tags?: Tag[]
  heartbeats?: Heartbeat[]
}

const props = withDefaults(defineProps<{
  monitor: Monitor
  editMode?: boolean
  showTags?: boolean
  showCertificateExpiry?: boolean
}>(), {
  editMode: false,
  showTags: false,
  showCertificateExpiry: false
})

const emit = defineEmits<{
  (e: 'remove'): void
  (e: 'settings'): void
  (e: 'update:sendUrl', value: boolean): void
}>()

const { t } = (useI18n as any)()

// Show link only for http/keyword/json-query types
const showLink = computed(() => {
  if (!props.monitor.sendUrl || !props.monitor.url) return false
  if (props.monitor.url === 'https://') return false
  
  const linkableTypes = ['http', 'keyword', 'json-query']
  return linkableTypes.includes(props.monitor.type || '')
})

// Last heartbeat status (heartbeats are in chronological order, last one is most recent)
const lastHeartbeatStatus = computed(() => {
  const heartbeats = props.monitor.heartbeats
  if (!heartbeats?.length) return -1
  return heartbeats[heartbeats.length - 1].status
})

const lastCheckLabel = computed(() => {
  const last = props.monitor.heartbeats?.at(-1)?.time
  if (!last) return ''
  const date = new Date(last)
  return Number.isFinite(date.getTime()) ? date.toLocaleTimeString() : ''
})

// Recent response time (ms) from the latest observations, excluding failed checks.
const avgPing = computed(() => recentAveragePing(props.monitor.heartbeats))

// Certificate expiry color and text
const certExpiryColor = computed((): 'error' | 'success' | 'neutral' => {
  if (!props.monitor.validCert) return 'error'
  if (!props.monitor.certExpiryDaysRemaining) return 'neutral'
  
  return props.monitor.certExpiryDaysRemaining > 7 ? 'success' : 'error'
})

const certExpiryText = computed(() => {
  if (props.monitor.validCert === false) {
    return t('Invalid')
  }
  if (!props.monitor.certExpiryDaysRemaining) {
    return t('Unknown')
  }
  
  const days = props.monitor.certExpiryDaysRemaining
  return `${days} ${t('day', days)}`
})
</script>

<style scoped>
.status-monitor-card {
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  transition: background-color 0.15s;
  color: #0f172a;
}

.dark .status-monitor-card {
  border-bottom-color: #374151;
  color: #e5e7eb;
}

.status-monitor-card:last-child {
  border-bottom: none;
}

.status-monitor-card:hover {
  background-color: #f1f5f9;
}

.dark .status-monitor-card:hover {
  background-color: #1f2937;
}

.status-monitor-card.edit-mode:hover {
  background-color: #eff6ff;
}

.dark .status-monitor-card.edit-mode:hover {
  background-color: rgba(59, 130, 246, 0.1);
}

.monitor-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.monitor-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex-shrink: 1;
}

.drag-handle {
  cursor: grab;
  opacity: 0.5;
}

.drag-handle:hover {
  opacity: 1;
}

.remove-btn {
  opacity: 0.5;
}

.remove-btn:hover {
  opacity: 1;
}

.monitor-url {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.monitor-name {
  font-weight: 500;
  color: #1e293b;
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dark .monitor-url {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.6875rem;
  color: var(--text-tertiary);
}

.dark .monitor-name {
  color: #e2e8f0;
}

a.monitor-name:hover {
  color: #12b06a;
}

.monitor-details {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.tags {
  display: flex;
  gap: 4px;
}

.heartbeat-bar {
  min-width: 150px;
  max-width: 250px;
}

/* Mobile responsive */
@media (max-width: 768px) {
  .monitor-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .monitor-details {
    justify-content: flex-end;
  }
  
  .heartbeat-bar {
    min-width: 100px;
  }
}
</style>
