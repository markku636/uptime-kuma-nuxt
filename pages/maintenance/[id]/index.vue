<script setup lang="ts">
import type { Maintenance } from '~/types'

definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const maintenanceId = computed(() => Number(route.params.id))

const { data: maintenance, pending, error, refresh } = useFetch<Maintenance>(
  () => `/api/v1/maintenance/${maintenanceId.value}`
)

const showDeleteConfirm = ref(false)
const deleting = ref(false)

const statusConfig = computed(() => {
  if (!maintenance.value) return null
  
  if (maintenance.value.active) {
    return {
      label: 'Active',
      color: 'bg-green-500',
      textColor: 'text-green-600 dark:text-green-400'
    }
  }
  return {
    label: 'Inactive',
    color: 'bg-gray-400',
    textColor: 'text-gray-600 dark:text-gray-400'
  }
})

const strategyLabel = computed(() => {
  if (!maintenance.value) return ''
  
  const labels: Record<string, string> = {
    'manual': 'Manual',
    'single': 'Single Time Window',
    'recurring-interval': 'Recurring (Every N Days)',
    'recurring-weekday': 'Recurring (Weekdays)',
    'recurring-day-of-month': 'Recurring (Days of Month)',
    'status-page': 'Status Page Controlled'
  }
  
  return labels[maintenance.value.strategy] || maintenance.value.strategy
})

async function toggleStatus() {
  if (!maintenance.value) return
  
  try {
    await $fetch(`/api/v1/maintenance/${maintenanceId.value}`, {
      method: 'PUT',
      body: { active: !maintenance.value.active }
    })
    refresh()
    toast.add({
      title: 'Success',
      description: `Maintenance ${maintenance.value.active ? 'deactivated' : 'activated'}`,
      color: 'green'
    })
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to update maintenance',
      color: 'red'
    })
  }
}

