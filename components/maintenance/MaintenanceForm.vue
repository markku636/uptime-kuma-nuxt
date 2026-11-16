<script setup lang="ts">
// Create / edit / clone a maintenance window. Mirrors upstream EditMaintenance.vue.
import cronstrue from 'cronstrue/i18n'
import type { Maintenance, MaintenanceInput, MaintenanceStrategy } from '~/composables/useMaintenances'
import { errorMessage } from '~/composables/useMaintenances'

const props = defineProps<{
  /** Edit this maintenance */
  id?: number
  /** Prefill from this maintenance and create a new one */
  cloneId?: number
}>()

const { t, locale } = useI18n()
const toast = useToast()
const router = useRouter()
const { getMaintenance, createMaintenance, updateMaintenance } = useMaintenances({ autoFetch: false, live: false })

const isEdit = computed(() => !!props.id)
const loading = ref(true)
const saving = ref(false)
const loadError = ref<string | null>(null)
const fieldError = ref<string | null>(null)

// ---------- Form state ----------
const form = reactive({
  title: '',
  description: '',
  strategy: 'single' as MaintenanceStrategy,
  intervalDay: 1,
  startDateTime: '',
  endDateTime: '',
  startTime: '02:00',
  endTime: '03:00',
  weekdays: [] as number[],
  daysOfMonth: [] as (number | string)[],
  cron: '30 3 * * *',
  durationMinutes: 60,
  timezoneOption: 'SAME_AS_SERVER',
  monitors: [] as number[],
  statusPages: [] as number[],
})

const strategyOptions = computed(() => [
  { label: t('strategyManual'), value: 'manual' },
  { label: t('Single Maintenance Window'), value: 'single' },
  { label: t('cronExpression'), value: 'cron' },
  { label: `${t('Recurring')} - ${t('recurringInterval')}`, value: 'recurring-interval' },
  { label: `${t('Recurring')} - ${t('dayOfWeek')}`, value: 'recurring-weekday' },
  { label: `${t('Recurring')} - ${t('dayOfMonth')}`, value: 'recurring-day-of-month' },
])

const isRecurring = computed(() => form.strategy.startsWith('recurring-'))
const usesTimezone = computed(() => form.strategy !== 'manual')
const usesDateRange = computed(() => form.strategy !== 'manual')

// Monday first, values follow cron (0 = Sunday)
const weekdayOptions = computed(() => [
  { value: 1, label: t('weekdayShortMon') },
  { value: 2, label: t('weekdayShortTue') },
  { value: 3, label: t('weekdayShortWed') },
  { value: 4, label: t('weekdayShortThu') },
  { value: 5, label: t('weekdayShortFri') },
  { value: 6, label: t('weekdayShortSat') },
  { value: 0, label: t('weekdayShortSun') },
])

function toggle<T>(list: T[], value: T) {
  const i = list.indexOf(value)
  if (i >= 0) list.splice(i, 1)
  else list.push(value)
}

// ---------- Timezones ----------
const timezoneOptions = computed(() => {
  const zones: string[] = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['UTC']
  const now = new Date()
  const offsetOf = (tz: string) => {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(now)
      .find(p => p.type === 'timeZoneName')?.value || 'GMT'
    return part === 'GMT' ? 'UTC+00:00' : part.replace('GMT', 'UTC')
  }
  return [
    { label: t('sameAsServerTimezone'), value: 'SAME_AS_SERVER' },
    { label: 'UTC', value: 'UTC' },
    ...zones.filter(z => z !== 'UTC').map(z => ({ label: `(${offsetOf(z)}) ${z}`, value: z })),
  ]
})

// ---------- Cron description ----------
function cronstrueLocale(code: string) {
  const normalized = code.replace('-', '_')
  const locales = (cronstrue as any).locales || {}
  if (locales[normalized]) return normalized
  const base = normalized.split('_')[0]
  return locales[base] ? base : 'en'
}

const cronDescription = computed(() => {
  if (form.strategy !== 'cron' || !form.cron.trim()) return ''
  try {
    return cronstrue.toString(form.cron, { locale: cronstrueLocale(locale.value), use24HourTimeFormat: true })
  } catch {
    return ''
  }
})
const cronInvalid = computed(() => form.strategy === 'cron' && form.cron.trim() !== '' && !cronDescription.value)

