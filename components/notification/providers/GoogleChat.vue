<script setup lang="ts">
/**
 * Google Chat Notification Provider
 * 原版: src/components/notifications/GoogleChat.vue
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
    <!-- Webhook URL -->
    <UFormField label="Webhook URL" required>
      <UInput
        v-model="config.googleChatWebhookURL"
        type="url"
        placeholder="https://chat.googleapis.com/v1/spaces/..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          <a 
            href="https://developers.google.com/chat/how-tos/webhooks" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            如何建立 Google Chat Webhook
          </a>
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得 Google Chat Webhook URL"
    >
      <template #description>
        <ol class="text-sm list-decimal list-inside space-y-2 mt-2">
          <li>打開 Google Chat 空間</li>
          <li>點擊空間名稱旁的箭頭 → 管理 Webhooks</li>
          <li>點擊「新增 Webhook」</li>
          <li>設定名稱和頭像後，複製 Webhook URL</li>
        </ol>
      </template>
    </UAlert>
  </div>
</template>
