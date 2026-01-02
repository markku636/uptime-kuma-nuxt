<template>
  <UModal v-model:open="isOpen" :title="isEdit ? 'Edit Maintenance' : 'Schedule Maintenance'" size="2xl">
    <template #body>
      <form @submit.prevent="handleSubmit" class="space-y-6">
        <!-- Basic Info -->
        <div class="space-y-4">
          <UFormField label="Title" required>
            <UInput 
              v-model="formData.title" 
              placeholder="e.g., Server Upgrade"
              class="w-full"
            />
          </UFormField>

          <UFormField label="Description">
            <UTextarea 
              v-model="formData.description" 
              placeholder="Describe the maintenance work..."
              :rows="3"
              class="w-full"
            />
          </UFormField>
        </div>

        <!-- Schedule Strategy -->
        <UFormField label="Schedule">
          <USelectMenu
            v-model="formData.strategy"
            :items="strategies"
            value-key="value"
            label-key="label"
            class="w-full"
          />
        </UFormField>

        <!-- Strategy-specific options -->
        <div v-if="formData.strategy === 'manual'" class="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Manual maintenance can be started and stopped manually at any time.
          </p>
        </div>

        <div v-else-if="formData.strategy === 'single'" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Start Time">
              <UInput 
                v-model="formData.startDate" 
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
            <UFormField label="End Time">
              <UInput 
                v-model="formData.endDate" 
                type="datetime-local"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div v-else-if="formData.strategy === 'recurring-interval'" class="space-y-4">
          <UFormField label="Repeat every">
            <div class="flex items-center gap-2">
              <UInput 
                v-model.number="formData.intervalDay" 
                type="number"
                min="1"
                class="w-24"
              />
              <span>day(s)</span>
            </div>
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Time Window Start">
              <UInput 
                v-model="formData.timeRangeStart" 
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Time Window End">
              <UInput 
                v-model="formData.timeRangeEnd" 
                type="time"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div v-else-if="formData.strategy === 'recurring-weekday'" class="space-y-4">
          <UFormField label="Days of Week">
            <div class="flex flex-wrap gap-2">
              <button
                v-for="day in weekdays"
                :key="day.value"
                type="button"
                :class="[
                  'px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
                  formData.weekdays.includes(day.value)
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                ]"
                @click="toggleWeekday(day.value)"
              >
                {{ day.label }}
              </button>
            </div>
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Time Window Start">
              <UInput 
                v-model="formData.timeRangeStart" 
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Time Window End">
              <UInput 
                v-model="formData.timeRangeEnd" 
                type="time"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div v-else-if="formData.strategy === 'recurring-day-of-month'" class="space-y-4">
          <UFormField label="Days of Month">
            <div class="flex flex-wrap gap-1">
              <button
                v-for="day in 31"
                :key="day"
                type="button"
                :class="[
                  'w-8 h-8 rounded text-sm font-medium transition-colors',
                  formData.daysOfMonth.includes(day)
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                ]"
                @click="toggleDayOfMonth(day)"
              >
                {{ day }}
              </button>
            </div>
          </UFormField>
          <div class="grid grid-cols-2 gap-4">
            <UFormField label="Time Window Start">
              <UInput 
                v-model="formData.timeRangeStart" 
                type="time"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Time Window End">
              <UInput 
                v-model="formData.timeRangeEnd" 
                type="time"
                class="w-full"
              />
            </UFormField>
          </div>
        </div>

        <div v-else-if="formData.strategy === 'cron'" class="space-y-4">
          <UFormField label="Cron Expression">
            <UInput 
              v-model="formData.cron" 
              placeholder="0 2 * * *"
              class="w-full"
            />
            <template #hint>
              <a href="https://crontab.guru/" target="_blank" class="text-primary-500 hover:underline">
                Need help with cron expressions?
              </a>
            </template>
          </UFormField>
          <UFormField label="Duration (minutes)">
            <UInput 
              v-model.number="formData.duration" 
              type="number"
              min="1"
              class="w-32"
            />
          </UFormField>
        </div>

        <!-- Affected Monitors -->
        <UFormField label="Affected Monitors">
          <div class="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-2">
            <div 
              v-for="monitor in monitors"
              :key="monitor.id"
              class="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded"
            >
              <UCheckbox 
                :model-value="formData.monitors.includes(monitor.id)"
                @update:model-value="toggleMonitor(monitor.id)"
              />
              <span>{{ monitor.name }}</span>
            </div>
          </div>
        </UFormField>

        <!-- Status -->
        <UFormField>
          <UCheckbox 
            v-model="formData.active" 
            label="Active"
          />
          <template #hint>
            Inactive maintenances will not affect monitor status
          </template>
        </UFormField>

        <div class="flex justify-end gap-2 pt-4">
          <UButton variant="ghost" @click="close">
            Cancel
          </UButton>
          <UButton type="submit" color="primary" :loading="loading">
            {{ isEdit ? 'Update' : 'Create' }} Maintenance
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>

<script setup lang="ts">
interface Maintenance {
  id?: number
  title: string
  description?: string
  strategy: string
  active: boolean
  dateRange?: any
  intervalDay?: number
  weekdays?: number[]
  daysOfMonth?: number[]
  timeRange?: any
  cron?: string
  duration?: number
  monitors?: number[]
}

