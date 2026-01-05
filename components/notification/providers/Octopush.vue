<script setup lang="ts">
/**
 * Octopush SMS Notification Provider
 */

interface Config {
  octopushLogin?: string
  octopushApiKey?: string
  octopushToNumber?: string
  octopushFromNumber?: string
  octopushSmsType?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const smsTypeOptions = [
  { label: 'Premium SMS', value: 'sms_premium' },
  { label: 'Low Cost SMS', value: 'sms_low_cost' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Login" required>
      <UInput
        v-model="localConfig.octopushLogin"
        required
      />
    </UFormField>

    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.octopushApiKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="SMS Type">
      <USelect
        v-model="localConfig.octopushSmsType"
        :items="smsTypeOptions"
      />
    </UFormField>

    <UFormField label="From Number">
      <UInput
        v-model="localConfig.octopushFromNumber"
        placeholder="Sender name or number"
      />
    </UFormField>

    <UFormField label="To Number" required>
      <UInput
        v-model="localConfig.octopushToNumber"
        placeholder="+33612345678"
        required
      />
    </UFormField>
  </div>
</template>
