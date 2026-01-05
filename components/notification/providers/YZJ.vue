<script setup lang="ts">
/**
 * YZJ (云之家) Notification Provider
 */

interface Config {
  yzjWebhookUrl?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Webhook URL" required>
      <UInput
        v-model="localConfig.yzjWebhookUrl"
        placeholder="https://www.yunzhijia.com/gateway/robot/webhook/send?yzjtype=..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          機器人 Webhook 地址
        </span>
      </template>
    </UFormField>
  </div>
</template>
