<script setup lang="ts">
/**
 * LINE Notify Notification Provider
 */

interface Config {
  lineNotifyAccessToken?: string
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
    <UFormField label="Access Token" required>
      <UInput
        v-model="localConfig.lineNotifyAccessToken"
        type="password"
        placeholder="Your LINE Notify access token"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get your access token from 
          <a href="https://notify-bot.line.me/my/" target="_blank" class="text-primary-500 hover:underline">
            LINE Notify
          </a>
        </span>
      </template>
    </UFormField>

    <UAlert
      icon="i-heroicons-information-circle"
      color="amber"
      variant="soft"
      title="LINE Notify Deprecation"
      description="LINE Notify will be discontinued. Consider using LINE Messaging API instead."
    />
  </div>
</template>