interface Monitor {
  id: number
  name: string
}

interface Props {
  maintenance?: Maintenance | null
  monitors?: Monitor[]
}

const props = withDefaults(defineProps<Props>(), {
  maintenance: null,
  monitors: () => []
})

const emit = defineEmits<{
  saved: [maintenance: Maintenance]
  closed: []
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const toast = useToast()
const loading = ref(false)

const isEdit = computed(() => !!props.maintenance?.id)

const strategies = [
  { value: 'manual', label: 'Manual - Start and stop manually' },
  { value: 'single', label: 'Single - One-time maintenance window' },
  { value: 'recurring-interval', label: 'Recurring - Every X days' },
  { value: 'recurring-weekday', label: 'Recurring - Specific days of week' },
  { value: 'recurring-day-of-month', label: 'Recurring - Specific days of month' },
  { value: 'cron', label: 'Cron - Advanced scheduling' }
]

const weekdays = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
]

const defaultFormData = {
  title: '',
  description: '',
  strategy: 'manual',
  active: true,
  startDate: '',
  endDate: '',
  intervalDay: 1,
  weekdays: [] as number[],
  daysOfMonth: [] as number[],
  timeRangeStart: '02:00',
  timeRangeEnd: '04:00',
  cron: '',
  duration: 60,
  monitors: [] as number[]
}

const formData = ref({ ...defaultFormData })

// Watch for maintenance changes
watch(() => props.maintenance, (newVal) => {
  if (newVal) {
    formData.value = {
      title: newVal.title || '',
      description: newVal.description || '',
      strategy: newVal.strategy || 'manual',
      active: newVal.active ?? true,
      startDate: newVal.dateRange?.[0] || '',
      endDate: newVal.dateRange?.[1] || '',
      intervalDay: newVal.intervalDay || 1,
      weekdays: newVal.weekdays || [],
      daysOfMonth: newVal.daysOfMonth || [],
      timeRangeStart: newVal.timeRange?.[0] || '02:00',
      timeRangeEnd: newVal.timeRange?.[1] || '04:00',
      cron: newVal.cron || '',
      duration: newVal.duration || 60,
      monitors: newVal.monitors || []
    }
  } else {
    formData.value = { ...defaultFormData }
  }
}, { immediate: true })

// Reset when opening
watch(isOpen, (newVal) => {
  if (newVal && !props.maintenance) {
    formData.value = { ...defaultFormData }
  }
})

function toggleWeekday(day: number) {
  const index = formData.value.weekdays.indexOf(day)
  if (index === -1) {
    formData.value.weekdays.push(day)
  } else {
    formData.value.weekdays.splice(index, 1)
  }
}

function toggleDayOfMonth(day: number) {
  const index = formData.value.daysOfMonth.indexOf(day)
  if (index === -1) {
    formData.value.daysOfMonth.push(day)
  } else {
    formData.value.daysOfMonth.splice(index, 1)
  }
}

function toggleMonitor(monitorId: number) {
  const index = formData.value.monitors.indexOf(monitorId)
  if (index === -1) {
    formData.value.monitors.push(monitorId)
  } else {
    formData.value.monitors.splice(index, 1)
  }
}

async function handleSubmit() {
  if (!formData.value.title.trim()) {
    toast.add({
      title: 'Validation Error',
      description: 'Title is required',
      color: 'error'
    })
    return
  }

  loading.value = true
  try {
    const data: any = {
      title: formData.value.title,
      description: formData.value.description,
      strategy: formData.value.strategy,
      active: formData.value.active,
      monitors: formData.value.monitors
    }

    // Add strategy-specific data
    if (formData.value.strategy === 'single') {
      data.dateRange = [formData.value.startDate, formData.value.endDate]
    } else if (formData.value.strategy === 'recurring-interval') {
      data.intervalDay = formData.value.intervalDay
      data.timeRange = [formData.value.timeRangeStart, formData.value.timeRangeEnd]
    } else if (formData.value.strategy === 'recurring-weekday') {
      data.weekdays = formData.value.weekdays
      data.timeRange = [formData.value.timeRangeStart, formData.value.timeRangeEnd]
    } else if (formData.value.strategy === 'recurring-day-of-month') {
      data.daysOfMonth = formData.value.daysOfMonth
      data.timeRange = [formData.value.timeRangeStart, formData.value.timeRangeEnd]
    } else if (formData.value.strategy === 'cron') {
      data.cron = formData.value.cron
      data.duration = formData.value.duration
    }

    let result
    if (isEdit.value && props.maintenance?.id) {
      result = await $fetch(`/api/v1/maintenance/${props.maintenance.id}`, {
        method: 'PUT',
        body: data
      })
      toast.add({
        title: 'Success',
        description: 'Maintenance updated successfully',
        color: 'success'
      })
    } else {
      result = await $fetch('/api/v1/maintenance', {
        method: 'POST',
        body: data
      })
      toast.add({
        title: 'Success',
        description: 'Maintenance created successfully',
        color: 'success'
      })
    }

    emit('saved', result)
    close()
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.message || 'Failed to save maintenance',
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

function close() {
  isOpen.value = false
  emit('closed')
}
</script>
