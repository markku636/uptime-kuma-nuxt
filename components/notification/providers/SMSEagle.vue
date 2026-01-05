<script setup lang="ts">
/**
 * SMSEagle Notification Provider
 */

interface Config {
  smseagleUrl?: string
  smseagleToken?: string
  smseagleRecipient?: string
  smseagleRecipientType?: string
  smseaglePriority?: number
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const recipientTypeOptions = [
  { label: 'Phone Number', value: 'phone' },
  { label: 'Phonebook Group', value: 'group' }
]

const priorityOptions = [
  { label: 'Normal', value: 0 },
  { label: 'High', value: 1 }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="SMSEagle URL" required>
      <UInput
        v-model="localConfig.smseagleUrl"
        placeholder="https://smseagle.example.com"
        required
      />
    </UFormField>

    <UFormField label="Access Token" required>
      <UInput
        v-model="localConfig.smseagleToken"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Recipient Type">
      <USelect
        v-model="localConfig.smseagleRecipientType"
        :items="recipientTypeOptions"
      />
    </UFormField>

    <UFormField label="Recipient" required>
      <UInput
        v-model="localConfig.smseagleRecipient"
        placeholder="Phone number or group name"
        required
      />
    </UFormField>

    <UFormField label="Priority">
      <USelect
        v-model="localConfig.smseaglePriority"
        :items="priorityOptions"
      />
    </UFormField>
  </div>
</template>
