<script setup lang="ts">
/**
 * Grafana OnCall Notification Provider
 */

interface Config {
  grafanaOncallWebhookURL?: string
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
        v-model="localConfig.grafanaOncallWebhookURL"
        placeholder="https://oncall-prod-us-central-0.grafana.net/oncall/..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get the webhook URL from Grafana OnCall integration settings
        </span>
      </template>
    </UFormField>
  </div>
</template>
