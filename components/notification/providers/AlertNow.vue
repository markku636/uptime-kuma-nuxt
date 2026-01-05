<script setup lang="ts">
/**
 * AlertNow Notification Provider
 */

interface Config {
  alertNowWebhookURL?: string
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
        v-model="localConfig.alertNowWebhookURL"
        placeholder="https://alertnow.io/..."
        required
      />
    </UFormField>
  </div>
</template>
