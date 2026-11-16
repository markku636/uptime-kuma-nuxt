<template>
  <div class="status-monitor-card" :class="{ 'edit-mode': editMode }">
    <div class="monitor-row">
      <!-- Left side: Status + Name -->
      <div class="monitor-info">
        <!-- Drag handle (edit mode) -->
        <UIcon
          v-if="editMode"
          name="i-heroicons-bars-3"
          class="drag-handle text-dimmed cursor-grab"
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
        
        <!-- Monitor name with optional link -->
        <a
          v-if="showLink && monitor.url"
          :href="monitor.url"
          target="_blank"
          rel="noopener noreferrer"
          class="monitor-name"
        >
          {{ monitor.name }}
        </a>
        <span v-else class="monitor-name">{{ monitor.name }}</span>
        
        <!-- Settings button (edit mode) -->
        <UButton
          v-if="editMode"
          icon="i-heroicons-cog-6-tooth"
          size="xs"
          color="neutral"
          variant="ghost"
          @click="emit('settings')"
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
}>()

const { t } = useI18n()

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
  border-bottom: 1px solid var(--uk-border);
  transition: background-color 0.15s;
  color: var(--uk-text);
}

.status-monitor-card:last-child {
  border-bottom: none;
}

.status-monitor-card:hover {
  background-color: var(--uk-bg-sunken);
}

.status-monitor-card.edit-mode:hover {
  background-color: color-mix(in srgb, var(--uk-status-maintenance) var(--uk-subtle-mix), transparent);
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

.monitor-name {
  font-weight: 500;
  color: var(--uk-text);
  text-decoration: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

a.monitor-name:hover {
  color: var(--uk-status-up-fg);
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
