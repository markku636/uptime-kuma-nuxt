<script setup lang="ts">
/**
 * SMS Partner Notification Provider
 */

interface Config {
  smspartnerApiKey?: string
  smspartnerPhoneNumber?: string
  smspartnerSenderName?: string
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
        v-model="localConfig.smspartnerApiKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Sender Name">
      <UInput
        v-model="localConfig.smspartnerSenderName"
        placeholder="Your approved sender name"
      />
    </UFormField>

    <UFormField label="Phone Number" required>
      <UInput
        v-model="localConfig.smspartnerPhoneNumber"
        placeholder="+33612345678"
        required
      />
    </UFormField>
  </div>
</template>
