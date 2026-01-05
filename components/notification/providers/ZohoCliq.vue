<script setup lang="ts">
/**
 * Zoho Cliq Notification Provider
 */

interface Config {
  zohoCliqWebhookURL?: string
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
        v-model="localConfig.zohoCliqWebhookURL"
        placeholder="https://cliq.zoho.com/api/v2/channelsbyname/..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Create a webhook in Zoho Cliq → Settings → Webhooks
        </span>
      </template>
    </UFormField>
  </div>
</template>
