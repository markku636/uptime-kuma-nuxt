<script setup lang="ts">
/**
 * PushDeer Notification Provider
 */

interface Config {
  pushdeerKey?: string
  pushdeerServer?: string
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
    <UFormField label="PushDeer Key" required>
      <UInput
        v-model="localConfig.pushdeerKey"
        type="password"
        placeholder="Your PushDeer Key"
        required
      />
    </UFormField>

    <UFormField label="Server URL">
      <UInput
        v-model="localConfig.pushdeerServer"
        placeholder="https://api2.pushdeer.com (default)"
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Optional: Self-hosted PushDeer server URL
        </span>
      </template>
    </UFormField>
  </div>
</template>
