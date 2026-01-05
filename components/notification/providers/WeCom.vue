<script setup lang="ts">
/**
 * WeCom (企業微信) Notification Provider
 * 原版: src/components/notifications/WeCom.vue
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
    <!-- Bot Key -->
    <UFormField label="WeCom Bot Key (機器人 Key)" required>
      <UInput
        v-model="config.weComBotKey"
        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          Webhook URL 中的 key 參數值
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得企業微信機器人 Key"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <ol class="list-decimal list-inside space-y-1">
            <li>在企業微信中進入群組聊天</li>
            <li>點擊右上角「...」→「群機器人」→「添加群機器人」</li>
            <li>建立機器人後，複製 Webhook URL</li>
            <li>URL 格式為：<code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=YOUR_KEY</code></li>
            <li>將 <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">YOUR_KEY</code> 部分填入上方欄位</li>
          </ol>
          <p class="mt-2">
            <a 
              href="https://work.weixin.qq.com/api/doc/90000/90136/91770" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              查看官方文檔
            </a>
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
