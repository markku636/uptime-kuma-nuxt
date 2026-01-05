<script setup lang="ts">
/**
 * Bitrix24 Notification Provider
 */

interface Config {
  bitrix24WebhookURL?: string
  bitrix24UserID?: string
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
        v-model="localConfig.bitrix24WebhookURL"
        placeholder="https://your-company.bitrix24.com/rest/..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Create a webhook in Bitrix24 → Applications → Webhooks
        </span>
      </template>
    </UFormField>

    <UFormField label="User ID">
      <UInput
        v-model="localConfig.bitrix24UserID"
        placeholder="Target user ID"
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Leave empty to send to all users with access
        </span>
      </template>
    </UFormField>
  </div>
</template>
