<template>
  <div class="monitor-list-filter space-y-3">
    <!-- Search -->
    <UInput
      v-model="searchQuery"
      :placeholder="$t('Search monitors...')"
      icon="i-heroicons-magnifying-glass"
      @update:model-value="emitFilter"
    />

    <!-- Filter Row -->
    <div class="flex flex-wrap gap-2">
      <!-- Status Filter -->
      <USelect
        v-model="statusFilter"
        :items="statusOptions"
        value-key="value"
        label-key="label"
        :placeholder="$t('All Status')"
        class="w-32"
        @update:model-value="emitFilter"
      />

      <!-- Type Filter -->
      <USelect
        v-model="typeFilter"
        :items="typeOptions"
        value-key="value"
        label-key="label"
        :placeholder="$t('All Types')"
        class="w-32"
        @update:model-value="emitFilter"
      />

      <!-- Tag Filter -->
      <USelect
        v-model="tagFilter"
        :items="tagOptions"
        value-key="value"
        label-key="label"
        :placeholder="$t('All Tags')"
        class="w-32"
        @update:model-value="emitFilter"
      />

      <!-- Active Filter -->
      <USelect
        v-model="activeFilter"
        :items="activeOptions"
        value-key="value"
        label-key="label"
        :placeholder="$t('All Monitors')"
        class="w-32"
        @update:model-value="emitFilter"
      />

      <!-- Clear Filters -->
      <UButton
        v-if="hasActiveFilters"
        variant="ghost"
        size="sm"
        icon="i-heroicons-x-mark"
        @click="clearFilters"
      >
        {{ $t('Clear') }}
      </UButton>
    </div>

    <!-- Sort Options -->
    <div class="flex items-center gap-2 text-sm text-gray-500">
      <span>{{ $t('Sort by') }}:</span>
      <UButtonGroup>
        <UButton
          v-for="option in sortOptions"
          :key="option.value"
          :variant="sortBy === option.value ? 'solid' : 'outline'"
          size="xs"
          @click="toggleSort(option.value)"
        >
          {{ option.label }}
          <UIcon
            v-if="sortBy === option.value"
            :name="sortOrder === 'asc' ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'"
            class="ml-1"
          />
        </UButton>
      </UButtonGroup>
    </div>

    <!-- Results count -->
    <div v-if="totalCount !== undefined" class="text-sm text-gray-500">
      {{ $t('{count} monitors', { count: filteredCount ?? totalCount }) }}
      <span v-if="filteredCount !== undefined && filteredCount !== totalCount">
        ({{ $t('filtered from {total}', { total: totalCount }) }})
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tag {
  id: number
  name: string
}

interface FilterState {
  search: string
  status: string
  type: string
  tag: string | number
  active: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

const props = defineProps<{
  tags?: Tag[]
  monitorTypes?: string[]
  totalCount?: number
  filteredCount?: number
}>()

const emit = defineEmits<{
  (e: 'filter', filters: FilterState): void
}>()

const { t } = useI18n()

const searchQuery = ref('')
const statusFilter = ref('')
const typeFilter = ref('')
const tagFilter = ref<string | number>('')
const activeFilter = ref('')
const sortBy = ref('name')
const sortOrder = ref<'asc' | 'desc'>('asc')

const statusOptions = computed(() => [
  { value: '', label: t('All Status') },
  { value: 'up', label: t('Up') },
  { value: 'down', label: t('Down') },
  { value: 'pending', label: t('Pending') },
  { value: 'maintenance', label: t('Maintenance') },
])

const typeOptions = computed(() => {
  const defaultTypes = [
    { value: '', label: t('All Types') },
    { value: 'http', label: 'HTTP(s)' },
    { value: 'keyword', label: 'HTTP(s) Keyword' },
    { value: 'json-query', label: 'JSON Query' },
    { value: 'port', label: 'TCP Port' },
    { value: 'ping', label: 'Ping' },
    { value: 'dns', label: 'DNS' },
    { value: 'push', label: 'Push' },
    { value: 'docker', label: 'Docker' },
    { value: 'steam', label: 'Steam' },
    { value: 'gamedig', label: 'GameDig' },
    { value: 'mqtt', label: 'MQTT' },
    { value: 'kafka-producer', label: 'Kafka Producer' },
    { value: 'sqlserver', label: 'SQL Server' },
    { value: 'postgres', label: 'PostgreSQL' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'mongodb', label: 'MongoDB' },
    { value: 'redis', label: 'Redis' },
    { value: 'radius', label: 'RADIUS' },
    { value: 'group', label: 'Group' },
    { value: 'real-browser', label: 'Real Browser' },
    { value: 'tailscale-ping', label: 'Tailscale Ping' },
    { value: 'rabbit-mq', label: 'RabbitMQ' },
    { value: 'manual', label: 'Manual' },
  ]

  if (props.monitorTypes?.length) {
    return [
      { value: '', label: t('All Types') },
      ...props.monitorTypes.map(type => ({ value: type, label: type }))
    ]
  }

  return defaultTypes
})

const tagOptions = computed(() => {
  const options = [{ value: '', label: t('All Tags') }]
  
  if (props.tags?.length) {
    props.tags.forEach(tag => {
      options.push({ value: tag.id, label: tag.name })
    })
  }
  
  return options
})

const activeOptions = computed(() => [
  { value: '', label: t('All Monitors') },
  { value: 'active', label: t('Active') },
  { value: 'paused', label: t('Paused') },
])

const sortOptions = [
  { value: 'name', label: t('Name') },
  { value: 'status', label: t('Status') },
  { value: 'uptime', label: t('Uptime') },
  { value: 'ping', label: t('Response Time') },
  { value: 'created', label: t('Created') },
]

const hasActiveFilters = computed(() => {
  return !!(
    searchQuery.value ||
    statusFilter.value ||
    typeFilter.value ||
    tagFilter.value ||
    activeFilter.value
  )
})

function toggleSort(field: string) {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'asc'
  }
  emitFilter()
}

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = ''
  typeFilter.value = ''
  tagFilter.value = ''
  activeFilter.value = ''
  emitFilter()
}

function emitFilter() {
  emit('filter', {
    search: searchQuery.value,
    status: statusFilter.value,
    type: typeFilter.value,
    tag: tagFilter.value,
    active: activeFilter.value,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
  })
}

// Initial emit
onMounted(() => {
  emitFilter()
})
</script>
