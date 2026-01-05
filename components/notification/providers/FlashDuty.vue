<script setup lang="ts">
/**
 * FlashDuty (閃值) Notification Provider
 */

interface Config {
  flashdutyIntegrationKey?: string
  flashdutySeverity?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const severityOptions = [
  { label: 'Warning', value: 'Warning' },
  { label: 'Critical', value: 'Critical' },
  { label: 'Info', value: 'Info' },
  { label: 'OK', value: 'OK' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Integration Key" required>
      <UInput
        v-model="localConfig.flashdutyIntegrationKey"
        type="password"
        placeholder="Your FlashDuty integration key"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get the integration key from FlashDuty service settings
        </span>
      </template>
    </UFormField>

    <UFormField label="Severity">
      <USelect
        v-model="localConfig.flashdutySeverity"
        :items="severityOptions"
      />
    </UFormField>
  </div>
</template>
