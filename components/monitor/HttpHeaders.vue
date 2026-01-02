<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="font-medium">HTTP Headers</h4>
      <UButton 
        icon="i-heroicons-plus" 
        size="sm"
        @click="addHeader"
      >
        Add Header
      </UButton>
    </div>

    <div v-if="headers.length === 0" class="text-center py-4 text-gray-500">
      No custom headers defined
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(header, index) in headers"
        :key="index"
        class="flex items-center gap-2"
      >
        <UInput 
          v-model="header.key"
          placeholder="Header-Name"
          class="flex-1"
          @blur="emitUpdate"
        />
        <span class="text-gray-400">:</span>
        <UInput 
          v-model="header.value"
          placeholder="Header value"
          class="flex-1"
          @blur="emitUpdate"
        />
        <UButton 
          icon="i-heroicons-trash" 
          variant="ghost" 
          color="red"
          size="sm"
          @click="removeHeader(index)"
        />
      </div>
    </div>

    <!-- Common Headers -->
    <div class="flex flex-wrap gap-2">
      <UButton 
        v-for="common in commonHeaders"
        :key="common.key"
        size="xs"
        variant="soft"
        @click="addCommonHeader(common)"
      >
        + {{ common.key }}
      </UButton>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Header {
  key: string
  value: string
}

const props = defineProps<{
  modelValue: Header[] | string
}>()

const emit = defineEmits<{
  'update:modelValue': [headers: Header[] | string]
}>()

const headers = ref<Header[]>([])

// Parse headers from modelValue
watch(() => props.modelValue, (newVal) => {
  if (typeof newVal === 'string') {
    try {
      const parsed = JSON.parse(newVal)
      if (Array.isArray(parsed)) {
        headers.value = parsed
      } else if (typeof parsed === 'object') {
        headers.value = Object.entries(parsed).map(([key, value]) => ({
          key,
          value: String(value)
        }))
      }
    } catch {
      headers.value = []
    }
  } else if (Array.isArray(newVal)) {
    headers.value = newVal
  }
}, { immediate: true })

const commonHeaders = [
  { key: 'Content-Type', value: 'application/json' },
  { key: 'Authorization', value: 'Bearer ' },
  { key: 'Accept', value: 'application/json' },
  { key: 'User-Agent', value: 'Uptime-Kuma' },
  { key: 'X-API-Key', value: '' }
]

function addHeader() {
  headers.value.push({ key: '', value: '' })
  emitUpdate()
}

function addCommonHeader(common: Header) {
  const exists = headers.value.some(h => h.key === common.key)
  if (!exists) {
    headers.value.push({ ...common })
    emitUpdate()
  }
}

function removeHeader(index: number) {
  headers.value.splice(index, 1)
  emitUpdate()
}

function emitUpdate() {
  // Emit as JSON string for storage
  const validHeaders = headers.value.filter(h => h.key.trim())
  emit('update:modelValue', JSON.stringify(validHeaders))
}
</script>
