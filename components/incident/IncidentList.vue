<template>
  <div class="incident-list space-y-3">
    <!-- Empty State -->
    <div v-if="!incidents.length" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-check-circle" class="w-12 h-12 mx-auto mb-2 text-green-500" />
      <p>{{ $t('No incidents recorded') }}</p>
    </div>

    <!-- Incident Items -->
    <div
      v-for="incident in incidents"
      :key="incident.id"
      class="incident-item p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4"
      :class="getBorderColor(incident.status)"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1 min-w-0">
          <!-- Status & Title -->
          <div class="flex items-center gap-2 mb-1">
            <UIcon 
              :name="getStatusIcon(incident.status)" 
              class="w-5 h-5"
              :class="getStatusColor(incident.status)"
            />
            <h4 class="font-medium text-gray-900 dark:text-gray-100 truncate">
              {{ incident.title }}
            </h4>
          </div>

          <!-- Description -->
          <p v-if="incident.description" class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {{ incident.description }}
          </p>

          <!-- Monitor Info -->
          <div v-if="incident.monitor" class="flex items-center gap-2 text-sm text-gray-500">
            <UIcon name="i-heroicons-server" class="w-4 h-4" />
            <span>{{ incident.monitor.name }}</span>
          </div>

          <!-- Duration -->
          <div class="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>
              <UIcon name="i-heroicons-clock" class="w-3 h-3 inline mr-1" />
              {{ formatDuration(incident.startTime, incident.endTime) }}
            </span>
            <span v-if="incident.endTime">
              {{ $t('Resolved') }}: {{ formatDateTime(incident.endTime) }}
            </span>
            <span v-else class="text-yellow-500 font-medium">
              {{ $t('Ongoing') }}
            </span>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <UButton
            v-if="!incident.endTime"
            variant="outline"
            size="xs"
            color="success"
            @click="$emit('resolve', incident)"
          >
            {{ $t('Resolve') }}
          </UButton>
          
          <UDropdownMenu v-if="showActions" :items="getActionItems(incident)">
            <UButton variant="ghost" icon="i-heroicons-ellipsis-vertical" size="xs" />
          </UDropdownMenu>
        </div>
      </div>
    </div>

    <!-- Load More -->
    <div v-if="hasMore" class="text-center">
      <UButton variant="ghost" :loading="loading" @click="$emit('loadMore')">
        {{ $t('Load more') }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Monitor {
  id: number
  name: string
}

interface Incident {
  id: number
  title: string
  description?: string
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved'
  startTime: string
  endTime?: string
  monitor?: Monitor
}

const props = withDefaults(defineProps<{
  incidents: Incident[]
  showActions?: boolean
  hasMore?: boolean
  loading?: boolean
}>(), {
  showActions: true,
  hasMore: false,
  loading: false,
})

const emit = defineEmits<{
  (e: 'resolve', incident: Incident): void
  (e: 'edit', incident: Incident): void
  (e: 'delete', incident: Incident): void
  (e: 'loadMore'): void
}>()

const { t } = useI18n()

function getBorderColor(status: string): string {
  switch (status) {
    case 'investigating':
      return 'border-red-500'
    case 'identified':
      return 'border-orange-500'
    case 'monitoring':
      return 'border-yellow-500'
    case 'resolved':
      return 'border-green-500'
    default:
      return 'border-gray-300'
  }
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'investigating':
      return 'i-heroicons-magnifying-glass'
    case 'identified':
      return 'i-heroicons-exclamation-triangle'
    case 'monitoring':
      return 'i-heroicons-eye'
    case 'resolved':
      return 'i-heroicons-check-circle'
    default:
      return 'i-heroicons-question-mark-circle'
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'investigating':
      return 'text-red-500'
    case 'identified':
      return 'text-orange-500'
    case 'monitoring':
      return 'text-yellow-500'
    case 'resolved':
      return 'text-green-500'
    default:
      return 'text-gray-500'
  }
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function formatDuration(startStr: string, endStr?: string): string {
  const start = new Date(startStr)
  const end = endStr ? new Date(endStr) : new Date()
  
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  
  if (diffDays > 0) {
    return `${diffDays}d ${diffHours % 24}h`
  } else if (diffHours > 0) {
    return `${diffHours}h ${diffMins % 60}m`
  } else {
    return `${diffMins}m`
  }
}

function getActionItems(incident: Incident) {
  return [
    [
      {
        label: t('Edit'),
        icon: 'i-heroicons-pencil',
        onSelect: () => emit('edit', incident)
      }
    ],
    [
      {
        label: t('Delete'),
        icon: 'i-heroicons-trash',
        color: 'error' as const,
        onSelect: () => emit('delete', incident)
      }
    ]
  ]
}
</script>
