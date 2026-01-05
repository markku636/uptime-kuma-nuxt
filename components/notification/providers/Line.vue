<script setup lang="ts">
/**
 * LINE Notification Provider
 * 原版: src/components/notifications/Line.vue
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
</script>

<template>
  <div class="space-y-4">
    <!-- Channel Access Token -->
    <UFormField label="Channel Access Token (Long-lived)" required>
      <UInput
        v-model="config.lineChannelAccessToken"
        type="password"
        placeholder="Your LINE Channel Access Token"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          前往 <b>Messaging API</b> 設定頁面取得
        </p>
      </template>
    </UFormField>

    <!-- User ID -->
    <UFormField label="Your User ID" required>
      <UInput
        v-model="config.lineUserID"
        placeholder="U1234567890abcdef..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          前往 <b>Basic Settings</b> 取得你的 User ID
        </p>
      </template>
    </UFormField>

    <!-- Help Section -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得 LINE Channel Token"
    >
      <template #description>
        <ol class="text-sm list-decimal list-inside space-y-2 mt-2">
          <li>
            前往 
            <a 
              href="https://developers.line.biz/console/" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              LINE Developers Console
            </a>
          </li>
          <li>建立或選擇一個 Provider</li>
          <li>建立一個 Messaging API Channel</li>
          <li>在 Messaging API 頁面底部找到 Channel Access Token 並點擊 Issue</li>
          <li>在 Basic Settings 頁面找到你的 User ID</li>
        </ol>
      </template>
    </UAlert>
  </div>
</template>
