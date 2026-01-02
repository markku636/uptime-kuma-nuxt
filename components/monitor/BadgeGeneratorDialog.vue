<template>
  <UModal v-model:open="isOpen" :title="$t('Status Badge')">
    <template #body>
      <div class="space-y-4">
        <!-- Monitor Selection -->
        <UFormField :label="$t('Monitor')">
          <USelect
            v-model="selectedMonitorId"
            :items="monitorOptions"
            value-key="value"
            label-key="label"
            :placeholder="$t('Select Monitor')"
          />
        </UFormField>

        <!-- Badge Type -->
        <UFormField :label="$t('Badge Type')">
          <USelect
            v-model="badgeType"
            :items="badgeTypes"
            value-key="value"
            label-key="label"
          />
        </UFormField>

        <!-- Style Options -->
        <UFormField :label="$t('Style')">
          <USelect
            v-model="badgeStyle"
            :items="badgeStyles"
            value-key="value"
            label-key="label"
          />
        </UFormField>

        <!-- Label Text -->
        <UFormField :label="$t('Label')">
          <UInput
            v-model="labelText"
            :placeholder="$t('Custom label text')"
          />
        </UFormField>

        <!-- Label Prefix -->
        <UFormField :label="$t('Label Prefix')">
          <UInput
            v-model="labelPrefix"
            :placeholder="$t('Optional prefix')"
          />
        </UFormField>

        <!-- Label Suffix -->
        <UFormField :label="$t('Label Suffix')">
          <UInput
            v-model="labelSuffix"
            :placeholder="$t('Optional suffix')"
          />
        </UFormField>

        <!-- Duration -->
        <UFormField v-if="badgeType !== 'status'" :label="$t('Duration (hours)')">
          <UInput
            v-model.number="duration"
            type="number"
            :min="1"
            :max="720"
          />
        </UFormField>

        <!-- Preview -->
        <UFormField :label="$t('Preview')">
          <div class="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <img :src="previewUrl" :alt="$t('Badge Preview')" class="h-8" />
          </div>
        </UFormField>

        <!-- Badge URLs -->
        <UFormField :label="$t('Badge URL')">
          <CopyableInput :value="badgeUrl" readonly />
        </UFormField>

        <UFormField :label="$t('HTML')">
          <CopyableInput :value="htmlCode" readonly />
        </UFormField>

        <UFormField :label="$t('Markdown')">
          <CopyableInput :value="markdownCode" readonly />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" @click="isOpen = false">
          {{ $t('Close') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
const isOpen = defineModel<boolean>('open', { default: false })

const props = defineProps<{
  monitors?: Array<{ id: number; name: string }>
}>()

const config = useRuntimeConfig()

const selectedMonitorId = ref<number | null>(null)
const badgeType = ref('status')
const badgeStyle = ref('flat')
const labelText = ref('')
const labelPrefix = ref('')
const labelSuffix = ref('')
const duration = ref(24)

const badgeTypes = [
  { value: 'status', label: 'Status' },
  { value: 'uptime', label: 'Uptime' },
  { value: 'ping', label: 'Response Time' },
  { value: 'avg-response', label: 'Average Response' },
  { value: 'cert-exp', label: 'Certificate Expiry' },
]

const badgeStyles = [
  { value: 'flat', label: 'Flat' },
  { value: 'flat-square', label: 'Flat Square' },
  { value: 'plastic', label: 'Plastic' },
  { value: 'for-the-badge', label: 'For the Badge' },
  { value: 'social', label: 'Social' },
]

const monitorOptions = computed(() => {
  return props.monitors?.map(m => ({
    value: m.id,
    label: m.name
  })) || []
})

const baseUrl = computed(() => {
  return config.public.apiBase || window.location.origin
})

const badgeUrl = computed(() => {
  if (!selectedMonitorId.value) return ''
  
  const params = new URLSearchParams()
  
  if (badgeStyle.value !== 'flat') {
    params.append('style', badgeStyle.value)
  }
  
  if (labelText.value) {
    params.append('label', labelText.value)
  }
  
  if (labelPrefix.value) {
    params.append('labelPrefix', labelPrefix.value)
  }
  
  if (labelSuffix.value) {
    params.append('labelSuffix', labelSuffix.value)
  }
  
  if (badgeType.value !== 'status' && duration.value !== 24) {
    params.append('duration', duration.value.toString())
  }
  
  const queryString = params.toString()
  const typeSegment = badgeType.value === 'status' ? '' : `/${badgeType.value}`
  
  return `${baseUrl.value}/api/badge/${selectedMonitorId.value}${typeSegment}${queryString ? '?' + queryString : ''}`
})

const previewUrl = computed(() => {
  return badgeUrl.value || `https://img.shields.io/badge/status-unknown-gray?style=${badgeStyle.value}`
})

const htmlCode = computed(() => {
  if (!badgeUrl.value) return ''
  return `<img src="${badgeUrl.value}" alt="Status Badge" />`
})

const markdownCode = computed(() => {
  if (!badgeUrl.value) return ''
  const monitorName = props.monitors?.find(m => m.id === selectedMonitorId.value)?.name || 'Status'
  return `![${monitorName}](${badgeUrl.value})`
})

// Auto-select first monitor if only one available
watch(() => props.monitors, (monitors) => {
  if (monitors?.length === 1) {
    selectedMonitorId.value = monitors[0].id
  }
}, { immediate: true })
</script>
