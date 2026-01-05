<script setup lang="ts">
/**
 * DingTalk (釘釘) Notification Provider
 * 原版: src/components/notifications/DingDing.vue
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
  if (!config.value.mentioning) {
    config.value.mentioning = 'nobody'
  }
})

const mentioningOptions = [
  { label: "Don't mention people", value: 'nobody' },
  { label: 'Mention @everyone', value: 'everyone' }
]
</script>

<template>
  <div class="space-y-4">
    <!-- Webhook URL -->
    <UFormField label="Webhook URL" required>
      <UInput
        v-model="config.webHookUrl"
        type="url"
        placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
        required
      />
    </UFormField>

    <!-- Secret Key -->
    <UFormField label="Secret Key (簽名密鑰)" required>
      <UInput
        v-model="config.secretKey"
        type="password"
        placeholder="SEC..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          為安全起見，必須使用加簽方式驗證
        </p>
      </template>
    </UFormField>

    <!-- Mentioning -->
    <UFormField label="Mentioning (提及)" required>
      <USelect
        v-model="config.mentioning"
        :items="mentioningOptions"
        required
      />
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何建立釘釘機器人"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>請參考官方文檔：</p>
          <ul class="list-disc list-inside space-y-1">
            <li>
              <a 
                href="https://developers.dingtalk.com/document/robots/custom-robot-access" 
                target="_blank"
                class="text-primary-500 hover:underline"
              >
                自定義機器人接入文檔
              </a>
            </li>
            <li>
              <a 
                href="https://open.dingtalk.com/document/robots/customize-robot-security-settings" 
                target="_blank"
                class="text-primary-500 hover:underline"
              >
                機器人安全設置
              </a>
            </li>
          </ul>
        </div>
      </template>
    </UAlert>
  </div>
</template>
