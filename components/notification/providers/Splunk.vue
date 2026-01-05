<script setup lang="ts">
/**
 * Splunk Notification Provider
 */

interface Config {
  splunkURL?: string
  splunkToken?: string
  splunkChannel?: string
  splunkSeverity?: string
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
  { label: 'Info', value: 'info' },
  { label: 'Warning', value: 'warning' },
  { label: 'Critical', value: 'critical' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Splunk HEC URL" required>
      <UInput
        v-model="localConfig.splunkURL"
        placeholder="https://splunk.example.com:8088/services/collector/event"
        required
      />
    </UFormField>

    <UFormField label="HEC Token" required>
      <UInput
        v-model="localConfig.splunkToken"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Channel (optional)">
      <UInput
        v-model="localConfig.splunkChannel"
        placeholder="Channel GUID"
      />
    </UFormField>

    <UFormField label="Severity">
      <USelect
        v-model="localConfig.splunkSeverity"
        :items="severityOptions"
      />
    </UFormField>
  </div>
</template>
