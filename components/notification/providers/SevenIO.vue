<script setup lang="ts">
/**
 * Seven.io SMS Notification Provider
 */

interface Config {
  sevenioApiKey?: string
  sevenioFrom?: string
  sevenioTo?: string
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
        v-model="localConfig.sevenioApiKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="From">
      <UInput
        v-model="localConfig.sevenioFrom"
        placeholder="Sender name or number"
      />
    </UFormField>

    <UFormField label="To Number" required>
      <UInput
        v-model="localConfig.sevenioTo"
        placeholder="+49123456789"
        required
      />
    </UFormField>
  </div>
</template>
