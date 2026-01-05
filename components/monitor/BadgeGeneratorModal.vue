<template>
  <UModal v-model="isOpen" :ui="{ width: 'max-w-xl' }">
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-100">
          Badge Generator - {{ monitorName }}
        </h3>
        <button @click="isOpen = false" class="text-gray-400 hover:text-gray-200">
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <!-- Badge Type -->
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Badge Type</label>
          <select v-model="badge.type" class="input w-full">
            <option value="status">Status</option>
            <option value="uptime">Uptime</option>
            <option value="ping">Ping</option>
            <option value="avg-response">Average Response</option>
            <option value="cert-exp">Certificate Expiry</option>
            <option value="response">Response</option>
          </select>
        </div>

        <!-- Duration (for uptime, ping, avg-response) -->
        <div v-if="showDuration">
          <label class="block text-sm font-medium text-gray-300 mb-2">Duration (hours)</label>
          <input v-model.number="badge.duration" type="number" min="1" placeholder="24" class="input w-full" />
        </div>

        <!-- Label -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Custom Label</label>
          <input v-model="badge.label" type="text" placeholder="Monitor Name" class="input w-full" />
        </div>

        <!-- Style -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Style</label>
          <select v-model="badge.style" class="input w-full">
            <option value="flat">Flat</option>
            <option value="plastic">Plastic</option>
            <option value="flat-square">Flat Square</option>
            <option value="for-the-badge">For the Badge</option>
            <option value="social">Social</option>
          </select>
        </div>

        <!-- Colors (collapsible) -->
        <details class="group">
          <summary class="cursor-pointer text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
            <UIcon name="i-heroicons-chevron-right" class="w-4 h-4 transition-transform group-open:rotate-90" />
            Custom Colors
          </summary>
          <div class="grid grid-cols-2 gap-4 mt-4 pl-6">
            <div>
              <label class="block text-xs text-gray-400 mb-1">Up Color</label>
              <input v-model="badge.upColor" type="text" placeholder="#3BB143" class="input w-full text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Down Color</label>
              <input v-model="badge.downColor" type="text" placeholder="#DC3545" class="input w-full text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Pending Color</label>
              <input v-model="badge.pendingColor" type="text" placeholder="#F0AD4E" class="input w-full text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Maintenance Color</label>
              <input v-model="badge.maintenanceColor" type="text" placeholder="#5BC0DE" class="input w-full text-sm" />
            </div>
            <div>
              <label class="block text-xs text-gray-400 mb-1">Label Color</label>
              <input v-model="badge.labelColor" type="text" placeholder="#555" class="input w-full text-sm" />
            </div>
          </div>
        </details>

        <!-- Badge Preview -->
        <div class="mt-6 p-4 bg-gray-800 rounded-lg text-center">
          <p class="text-sm text-gray-400 mb-3">Preview</p>
          <img :src="badgeUrl" :alt="'Badge for ' + monitorName" class="inline-block" />
        </div>

        <!-- Badge URL -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Badge URL</label>
          <div class="flex gap-2">
            <input :value="badgeUrl" type="text" readonly class="input w-full text-xs" />
            <button @click="copyUrl" class="btn btn-secondary shrink-0">
              <UIcon :name="copied ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Markdown -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Markdown</label>
          <div class="flex gap-2">
            <input :value="markdownCode" type="text" readonly class="input w-full text-xs" />
            <button @click="copyMarkdown" class="btn btn-secondary shrink-0">
              <UIcon :name="copiedMarkdown ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- HTML -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">HTML</label>
          <div class="flex gap-2">
            <input :value="htmlCode" type="text" readonly class="input w-full text-xs" />
            <button @click="copyHtml" class="btn btn-secondary shrink-0">
              <UIcon :name="copiedHtml ? 'i-heroicons-check' : 'i-heroicons-clipboard'" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div class="flex justify-end mt-6">
        <button @click="isOpen = false" class="btn btn-secondary">Close</button>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
const props = defineProps<{
  monitorId: number
  monitorName: string
}>()

const isOpen = defineModel<boolean>({ default: false })
const config = useRuntimeConfig()

const badge = ref({
  type: 'status',
  duration: 24,
  label: '',
  style: 'flat',
  upColor: '',
  downColor: '',
  pendingColor: '',
  maintenanceColor: '',
  labelColor: '',
})

const copied = ref(false)
const copiedMarkdown = ref(false)
const copiedHtml = ref(false)

const showDuration = computed(() => {
  return ['uptime', 'ping', 'avg-response'].includes(badge.value.type)
})

const badgeUrl = computed(() => {
  const baseUrl = config.public.appUrl || window.location.origin
  let url = `${baseUrl}/api/badge/${props.monitorId}/${badge.value.type}`
  
  // Add duration for certain types
  if (showDuration.value && badge.value.duration) {
    url += `/${badge.value.duration}`
  }
  
  // Build query params
  const params = new URLSearchParams()
  if (badge.value.label) params.set('label', badge.value.label)
  if (badge.value.style !== 'flat') params.set('style', badge.value.style)
  if (badge.value.upColor) params.set('upColor', badge.value.upColor)
  if (badge.value.downColor) params.set('downColor', badge.value.downColor)
  if (badge.value.pendingColor) params.set('pendingColor', badge.value.pendingColor)
  if (badge.value.maintenanceColor) params.set('maintenanceColor', badge.value.maintenanceColor)
  if (badge.value.labelColor) params.set('labelColor', badge.value.labelColor)
  
  const queryString = params.toString()
  if (queryString) url += `?${queryString}`
  
  return url
})

const markdownCode = computed(() => {
  return `![${props.monitorName} Status](${badgeUrl.value})`
})

const htmlCode = computed(() => {
  return `<img src="${badgeUrl.value}" alt="${props.monitorName} Status" />`
})

const copyUrl = async () => {
  await navigator.clipboard.writeText(badgeUrl.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}

const copyMarkdown = async () => {
  await navigator.clipboard.writeText(markdownCode.value)
  copiedMarkdown.value = true
  setTimeout(() => copiedMarkdown.value = false, 2000)
}

const copyHtml = async () => {
  await navigator.clipboard.writeText(htmlCode.value)
  copiedHtml.value = true
  setTimeout(() => copiedHtml.value = false, 2000)
}
</script>
