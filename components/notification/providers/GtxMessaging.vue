<script setup lang="ts">
/**
 * GTX Messaging SMS Notification Provider
 */

interface Config {
  gtxApiKey?: string
  gtxFrom?: string
  gtxTo?: string
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
        v-model="localConfig.gtxApiKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="From (Sender)">
      <UInput
        v-model="localConfig.gtxFrom"
        placeholder="Sender name or number"
      />
    </UFormField>

    <UFormField label="To Number" required>
      <UInput
        v-model="localConfig.gtxTo"
        placeholder="+1234567890"
        required
      />
    </UFormField>
  </div>
</template>
