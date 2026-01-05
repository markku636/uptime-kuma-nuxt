<script setup lang="ts">
/**
 * Pushy Notification Provider
 */

interface Config {
  pushyAPIKey?: string
  pushyToken?: string
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
        v-model="localConfig.pushyAPIKey"
        type="password"
        placeholder="Your Pushy Secret API Key"
        required
      />
    </UFormField>

    <UFormField label="Device Token" required>
      <UInput
        v-model="localConfig.pushyToken"
        placeholder="Device token from Pushy"
        required
      />
    </UFormField>
  </div>
</template>
