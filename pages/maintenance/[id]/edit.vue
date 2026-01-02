<script setup lang="ts">
import type { Maintenance } from '~/types'

definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const maintenanceId = computed(() => Number(route.params.id))
const isEdit = computed(() => !!route.params.id)

const { data: maintenance, pending: loadingMaintenance } = useFetch<Maintenance>(
  () => `/api/v1/maintenance/${maintenanceId.value}`,
  {
    immediate: isEdit.value,
    headers: useRequestHeaders(['cookie'])
  }
)

const { data: monitors } = useFetch('/api/v1/monitors', {
  headers: useRequestHeaders(['cookie'])
})

// Form state
const form = ref({
  title: '',
  description: '',
  strategy: 'manual' as 'manual' | 'single' | 'recurring-interval' | 'recurring-weekday' | 'recurring-day-of-month' | 'status-page',
  active: true,
  intervalDay: 1,
  dateRange: [] as string[],
  weekdays: [] as number[],
  daysOfMonth: [] as number[],
  timeRange: { start: '00:00', end: '23:59' },
  timeslotList: [] as { startDate: string; endDate: string }[],
  monitors: [] as number[],
  statusPages: [] as string[]
})

const loading = ref(false)

// Initialize form with maintenance data
watch(maintenance, (val) => {
  if (val) {
    form.value = {
      title: val.title,
      description: val.description || '',
      strategy: val.strategy,
      active: val.active,
      intervalDay: val.intervalDay || 1,
      dateRange: val.dateRange || [],
      weekdays: val.weekdays || [],
      daysOfMonth: val.daysOfMonth || [],
      timeRange: val.timeRange || { start: '00:00', end: '23:59' },
      timeslotList: val.timeslotList || [],
      monitors: val.monitors?.map((m: any) => m.id) || [],
      statusPages: val.statusPages || []
    }
  }
}, { immediate: true })

const strategyOptions = [
  { value: 'manual', label: 'Manual - Activate/Deactivate manually' },
  { value: 'single', label: 'Single - One time maintenance window' },
  { value: 'recurring-interval', label: 'Recurring - Every N days' },
  { value: 'recurring-weekday', label: 'Recurring - Specific weekdays' },
  { value: 'recurring-day-of-month', label: 'Recurring - Specific days of month' },
  { value: 'status-page', label: 'Status Page - Controlled by status page' }
]

const weekdayOptions = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

function addTimeslot() {
  form.value.timeslotList.push({
    startDate: new Date().toISOString().slice(0, 16),
    endDate: new Date(Date.now() + 3600000).toISOString().slice(0, 16)
  })
}

function removeTimeslot(index: number) {
  form.value.timeslotList.splice(index, 1)
}

