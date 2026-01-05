<script setup lang="ts">
/**
 * GoAlert Notification Provider
 */

interface Config {
  goAlertBaseURL?: string
  goAlertToken?: string
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
    <UFormField label="GoAlert Base URL" required>
      <UInput
        v-model="localConfig.goAlertBaseURL"
        placeholder="https://goalert.example.com"
        required
      />
    </UFormField>

    <UFormField label="Integration Key" required>
      <UInput
        v-model="localConfig.goAlertToken"
        type="password"
        placeholder="Generic API integration key"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Create a Generic API integration key in GoAlert
        </span>
      </template>
    </UFormField>
  </div>
</template>
