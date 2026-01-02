<script setup lang="ts">
import type { Monitor } from '~/types'

interface Props {
  monitors: Monitor[]
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  (e: 'select', monitor: Monitor): void
  (e: 'pause', monitor: Monitor): void
  (e: 'resume', monitor: Monitor): void
  (e: 'delete', monitor: Monitor): void
}>()

const selectedId = defineModel<number | null>('selectedId', { default: null })

// Group monitors by type or tag
const groupedMonitors = computed(() => {
  const groups: Record<string, Monitor[]> = {}
  
  for (const monitor of props.monitors) {
    const type = monitor.type.toUpperCase()
    if (!groups[type]) {
      groups[type] = []
    }
    groups[type].push(monitor)
  }
  
  return groups
})

function getStatusColor(monitor: Monitor): string {
  if (!monitor.active) return 'gray'
  // Would need heartbeat data to determine actual status
  return 'green'
}

function getStatusText(monitor: Monitor): string {
  if (!monitor.active) return 'Paused'
  return 'Up'
}
</script>

<template>
  <div class="space-y-4">
    <!-- Loading State -->
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 5"
        :key="i"
        class="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse"
      ></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="monitors.length === 0"
      class="text-center py-12 text-gray-500"
    >
      <UIcon name="i-heroicons-server" class="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <p>No monitors found</p>
    </div>

    <!-- Monitor Groups -->
    <template v-else>
      <div v-for="(groupMonitors, groupName) in groupedMonitors" :key="groupName">
        <h3 class="text-sm font-medium text-gray-500 mb-2">{{ groupName }}</h3>
        
        <div class="space-y-2">
          <div
            v-for="monitor in groupMonitors"
            :key="monitor.id"
            :class="[
              'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
              selectedId === monitor.id
                ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500'
                : 'bg-white dark:bg-gray-800 border-2 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700'
            ]"
            @click="selectedId = monitor.id; emit('select', monitor)"
          >
            <!-- Status Indicator -->
            <span
              :class="[
                'w-3 h-3 rounded-full flex-shrink-0',
                getStatusColor(monitor) === 'green' ? 'bg-green-500' :
                getStatusColor(monitor) === 'red' ? 'bg-red-500' : 'bg-gray-400'
              ]"
            ></span>

            <!-- Monitor Info -->
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ monitor.name }}</p>
              <p class="text-xs text-gray-500 truncate">
                {{ monitor.url || monitor.hostname || monitor.keyword }}
              </p>
            </div>

            <!-- Status Badge -->
            <UBadge
              :color="getStatusColor(monitor) === 'green' ? 'success' :
                     getStatusColor(monitor) === 'red' ? 'error' : 'neutral'"
              size="xs"
            >
              {{ getStatusText(monitor) }}
            </UBadge>

            <!-- Actions Dropdown -->
            <UDropdown
              :items="[
                [
                  {
                    label: monitor.active ? 'Pause' : 'Resume',
                    icon: monitor.active ? 'i-heroicons-pause' : 'i-heroicons-play',
                    click: () => monitor.active ? emit('pause', monitor) : emit('resume', monitor)
                  },
                  {
                    label: 'Edit',
                    icon: 'i-heroicons-pencil',
                    to: `/monitors/${monitor.id}/edit`
                  }
                ],
                [
                  {
                    label: 'Delete',
                    icon: 'i-heroicons-trash',
                    color: 'error',
                    click: () => emit('delete', monitor)
                  }
                ]
              ]"
            >
              <UButton
                icon="i-heroicons-ellipsis-vertical"
                variant="ghost"
                size="xs"
                @click.stop
              />
            </UDropdown>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
