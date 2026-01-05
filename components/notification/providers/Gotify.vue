<script setup lang="ts">
/**
 * Gotify Notification Provider
 * 原版: src/components/notifications/Gotify.vue
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
  if (config.value.gotifyPriority === undefined) {
    config.value.gotifyPriority = 8
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Server URL -->
    <UFormField label="Server URL" required>
      <UInput
        v-model="config.gotifyserverurl"
        type="url"
        placeholder="https://gotify.example.com"
        required
      />
    </UFormField>

    <!-- Application Token -->
    <UFormField label="Application Token" required>
      <UInput
        v-model="config.gotifyapplicationToken"
        type="password"
        placeholder="AxxxxxxxxxxxxxxxxxxxxxxxxL"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          在 Gotify Web UI 中建立 Application 取得 Token
        </p>
      </template>
    </UFormField>

    <!-- Priority -->
    <UFormField label="Priority">
      <UInput
        v-model.number="config.gotifyPriority"
        type="number"
        min="0"
        max="10"
        placeholder="8"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          0-10，數字越高優先級越高。預設為 8
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="關於 Gotify"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>Gotify 是一個自架的推送通知伺服器。</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>部署你的 Gotify 伺服器</li>
            <li>在 Web UI 中建立一個 Application</li>
            <li>複製 Application Token</li>
            <li>在 Android 裝置安裝 Gotify App 並連接伺服器</li>
          </ol>
          <p class="mt-2">
            <a 
              href="https://gotify.net/" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              Gotify 官網
            </a>
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
