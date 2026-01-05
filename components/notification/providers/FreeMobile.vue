<script setup lang="ts">
/**
 * Free Mobile SMS Notification Provider
 */

interface Config {
  freemobileUser?: string
  freemobilePass?: string
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
    <UFormField label="User ID" required>
      <UInput
        v-model="localConfig.freemobileUser"
        placeholder="Your Free Mobile user ID"
        required
      />
    </UFormField>

    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.freemobilePass"
        type="password"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get your API key from Free Mobile account settings
        </span>
      </template>
    </UFormField>
  </div>
</template>