// ---------- Monitors / status pages ----------
interface MonitorOption { id: number; name: string; parent?: number | null }
const monitorOptions = ref<{ label: string; value: number }[]>([])
const statusPageOptions = ref<{ label: string; value: number }[]>([])

function buildMonitorOptions(list: MonitorOption[]) {
  const byId = new Map(list.map(m => [m.id, m]))
  const pathName = (m: MonitorOption) => {
    const parts = [m.name]
    let parent = m.parent ? byId.get(m.parent) : undefined
    for (let i = 0; parent && i < 10; i++) {
      parts.unshift(parent.name)
      parent = parent.parent ? byId.get(parent.parent) : undefined
    }
    return parts.join(' / ')
  }
  return list
    .map(m => ({ label: pathName(m), value: m.id }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

const allMonitorsSelected = computed(() =>
  monitorOptions.value.length > 0 && form.monitors.length === monitorOptions.value.length,
)

function toggleAllMonitors() {
  form.monitors = allMonitorsSelected.value ? [] : monitorOptions.value.map(o => o.value)
}

// ---------- Load ----------
const toInputDateTime = (v?: string | null) => (v ? v.replace(' ', 'T').slice(0, 16) : '')
const pad = (n: number) => String(n).padStart(2, '0')

function fillFrom(m: Maintenance) {
  form.title = props.cloneId ? `${m.title} (Clone)` : m.title
  form.description = m.description || ''
  form.strategy = m.strategy
  form.intervalDay = m.intervalDay || 1
  form.startDateTime = toInputDateTime(m.dateRange?.[0])
  form.endDateTime = toInputDateTime(m.dateRange?.[1])
  if (m.timeRange?.length === 2) {
    form.startTime = `${pad(m.timeRange[0].hours)}:${pad(m.timeRange[0].minutes)}`
    form.endTime = `${pad(m.timeRange[1].hours)}:${pad(m.timeRange[1].minutes)}`
  }
  form.weekdays = [...(m.weekdays || [])]
  form.daysOfMonth = [...(m.daysOfMonth || [])]
  form.cron = m.cron || form.cron
  form.durationMinutes = m.durationMinutes || 60
  form.timezoneOption = m.timezoneOption || 'SAME_AS_SERVER'
  form.monitors = [...(m.monitors || [])]
  form.statusPages = [...(m.statusPages || [])]
}

onMounted(async () => {
  try {
    const sourceId = props.id || props.cloneId
    const [monitorsRes, statusPagesRes, source] = await Promise.all([
      $fetch<{ data: MonitorOption[] }>('/api/v1/monitors'),
      $fetch<{ data: { id: number; title: string; slug: string }[] }>('/api/v1/status-pages'),
      sourceId ? getMaintenance(sourceId) : Promise.resolve(null),
    ])
    monitorOptions.value = buildMonitorOptions(monitorsRes.data || [])
    statusPageOptions.value = (statusPagesRes.data || []).map(p => ({ label: `${p.title} (/${p.slug})`, value: p.id }))
    if (source) fillFrom(source)
  } catch (e) {
    loadError.value = errorMessage(e, 'Failed to load maintenance')
  } finally {
    loading.value = false
  }
})

// ---------- Submit ----------
function toTimeOfDay(value: string) {
  const [h, m] = value.split(':').map(Number)
  return { hours: h || 0, minutes: m || 0 }
}

function buildInput(): MaintenanceInput {
  return {
    title: form.title.trim(),
    description: form.description,
    strategy: form.strategy,
    intervalDay: Number(form.intervalDay) || 1,
    dateRange: usesDateRange.value ? [form.startDateTime || null, form.endDateTime || null] : [],
    timeRange: [toTimeOfDay(form.startTime), toTimeOfDay(form.endTime)],
    weekdays: form.weekdays,
    daysOfMonth: form.daysOfMonth,
    cron: form.cron.trim(),
    durationMinutes: Number(form.durationMinutes) || 60,
    timezoneOption: form.timezoneOption,
    monitors: form.monitors,
    statusPages: form.statusPages,
  }
}

async function submit() {
  fieldError.value = null
  if (cronInvalid.value) {
    fieldError.value = t('invalidCronExpression', [form.cron])
    return
  }
  saving.value = true
  try {
    const input = buildInput()
    const saved = isEdit.value ? await updateMaintenance(props.id!, input) : await createMaintenance(input)
    toast.add({ title: t('Saved.'), color: 'success', icon: 'i-heroicons-check-circle' })
    router.push(`/maintenance/${saved.id}`)
  } catch (e) {
    fieldError.value = errorMessage(e, 'Failed to save maintenance')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-4xl px-4 py-6">
    <NuxtLink to="/maintenance" class="inline-flex items-center gap-1 text-sm text-muted hover:text-default">
      <UIcon name="i-heroicons-arrow-left" class="size-4" />
      {{ t('Maintenance') }}
    </NuxtLink>
    <h1 class="mt-2 mb-6 text-2xl font-semibold text-highlighted">
      {{ isEdit ? t('Edit Maintenance') : cloneId ? t('Clone Maintenance') : t('Schedule Maintenance') }}
    </h1>

    <div v-if="loading" class="flex justify-center py-16">
      <div class="spinner size-8" />
    </div>

    <UAlert v-else-if="loadError" color="error" variant="subtle" :title="loadError" icon="i-heroicons-exclamation-triangle" />

    <form v-else class="space-y-6" @submit.prevent="submit">
      <!-- General -->
      <section class="card card-body space-y-4">
        <UFormField :label="t('Title')" required>
          <UInput v-model="form.title" class="w-full" maxlength="150" required />
        </UFormField>

        <UFormField :label="t('Description')" :hint="t('markdownSupported')">
          <UTextarea v-model="form.description" class="w-full" :rows="3" autoresize />
        </UFormField>
      </section>

      <!-- Affected -->
      <section class="card card-body space-y-4">
        <h2 class="font-semibold text-highlighted">{{ t('Affected') }}</h2>

        <UFormField :label="t('Affected Monitors')" :description="t('affectedMonitorsDescription')">
          <div class="flex flex-col gap-2 sm:flex-row">
            <USelectMenu
              v-model="form.monitors"
              :items="monitorOptions"
              value-key="value"
              multiple
              :search-input="{ placeholder: t('Search monitors') }"
              class="w-full"
            />
            <UButton
              type="button"
              color="neutral"
              variant="outline"
              class="shrink-0"
              :disabled="monitorOptions.length === 0"
              @click="toggleAllMonitors"
            >
              {{ allMonitorsSelected ? t('Deselect All') : t('Select All') }}
            </UButton>
          </div>
        </UFormField>

        <UFormField :label="t('affectedStatusPages')" :description="t('maintenanceStatusPageHint')">
          <USelectMenu
            v-model="form.statusPages"
            :items="statusPageOptions"
            value-key="value"
            multiple
            class="w-full"
          />
        </UFormField>
      </section>

      <!-- Schedule -->
      <section class="card card-body space-y-5">
        <UFormField :label="t('Strategy')">
          <USelect v-model="form.strategy" :items="strategyOptions" class="w-full sm:w-96" />
        </UFormField>

        <!-- Cron -->
        <div v-if="form.strategy === 'cron'" class="grid gap-4 sm:grid-cols-2">
          <UFormField :label="t('cronExpression')" :error="cronInvalid ? t('invalidCronExpression', [form.cron]) : undefined">
            <UInput v-model="form.cron" class="w-full font-mono" placeholder="30 3 * * *" />
            <template #help>
              <span v-if="cronDescription">{{ t('cronScheduleDescription', { description: cronDescription }) }}</span>
            </template>
          </UFormField>
          <UFormField :label="t('Duration (Minutes)')">
            <UInput v-model.number="form.durationMinutes" type="number" min="1" class="w-full" />
          </UFormField>
        </div>

        <!-- Interval -->
        <UFormField v-if="form.strategy === 'recurring-interval'" :label="t('recurringInterval')">
          <div class="flex items-center gap-3">
            <UInput v-model.number="form.intervalDay" type="number" min="1" max="3650" class="w-28" />
            <span class="text-sm text-muted">{{ t('recurringIntervalMessage', form.intervalDay, [form.intervalDay]) }}</span>
          </div>
        </UFormField>

        <!-- Weekdays -->
        <UFormField v-if="form.strategy === 'recurring-weekday'" :label="t('dayOfWeek')">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="day in weekdayOptions"
              :key="day.value"
              type="button"
              class="chip"
              :class="{ 'chip-on': form.weekdays.includes(day.value) }"
              :aria-pressed="form.weekdays.includes(day.value)"
              @click="toggle(form.weekdays, day.value)"
            >
              {{ day.label }}
            </button>
          </div>
        </UFormField>

        <!-- Days of month -->
        <UFormField v-if="form.strategy === 'recurring-day-of-month'" :label="t('dayOfMonth')">
          <div class="grid grid-cols-7 gap-1.5 sm:w-96">
            <button
              v-for="day in 31"
              :key="day"
              type="button"
              class="chip justify-center"
              :class="{ 'chip-on': form.daysOfMonth.includes(day) }"
              :aria-pressed="form.daysOfMonth.includes(day)"
              @click="toggle(form.daysOfMonth, day)"
            >
              {{ day }}
            </button>
          </div>
          <div class="mt-3 text-sm text-muted">{{ t('lastDay') }}</div>
          <button
            type="button"
            class="chip mt-1.5"
            :class="{ 'chip-on': form.daysOfMonth.includes('lastDay1') }"
            :aria-pressed="form.daysOfMonth.includes('lastDay1')"
            @click="toggle(form.daysOfMonth, 'lastDay1')"
          >
            {{ t('lastDay1') }}
          </button>
        </UFormField>

        <!-- Daily window -->
        <UFormField v-if="isRecurring" :label="t('Maintenance Time Window of a Day')">
          <div class="flex items-center gap-2">
            <UInput v-model="form.startTime" type="time" required class="w-32" />
            <span class="text-muted">→</span>
            <UInput v-model="form.endTime" type="time" required class="w-32" />
          </div>
        </UFormField>

        <!-- Timezone -->
        <UFormField v-if="usesTimezone" :label="t('Timezone')">
          <USelectMenu
            v-model="form.timezoneOption"
            :items="timezoneOptions"
            value-key="value"
            class="w-full sm:w-96"
          />
        </UFormField>

        <!-- Date range -->
        <UFormField
          v-if="usesDateRange"
          :label="form.strategy === 'single' ? t('Date and Time') : t('Effective Date Range')"
          :required="form.strategy === 'single'"
        >
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1">
              <span class="text-xs text-muted">{{ t('startDateTime') }}</span>
              <UInput v-model="form.startDateTime" type="datetime-local" class="w-full" :required="form.strategy === 'single'" />
            </label>
            <label class="space-y-1">
              <span class="text-xs text-muted">{{ t('endDateTime') }}</span>
              <UInput v-model="form.endDateTime" type="datetime-local" class="w-full" :required="form.strategy === 'single'" />
            </label>
          </div>
        </UFormField>
      </section>

      <UAlert v-if="fieldError" color="error" variant="subtle" :title="fieldError" icon="i-heroicons-exclamation-triangle" />

      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="ghost" @click="router.back()">{{ t('Cancel') }}</UButton>
        <UButton type="submit" :loading="saving" icon="i-heroicons-check">{{ t('Save') }}</UButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  min-width: 2.75rem;
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--uk-border-strong);
  border-radius: var(--uk-radius-sm);
  background-color: var(--uk-bg-surface);
  color: var(--uk-text-secondary);
  font-size: 0.875rem;
  transition: background-color var(--uk-duration-fast) ease, border-color var(--uk-duration-fast) ease;
}

.chip:hover {
  background-color: var(--uk-bg-hover);
}

.chip-on,
.chip-on:hover {
  background-color: var(--uk-primary);
  border-color: var(--uk-primary);
  color: var(--uk-text-on-primary);
  font-weight: 600;
}
</style>
