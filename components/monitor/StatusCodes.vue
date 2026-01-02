<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h4 class="font-medium">Accepted Status Codes</h4>
      <UButton 
        icon="i-heroicons-plus" 
        size="sm"
        @click="addCode"
      >
        Add Code/Range
      </UButton>
    </div>

    <div class="flex flex-wrap gap-2">
      <div
        v-for="(code, index) in codes"
        :key="index"
        class="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg"
      >
        <UInput 
          v-model="codes[index]"
          placeholder="200 or 200-299"
          class="w-24 text-sm"
          @blur="emitUpdate"
        />
        <UButton 
          icon="i-heroicons-x-mark" 
          variant="ghost" 
          size="xs"
          @click="removeCode(index)"
        />
      </div>
    </div>

    <!-- Quick add buttons -->
    <div class="flex flex-wrap gap-2">
      <UButton 
        v-for="preset in presets"
        :key="preset.value"
        size="xs"
        variant="soft"
        @click="addPreset(preset.value)"
      >
        + {{ preset.label }}
      </UButton>
    </div>

    <p class="text-sm text-gray-500">
      Use single codes (200) or ranges (200-299). Status codes outside this list will mark the monitor as down.
    </p>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  modelValue: string[] | string
}>()

const emit = defineEmits<{
  'update:modelValue': [codes: string[]]
}>()

const codes = ref<string[]>([])

// Parse codes from modelValue
watch(() => props.modelValue, (newVal) => {
  if (typeof newVal === 'string') {
    try {
      codes.value = JSON.parse(newVal)
    } catch {
      codes.value = ['200-299']
    }
  } else if (Array.isArray(newVal)) {
    codes.value = [...newVal]
  } else {
    codes.value = ['200-299']
  }
}, { immediate: true })

const presets = [
  { value: '200-299', label: '2xx Success' },
  { value: '300-399', label: '3xx Redirect' },
  { value: '200', label: '200 OK' },
  { value: '201', label: '201 Created' },
  { value: '204', label: '204 No Content' },
  { value: '301', label: '301 Moved' },
  { value: '302', label: '302 Found' },
  { value: '401', label: '401 Unauthorized' },
  { value: '403', label: '403 Forbidden' },
  { value: '404', label: '404 Not Found' }
]

function addCode() {
  codes.value.push('')
  emitUpdate()
}

function addPreset(preset: string) {
  if (!codes.value.includes(preset)) {
    codes.value.push(preset)
    emitUpdate()
  }
}

function removeCode(index: number) {
  codes.value.splice(index, 1)
  emitUpdate()
}

function emitUpdate() {
  const validCodes = codes.value.filter(c => c.trim())
  emit('update:modelValue', validCodes)
}
</script>
