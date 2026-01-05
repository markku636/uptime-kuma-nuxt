<script setup lang="ts">
/**
 * Opsgenie Notification Provider
 * 原版: src/components/notifications/Opsgenie.vue
 */

interface Props {
  modelValue: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const config = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 設定預設值
onMounted(() => {
  if (!config.value.opsgenieRegion) {
    config.value.opsgenieRegion = 'us'
  }
})

const regionOptions = [
  { label: 'US (Default)', value: 'us' },
  { label: 'EU', value: 'eu' }
]
</script>

<template>
  <div class="space-y-4">
    <!-- Region -->
    <UFormField label="Region" required>
      <USelect
        v-model="config.opsgenieRegion"
        :items="regionOptions"
        required
      />
    </UFormField>

    <!-- API Key -->
    <UFormField label="API Key" required>
      <UInput
        v-model="config.opsgenieApiKey"
        type="password"
        placeholder="Your Opsgenie API Key"
        required
      />
    </UFormField>

    <!-- Priority -->
    <UFormField label="Priority">
      <UInput
        v-model.number="config.opsgeniePriority"
        type="number"
        min="1"
        max="5"
        placeholder="3"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          1-5，數字越高優先級越高
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得 Opsgenie API Key"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <ol class="list-decimal list-inside space-y-1">
            <li>登入 Opsgenie 控制台</li>
            <li>前往 Settings → Integration list</li>
            <li>選擇「API」integration</li>
            <li>複製 API Key</li>
          </ol>
          <p class="mt-2">
            <a 
              href="https://docs.opsgenie.com/docs/alert-api" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              查看 Opsgenie Alert API 文檔
            </a>
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
