<script setup lang="ts">
/**
 * Keep Notification Provider
 */

interface Config {
  keepWebhookURL?: string
  keepWebhookAPIKey?: string
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
    <UFormField label="Keep Webhook URL" required>
      <UInput
        v-model="localConfig.keepWebhookURL"
        placeholder="https://api.keephq.dev"
        required
      />
    </UFormField>

    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.keepWebhookAPIKey"
        type="password"
        required
      />
    </UFormField>
  </div>
</template>
