<script setup lang="ts">
/**
 * Feishu (飛書) Notification Provider
 * 原版: src/components/notifications/Feishu.vue
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
    <UFormField label="Feishu Webhook URL" required>
      <UInput
        v-model="config.feishuWebHookUrl"
        type="url"
        placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          查看
          <a 
            href="https://www.feishu.cn/hc/zh-CN/articles/360024984973" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            飛書官方文檔
          </a>
          了解如何建立自定義機器人
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何建立飛書機器人"
    >
      <template #description>
        <ol class="text-sm list-decimal list-inside space-y-2 mt-2">
          <li>打開飛書，進入目標群組</li>
          <li>點擊群組設置 → 群機器人</li>
          <li>選擇「添加機器人」→「自定義機器人」</li>
          <li>設定機器人名稱和描述</li>
          <li>複製 Webhook 地址</li>
        </ol>
      </template>
    </UAlert>
  </div>
</template>
