<script setup lang="ts">
/**
 * ServerChan (方糖) Notification Provider
 * 原版: src/components/notifications/ServerChan.vue
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
    <!-- SendKey -->
    <UFormField label="SendKey" required>
      <UInput
        v-model="config.serverChanSendKey"
        type="password"
        placeholder="SCT... 或 sctpXXXtXXX..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          從 Server 醬官網取得你的 SendKey
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="關於 Server 醬 (方糖)"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>Server 醬是一個免費的微信推送服務。</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>
              前往 
              <a 
                href="https://sct.ftqq.com/" 
                target="_blank"
                class="text-primary-500 hover:underline"
              >
                sct.ftqq.com
              </a>
              使用微信掃碼登入
            </li>
            <li>在「Key & API」頁面取得 SendKey</li>
            <li>SendKey 格式通常為 <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">SCT...</code> 或 <code class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">sctpXXXtXXX...</code></li>
          </ol>
        </div>
      </template>
    </UAlert>
  </div>
</template>