async function handleSubmit() {
  loading.value = true
  try {
    if (isEdit.value) {
      await $fetch(`/api/v1/maintenance/${maintenanceId.value}`, {
        method: 'PUT',
        body: form.value
      })
      toast.add({
        title: 'Success',
        description: 'Maintenance updated successfully',
        color: 'green'
      })
    } else {
      await $fetch('/api/v1/maintenance', {
        method: 'POST',
        body: form.value
      })
      toast.add({
        title: 'Success',
        description: 'Maintenance created successfully',
        color: 'green'
      })
    }
    router.push('/maintenance')
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save maintenance',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="mb-6">
      <NuxtLink
        to="/maintenance"
        class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        Back to Maintenance
      </NuxtLink>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ isEdit ? 'Edit Maintenance' : 'New Maintenance' }}
        </h1>
      </div>

      <form class="p-6 space-y-6" @submit.prevent="handleSubmit">
        <!-- Basic Info -->
        <div class="space-y-4">
          <UFormField label="Title" required>
            <UInput v-model="form.title" placeholder="Scheduled Maintenance" />
          </UFormField>

          <UFormField label="Description">
            <UTextarea
              v-model="form.description"
              placeholder="Describe the maintenance..."
              :rows="3"
            />
          </UFormField>
        </div>

        <!-- Strategy -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Schedule Strategy</h3>
          
          <UFormField label="Strategy" required>
            <USelect
              v-model="form.strategy"
              :items="strategyOptions.map(s => ({ label: s.label, value: s.value }))"
            />
          </UFormField>

          <!-- Single Maintenance Time Slots -->
          <div v-if="form.strategy === 'single'" class="space-y-3">
            <div class="flex items-center justify-between">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Time Slots
              </label>
              <UButton size="sm" variant="outline" @click="addTimeslot">
                Add Time Slot
              </UButton>
            </div>
            
            <div
              v-for="(slot, index) in form.timeslotList"
              :key="index"
              class="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <UInput
                v-model="slot.startDate"
                type="datetime-local"
                class="flex-1"
              />
              <span class="text-gray-500">to</span>
              <UInput
                v-model="slot.endDate"
                type="datetime-local"
                class="flex-1"
              />
              <UButton
                variant="ghost"
                color="red"
                icon="i-heroicons-trash"
                @click="removeTimeslot(index)"
              />
            </div>
          </div>

          <!-- Recurring Interval -->
          <div v-if="form.strategy === 'recurring-interval'" class="space-y-4">
            <UFormField label="Repeat every N days">
              <UInput v-model.number="form.intervalDay" type="number" min="1" max="365" />
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Start Time">
                <UInput v-model="form.timeRange.start" type="time" />
              </UFormField>
              <UFormField label="End Time">
                <UInput v-model="form.timeRange.end" type="time" />
              </UFormField>
            </div>
          </div>

          <!-- Recurring Weekdays -->
          <div v-if="form.strategy === 'recurring-weekday'" class="space-y-4">
            <UFormField label="Select Weekdays">
              <div class="flex flex-wrap gap-2">
                <UButton
                  v-for="day in weekdayOptions"
                  :key="day.value"
                  :variant="form.weekdays.includes(day.value) ? 'solid' : 'outline'"
                  size="sm"
                  @click="
                    form.weekdays.includes(day.value)
                      ? form.weekdays = form.weekdays.filter(d => d !== day.value)
                      : form.weekdays.push(day.value)
                  "
                >
                  {{ day.label.slice(0, 3) }}
                </UButton>
              </div>
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Start Time">
                <UInput v-model="form.timeRange.start" type="time" />
              </UFormField>
              <UFormField label="End Time">
                <UInput v-model="form.timeRange.end" type="time" />
              </UFormField>
            </div>
          </div>

          <!-- Recurring Day of Month -->
          <div v-if="form.strategy === 'recurring-day-of-month'" class="space-y-4">
            <UFormField label="Days of Month (1-31)">
              <div class="flex flex-wrap gap-1">
                <UButton
                  v-for="day in 31"
                  :key="day"
                  :variant="form.daysOfMonth.includes(day) ? 'solid' : 'outline'"
                  size="xs"
                  class="w-8 h-8"
                  @click="
                    form.daysOfMonth.includes(day)
                      ? form.daysOfMonth = form.daysOfMonth.filter(d => d !== day)
                      : form.daysOfMonth.push(day)
                  "
                >
                  {{ day }}
                </UButton>
              </div>
            </UFormField>

            <div class="grid grid-cols-2 gap-4">
              <UFormField label="Start Time">
                <UInput v-model="form.timeRange.start" type="time" />
              </UFormField>
              <UFormField label="End Time">
                <UInput v-model="form.timeRange.end" type="time" />
              </UFormField>
            </div>
          </div>
        </div>

        <!-- Affected Monitors -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Affected Monitors</h3>
          
          <UFormField label="Select Monitors">
            <USelectMenu
              v-model="form.monitors"
              :items="(monitors || []).map((m: any) => ({ label: m.name, value: m.id }))"
              multiple
              placeholder="Select monitors..."
            />
          </UFormField>
        </div>

        <!-- Status -->
        <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
          <UCheckbox v-model="form.active" label="Active" />
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <UButton variant="ghost" @click="router.push('/maintenance')">
            Cancel
          </UButton>
          <UButton type="submit" :loading="loading">
            {{ isEdit ? 'Update' : 'Create' }} Maintenance
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>
