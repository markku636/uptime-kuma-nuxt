<script setup lang="ts">
/**
 * Pumble Notification Provider
 */

interface Config {
  pumbleWebhookURL?: string
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
        v-model="localConfig.pumbleWebhookURL"
        placeholder="https://api.pumble.com/workspaces/.../incoming-webhooks/..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Create a webhook in Pumble → Settings → Incoming Webhooks
        </span>
      </template>
    </UFormField>
  </div>
</template>
