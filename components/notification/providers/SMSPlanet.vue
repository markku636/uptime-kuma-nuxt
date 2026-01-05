<script setup lang="ts">
/**
 * SMS Planet Notification Provider
 */

interface Config {
  smsplanetApiKey?: string
  smsplanetSenderName?: string
  smsplanetPhoneNumber?: string
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
        v-model="localConfig.smsplanetApiKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Sender Name">
      <UInput
        v-model="localConfig.smsplanetSenderName"
        placeholder="Your sender name"
      />
    </UFormField>

    <UFormField label="Phone Number" required>
      <UInput
        v-model="localConfig.smsplanetPhoneNumber"
        placeholder="+48123456789"
        required
      />
    </UFormField>
  </div>
</template>
