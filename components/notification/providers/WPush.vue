<script setup lang="ts">
/**
 * WPush Notification Provider
 */

interface Config {
  wpushAPIkey?: string
  wpushChannel?: string
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
        v-model="localConfig.wpushAPIkey"
        type="password"
        placeholder="Your WPush API key"
        required
      />
    </UFormField>

    <UFormField label="Channel">
      <UInput
        v-model="localConfig.wpushChannel"
        placeholder="Optional channel name"
      />
    </UFormField>
  </div>
</template>
