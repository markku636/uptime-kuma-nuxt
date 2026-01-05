<script setup lang="ts">
/**
 * PagerDuty Notification Provider
 * 原版: src/components/notifications/PagerDuty.vue
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
  if (!config.value.pagerdutyIntegrationUrl) {
    config.value.pagerdutyIntegrationUrl = 'https://events.pagerduty.com/v2/enqueue'
  }
  if (!config.value.pagerdutyPriority) {
    config.value.pagerdutyPriority = 'warning'
  }
  if (!config.value.pagerdutyAutoResolve) {
    config.value.pagerdutyAutoResolve = '0'
  }
})

const priorityOptions = [
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Error', value: 'error' },
  { label: 'Critical', value: 'critical' }
]

const autoResolveOptions = [
  { label: 'Do nothing', value: '0' },
  { label: 'Auto acknowledged', value: 'acknowledge' },
  { label: 'Auto resolve', value: 'resolve' }
]
</script>

<template>
  <div class="space-y-4">
    <!-- Integration Key -->
    <UFormField label="Integration Key (Routing Key)" required>
      <UInput
        v-model="config.pagerdutyIntegrationKey"
        type="password"
        placeholder="Your PagerDuty Integration Key"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          查看 
          <a 
            href="https://support.pagerduty.com/docs/services-and-integrations" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            PagerDuty 文檔
          </a>
          了解如何取得 Integration Key
        </p>
      </template>
    </UFormField>

    <!-- Integration URL -->
    <UFormField label="Integration URL">
      <UInput
        v-model="config.pagerdutyIntegrationUrl"
        type="url"
        placeholder="https://events.pagerduty.com/v2/enqueue"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          通常不需要修改，除非使用自訂的 PagerDuty 端點
        </p>
      </template>
    </UFormField>

    <!-- Priority -->
    <UFormField label="Priority">
      <USelect
        v-model="config.pagerdutyPriority"
        :items="priorityOptions"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          設定事件的嚴重性等級
        </p>
      </template>
    </UFormField>

    <!-- Auto Resolve -->
    <UFormField label="Auto resolve or acknowledged">
      <USelect
        v-model="config.pagerdutyAutoResolve"
        :items="autoResolveOptions"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          當監控恢復正常時，自動解除或確認事件
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得 PagerDuty Integration Key"
    >
      <template #description>
        <ol class="text-sm list-decimal list-inside space-y-2 mt-2">
          <li>登入 PagerDuty 控制台</li>
          <li>前往 Services → Service Directory</li>
          <li>選擇或建立一個 Service</li>
          <li>進入 Integrations 分頁</li>
          <li>點擊「Add an integration」</li>
          <li>選擇「Events API V2」</li>
          <li>複製 Integration Key</li>
        </ol>
      </template>
    </UAlert>
  </div>
</template>
