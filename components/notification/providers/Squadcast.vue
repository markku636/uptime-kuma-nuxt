<script setup lang="ts">
/**
 * Squadcast Notification Provider
 */

interface Config {
  squadcastWebhookURL?: string
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
    <UFormField label="Squadcast Webhook URL" required>
      <UInput
        v-model="localConfig.squadcastWebhookURL"
        placeholder="https://api.squadcast.com/v2/incidents/api/..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get the webhook URL from Squadcast service → Integrations → Uptime Kuma
        </span>
      </template>
    </UFormField>
  </div>
</template>