async function deleteMaintenance() {
  deleting.value = true
  try {
    await $fetch(`/api/v1/maintenance/${maintenanceId.value}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Deleted',
      description: 'Maintenance deleted successfully',
      color: 'green'
    })
    router.push('/maintenance')
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to delete maintenance',
      color: 'red'
    })
  } finally {
    deleting.value = false
    showDeleteConfirm.value = false
  }
}

function formatTime(time: string) {
  return time || 'N/A'
}

function formatWeekdays(weekdays: number[]) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return weekdays.map(d => dayNames[d]).join(', ')
}
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <!-- Header -->
    <div class="mb-6">
      <NuxtLink
        to="/maintenance"
        class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        Back to Maintenance
      </NuxtLink>
    </div>

    <!-- Loading -->
    <div v-if="pending" class="flex justify-center py-12">
      <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
    </div>

    <!-- Error -->
    <div v-else-if="error" class="text-center py-12">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-12 h-12 mx-auto mb-4 text-red-500" />
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Error Loading Maintenance</h2>
      <p class="text-gray-600 dark:text-gray-400">{{ error.message }}</p>
    </div>

    <!-- Content -->
    <div v-else-if="maintenance" class="space-y-6">
      <!-- Title Card -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div class="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <UIcon name="i-heroicons-wrench-screwdriver" class="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
                {{ maintenance.title }}
              </h1>
              <div class="mt-2 flex items-center gap-3">
                <span
                  v-if="statusConfig"
                  class="inline-flex items-center gap-1.5"
                >
                  <span :class="['w-2 h-2 rounded-full', statusConfig.color]" />
                  <span :class="['text-sm font-medium', statusConfig.textColor]">
                    {{ statusConfig.label }}
                  </span>
                </span>
                <span class="text-sm text-gray-500 dark:text-gray-400">
                  {{ strategyLabel }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <UButton
              :variant="maintenance.active ? 'outline' : 'solid'"
              :color="maintenance.active ? 'gray' : 'green'"
              @click="toggleStatus"
            >
              {{ maintenance.active ? 'Deactivate' : 'Activate' }}
            </UButton>
            <UButton
              variant="outline"
              icon="i-heroicons-pencil"
              @click="router.push(`/maintenance/${maintenanceId}/edit`)"
            >
              Edit
            </UButton>
            <UButton
              variant="outline"
              color="red"
              icon="i-heroicons-trash"
              @click="showDeleteConfirm = true"
            />
          </div>
        </div>

        <p v-if="maintenance.description" class="mt-4 text-gray-600 dark:text-gray-400">
          {{ maintenance.description }}
        </p>
      </div>

      <!-- Schedule Details -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Schedule Details
        </h2>

        <div class="space-y-4">
          <!-- Strategy-specific details -->
          <div v-if="maintenance.strategy === 'single' && maintenance.timeslotList?.length" class="space-y-2">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Time Slots</h3>
            <div
              v-for="(slot, index) in maintenance.timeslotList"
              :key="index"
              class="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <span class="text-gray-900 dark:text-white">
                {{ new Date(slot.startDate).toLocaleString() }}
              </span>
              <span class="text-gray-500 mx-2">→</span>
              <span class="text-gray-900 dark:text-white">
                {{ new Date(slot.endDate).toLocaleString() }}
              </span>
            </div>
          </div>

          <div v-if="maintenance.strategy === 'recurring-interval'" class="grid grid-cols-2 gap-4">
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Interval</h3>
              <p class="text-gray-900 dark:text-white">Every {{ maintenance.intervalDay }} day(s)</p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Time Range</h3>
              <p class="text-gray-900 dark:text-white">
                {{ formatTime(maintenance.timeRange?.start) }} - {{ formatTime(maintenance.timeRange?.end) }}
              </p>
            </div>
          </div>

          <div v-if="maintenance.strategy === 'recurring-weekday'" class="grid grid-cols-2 gap-4">
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Weekdays</h3>
              <p class="text-gray-900 dark:text-white">
                {{ formatWeekdays(maintenance.weekdays || []) || 'None selected' }}
              </p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Time Range</h3>
              <p class="text-gray-900 dark:text-white">
                {{ formatTime(maintenance.timeRange?.start) }} - {{ formatTime(maintenance.timeRange?.end) }}
              </p>
            </div>
          </div>

          <div v-if="maintenance.strategy === 'recurring-day-of-month'" class="grid grid-cols-2 gap-4">
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Days of Month</h3>
              <p class="text-gray-900 dark:text-white">
                {{ (maintenance.daysOfMonth || []).join(', ') || 'None selected' }}
              </p>
            </div>
            <div>
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Time Range</h3>
              <p class="text-gray-900 dark:text-white">
                {{ formatTime(maintenance.timeRange?.start) }} - {{ formatTime(maintenance.timeRange?.end) }}
              </p>
            </div>
          </div>

          <div v-if="maintenance.strategy === 'manual'" class="text-gray-600 dark:text-gray-400">
            This maintenance window is controlled manually. Activate or deactivate it using the buttons above.
          </div>
        </div>
      </div>

      <!-- Affected Monitors -->
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Affected Monitors
        </h2>

        <div v-if="maintenance.monitors?.length" class="space-y-2">
          <NuxtLink
            v-for="monitor in maintenance.monitors"
            :key="monitor.id"
            :to="`/monitors/${monitor.id}`"
            class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <UIcon name="i-heroicons-server" class="w-5 h-5 text-gray-500" />
            <span class="text-gray-900 dark:text-white">{{ monitor.name }}</span>
          </NuxtLink>
        </div>
        <p v-else class="text-gray-500 dark:text-gray-400">
          No monitors are affected by this maintenance.
        </p>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <CommonConfirmDialog
      v-model:open="showDeleteConfirm"
      title="Delete Maintenance"
      message="Are you sure you want to delete this maintenance? This action cannot be undone."
      confirm-text="Delete"
      type="danger"
      :loading="deleting"
      @confirm="deleteMaintenance"
    />
  </div>
</template>
