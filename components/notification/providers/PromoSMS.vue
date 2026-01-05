<script setup lang="ts">
/**
 * PromoSMS Notification Provider
 */

interface Config {
  promosmsLogin?: string
  promosmsPassword?: string
  promosmsSender?: string
  promosmsPhoneNumber?: string
  promosmsSmsType?: string
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
  { label: 'SMS ECO', value: 'sms_eco' },
  { label: 'SMS PRO', value: 'sms_pro' },
  { label: 'Flash SMS', value: 'flash' },
  { label: 'Full SMS', value: 'sms_full' },
  { label: 'Speed SMS', value: 'sms_speed' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Login" required>
      <UInput
        v-model="localConfig.promosmsLogin"
        required
      />
    </UFormField>

    <UFormField label="Password" required>
      <UInput
        v-model="localConfig.promosmsPassword"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="SMS Type">
      <USelect
        v-model="localConfig.promosmsSmsType"
        :items="smsTypeOptions"
      />
    </UFormField>

    <UFormField label="Sender Name">
      <UInput
        v-model="localConfig.promosmsSender"
        placeholder="Your approved sender name"
      />
    </UFormField>

    <UFormField label="Phone Number" required>
      <UInput
        v-model="localConfig.promosmsPhoneNumber"
        placeholder="48123456789"
        required
      />
    </UFormField>
  </div>
</template>
