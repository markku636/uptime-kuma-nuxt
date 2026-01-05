<script setup lang="ts">
/**
 * SMS Manager Notification Provider
 */

interface Config {
  smsmanagerApiKey?: string
  smsmanagerPhoneNumber?: string
  smsmanagerSenderName?: string
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
        v-model="localConfig.smsmanagerApiKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Sender Name">
      <UInput
        v-model="localConfig.smsmanagerSenderName"
        placeholder="Your registered sender"
      />
    </UFormField>

    <UFormField label="Phone Number" required>
      <UInput
        v-model="localConfig.smsmanagerPhoneNumber"
        placeholder="+421123456789"
        required
      />
    </UFormField>
  </div>
</template>
