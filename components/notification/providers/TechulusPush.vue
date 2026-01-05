<script setup lang="ts">
/**
 * Push by Techulus Notification Provider
 */

interface Config {
  techulusPushAPIKey?: string
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
        v-model="localConfig.techulusPushAPIKey"
        type="password"
        placeholder="Your Push by Techulus API key"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get your API key from the Push by Techulus app
        </span>
      </template>
    </UFormField>
  </div>
</template>
