<script setup lang="ts">
/**
 * Microsoft Teams Notification Provider
 * 原版: src/components/notifications/Teams.vue
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
        v-model="config.webhookUrl"
        type="url"
        placeholder="https://outlook.office.com/webhook/..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          查看 
          <a 
            href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            Microsoft 官方文檔
          </a>
          了解如何建立 Incoming Webhook
        </p>
      </template>
    </UFormField>

    <!-- Help Section -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得 Teams Webhook URL"
    >
      <template #description>
        <div class="text-sm space-y-3 mt-2">
          <p class="font-medium">方法一：使用 Workflows (推薦)</p>
          <ol class="list-decimal list-inside space-y-1 pl-2">
            <li>在 Teams 頻道中，點擊「...」選單</li>
            <li>選擇「Workflows」</li>
            <li>搜尋「Post to a channel when a webhook request is received」</li>
            <li>設定 Workflow 並複製生成的 URL</li>
          </ol>

          <p class="font-medium mt-3">方法二：使用 Incoming Webhook (傳統)</p>
          <ol class="list-decimal list-inside space-y-1 pl-2">
            <li>在 Teams 頻道中，點擊「...」選單</li>
            <li>選擇「Connectors」</li>
            <li>搜尋並添加「Incoming Webhook」</li>
            <li>設定名稱後，複製 Webhook URL</li>
          </ol>

          <p class="text-xs text-gray-400 mt-2">
            注意：Microsoft 計劃於 2024 年底棄用 Office 365 Connectors，建議改用 Workflows
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
