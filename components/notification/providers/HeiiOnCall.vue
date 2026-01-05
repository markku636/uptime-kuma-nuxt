<script setup lang="ts">
/**
 * Heii On-Call Notification Provider
 */

interface Config {
  heiiOnCallApiKey?: string
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
        v-model="localConfig.heiiOnCallApiKey"
        type="password"
        placeholder="Your Heii On-Call API key"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get your API key from Heii On-Call settings
        </span>
      </template>
    </UFormField>
  </div>
</template>
