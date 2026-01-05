<script setup lang="ts">
/**
 * Notifery Notification Provider
 */

interface Config {
  notiferyApiKey?: string
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
    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.notiferyApiKey"
        type="password"
        placeholder="Your Notifery API key"
        required
      />
    </UFormField>
  </div>
</template>
