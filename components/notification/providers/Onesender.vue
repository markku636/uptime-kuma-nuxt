<script setup lang="ts">
/**
 * Onesender WhatsApp Notification Provider
 */

interface Config {
  onesenderURL?: string
  onesenderToken?: string
  onesenderRecipient?: string
  onesenderRecipientType?: string
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
  { label: 'Group ID', value: 'group' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Onesender API URL" required>
      <UInput
        v-model="localConfig.onesenderURL"
        placeholder="https://api.onesender.id"
        required
      />
    </UFormField>

    <UFormField label="Token" required>
      <UInput
        v-model="localConfig.onesenderToken"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Recipient Type">
      <USelect
        v-model="localConfig.onesenderRecipientType"
        :items="recipientTypeOptions"
      />
    </UFormField>

    <UFormField label="Recipient" required>
      <UInput
        v-model="localConfig.onesenderRecipient"
        placeholder="Phone number or group ID"
        required
      />
    </UFormField>
  </div>
</template>
