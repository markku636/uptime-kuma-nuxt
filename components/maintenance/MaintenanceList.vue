<template>
  <div class="maintenance-list space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-medium">{{ $t('Scheduled Maintenance') }}</h2>
      <UButton @click="$emit('add')">
        <UIcon name="i-heroicons-plus" class="mr-1" />
        {{ $t('Add Maintenance') }}
      </UButton>
    </div>

    <!-- Filter -->
    <div class="flex gap-2">
      <UButtonGroup>
        <UButton
          :variant="filter === 'all' ? 'solid' : 'outline'"
          size="sm"
          @click="filter = 'all'"
        >
          {{ $t('All') }}
        </UButton>
        <UButton
          :variant="filter === 'active' ? 'solid' : 'outline'"
          size="sm"
          @click="filter = 'active'"
        >
          {{ $t('Active') }}
        </UButton>
        <UButton
          :variant="filter === 'scheduled' ? 'solid' : 'outline'"
          size="sm"
          @click="filter = 'scheduled'"
        >
          {{ $t('Scheduled') }}
        </UButton>
        <UButton
          :variant="filter === 'ended' ? 'solid' : 'outline'"
          size="sm"
          @click="filter = 'ended'"
        >
          {{ $t('Ended') }}
        </UButton>
      </UButtonGroup>
    </div>

    <!-- Empty State -->
    <div v-if="!filteredMaintenances.length" class="text-center py-8 text-gray-500">
      <UIcon name="i-heroicons-wrench-screwdriver" class="w-12 h-12 mx-auto mb-2" />
      <p>{{ $t('No scheduled maintenance') }}</p>
    </div>

    <!-- Maintenance Items -->
    <div
      v-for="maintenance in filteredMaintenances"
      :key="maintenance.id"
      class="maintenance-item p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4"
      :class="getStatusBorder(maintenance)"
    >
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <!-- Title & Status -->
          <div class="flex items-center gap-2 mb-1">
            <h3 class="font-medium text-gray-900 dark:text-gray-100">
              {{ maintenance.title }}
            </h3>
            <UBadge :color="getStatusColor(maintenance)" size="xs">
              {{ getStatusText(maintenance) }}
            </UBadge>
          </div>

          <!-- Description -->
          <p v-if="maintenance.description" class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            {{ maintenance.description }}
          </p>

          <!-- Time Info -->
          <div class="flex items-center gap-4 text-sm text-gray-500">
            <span v-if="maintenance.startDate">
              <UIcon name="i-heroicons-calendar" class="w-4 h-4 inline mr-1" />
              {{ formatDateTime(maintenance.startDate) }}
            </span>
            <span v-if="maintenance.endDate">
              → {{ formatDateTime(maintenance.endDate) }}
            </span>
            <span v-if="maintenance.strategy === 'recurring'">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 inline mr-1" />
              {{ $t('Recurring') }}
            </span>
          </div>

          <!-- Affected Monitors -->
          <div v-if="maintenance.monitors?.length" class="mt-2 flex flex-wrap gap-1">
            <UBadge
              v-for="monitor in maintenance.monitors.slice(0, 3)"
              :key="monitor.id"
              variant="subtle"
              size="xs"
            >
              {{ monitor.name }}
            </UBadge>
            <UBadge v-if="maintenance.monitors.length > 3" variant="subtle" size="xs">
              +{{ maintenance.monitors.length - 3 }}
            </UBadge>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex items-center gap-2">
          <!-- Toggle Active -->
          <USwitch
            :model-value="maintenance.active"
            @update:model-value="$emit('toggle', maintenance.id, $event)"
          />
          
          <UDropdownMenu :items="getActionItems(maintenance)">
            <UButton variant="ghost" icon="i-heroicons-ellipsis-vertical" size="xs" />
          </UDropdownMenu>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Monitor {
  id: number
  name: string
}

interface Maintenance {
  id: number
  title: string
  description?: string
  strategy: 'single' | 'recurring' | 'manual'
  active: boolean
  startDate?: string
  endDate?: string
  monitors?: Monitor[]
}

const props = defineProps<{
  maintenances: Maintenance[]
}>()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'edit', id: number): void
  (e: 'delete', id: number): void
  (e: 'toggle', id: number, active: boolean): void
}>()

const { t } = useI18n()

const filter = ref<'all' | 'active' | 'scheduled' | 'ended'>('all')

const filteredMaintenances = computed(() => {
  const now = new Date()
  
  return props.maintenances.filter(m => {
    switch (filter.value) {
      case 'active':
        return isActive(m)
      case 'scheduled':
        return isScheduled(m)
      case 'ended':
        return isEnded(m)
      default:
        return true
    }
  })
})

function isActive(m: Maintenance): boolean {
  if (!m.active) return false
  const now = new Date()
  const start = m.startDate ? new Date(m.startDate) : null
  const end = m.endDate ? new Date(m.endDate) : null
  
  if (m.strategy === 'manual') return m.active
  if (!start) return false
  
  return start <= now && (!end || end >= now)
}

function isScheduled(m: Maintenance): boolean {
  if (!m.startDate) return false
  return new Date(m.startDate) > new Date()
}

function isEnded(m: Maintenance): boolean {
  if (!m.endDate) return false
  return new Date(m.endDate) < new Date()
}

function getStatusBorder(m: Maintenance): string {
  if (isActive(m)) return 'border-blue-500'
  if (isScheduled(m)) return 'border-yellow-500'
  if (isEnded(m)) return 'border-gray-300'
  return 'border-gray-300'
}

function getStatusColor(m: Maintenance): 'primary' | 'warning' | 'secondary' {
  if (isActive(m)) return 'primary'
  if (isScheduled(m)) return 'warning'
  return 'secondary'
}

function getStatusText(m: Maintenance): string {
  if (isActive(m)) return t('Active')
  if (isScheduled(m)) return t('Scheduled')
  if (isEnded(m)) return t('Ended')
  return t('Inactive')
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function getActionItems(m: Maintenance) {
  return [
    [
      {
        label: t('Edit'),
        icon: 'i-heroicons-pencil',
        onSelect: () => emit('edit', m.id)
      }
    ],
    [
      {
        label: t('Delete'),
        icon: 'i-heroicons-trash',
        color: 'error' as const,
        onSelect: () => emit('delete', m.id)
      }
    ]
  ]
}
</script>
