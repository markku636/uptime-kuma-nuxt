<script setup lang="ts">
/**
 * Webhook Notification Provider
 * 原版: src/components/notifications/Webhook.vue
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
  if (!config.value.webhookContentType) {
    config.value.webhookContentType = 'json'
  }
})

const contentTypeOptions = [
  { label: 'application/json (Default)', value: 'json' },
  { label: 'multipart/form-data', value: 'form-data' },
  { label: 'Custom Body', value: 'custom' }
]

const showAdditionalHeaders = ref(!!config.value.webhookAdditionalHeaders)

const headersPlaceholder = `{
    "Authorization": "Bearer your-token",
    "X-Custom-Header": "value"
}`

const customBodyPlaceholder = `{
    "Title": "Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}",
    "Body": "{{ msg }}",
    "Status": "{{ heartbeatJSON['status'] }}"
}`
</script>

<template>
  <div class="space-y-4">
    <!-- Webhook URL -->
    <UFormField label="Post URL" required>
      <UInput
        v-model="config.webhookURL"
        type="url"
        placeholder="https://example.com/webhook"
        required
        pattern="https?://.+"
      />
    </UFormField>

    <!-- Request Body Type -->
    <UFormField label="Request Body" required>
      <USelect
        v-model="config.webhookContentType"
        :items="contentTypeOptions"
        required
      />
      <template #help>
        <div class="text-sm text-gray-500">
          <p v-if="config.webhookContentType === 'json'">
            以 <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">application/json</code> 格式發送 JSON 數據
          </p>
          <p v-else-if="config.webhookContentType === 'form-data'">
            以 <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">multipart/form-data</code> 格式發送，
            可在 PHP 中使用 <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">json_decode($_POST['data'])</code> 解析
          </p>
          <p v-else>
            自訂請求 Body 內容，支援 Jinja2 模板語法
          </p>
        </div>
      </template>
    </UFormField>

    <!-- Custom Body (when custom is selected) -->
    <UFormField 
      v-if="config.webhookContentType === 'custom'"
      label="Custom Body" 
      required
    >
      <UTextarea
        v-model="config.webhookCustomBody"
        :rows="8"
        :placeholder="customBodyPlaceholder"
        required
        class="font-mono text-sm"
      />
      <template #help>
        <div class="text-sm text-gray-500">
          <p class="mb-2">可用變數：</p>
          <ul class="list-disc list-inside space-y-1 text-xs">
            <li><code v-pre>{{ msg }}</code> - 通知訊息</li>
            <li><code v-pre>{{ monitorJSON }}</code> - 監控器資訊 (name, url, type...)</li>
            <li><code v-pre>{{ heartbeatJSON }}</code> - 心跳資訊 (status, ping, time...)</li>
          </ul>
        </div>
      </template>
    </UFormField>

    <!-- Additional Headers -->
    <UFormField>
      <UCheckbox
        v-model="showAdditionalHeaders"
        label="Add Additional Headers"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          添加自訂 HTTP Headers（例如 Authorization）
        </p>
      </template>
    </UFormField>

    <UFormField 
      v-if="showAdditionalHeaders"
      label="Additional Headers (JSON)"
      :required="showAdditionalHeaders"
    >
      <UTextarea
        v-model="config.webhookAdditionalHeaders"
        :rows="6"
        :placeholder="headersPlaceholder"
        :required="showAdditionalHeaders"
        class="font-mono text-sm"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          以 JSON 格式輸入 Headers
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="Webhook 資料格式"
    >
      <template #description>
        <div class="text-sm space-y-2">
          <p>Webhook 將發送以下 JSON 結構：</p>
          <pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs overflow-x-auto">{
  "heartbeat": { "status": 1, "time": "2024-01-01T00:00:00Z", "ping": 123 },
  "monitor": { "id": 1, "name": "My Monitor", "url": "https://..." },
  "msg": "Monitor is UP"
}</pre>
        </div>
      </template>
    </UAlert>
  </div>
</template>
