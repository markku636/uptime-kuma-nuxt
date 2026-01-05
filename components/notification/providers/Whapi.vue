<script setup lang="ts">
/**
 * Whapi (WhatsApp API) Notification Provider
 */

interface Config {
  whapiApiUrl?: string
  whapiAuthToken?: string
  whapiTo?: string
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
    <UFormField label="Whapi API URL">
      <UInput
        v-model="localConfig.whapiApiUrl"
        placeholder="https://gate.whapi.cloud (default)"
      />
    </UFormField>

    <UFormField label="Auth Token" required>
      <UInput
        v-model="localConfig.whapiAuthToken"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="To (Chat ID)" required>
      <UInput
        v-model="localConfig.whapiTo"
        placeholder="1234567890@s.whatsapp.net"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Phone number in international format or group ID
        </span>
      </template>
    </UFormField>
  </div>
</template>
