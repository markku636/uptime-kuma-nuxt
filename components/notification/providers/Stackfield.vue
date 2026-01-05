<script setup lang="ts">
/**
 * Stackfield Notification Provider
 */

interface Config {
  stackfieldWebhookURL?: string
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
        v-model="localConfig.stackfieldWebhookURL"
        placeholder="https://..."
        required
      />
    </UFormField>
  </div>
</template>
