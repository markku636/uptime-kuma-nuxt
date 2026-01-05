<script setup lang="ts">
/**
 * Signal Notification Provider
 * Uses Signal CLI REST API to send notifications
 */

interface Config {
  signalURL?: string
  signalNumber?: string
  signalRecipients?: string
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
    <UFormField label="Signal CLI REST API URL" required>
      <UInput
        v-model="localConfig.signalURL"
        placeholder="http://127.0.0.1:8080"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          URL of your Signal CLI REST API server
        </span>
      </template>
    </UFormField>

    <UFormField label="Sender Number" required>
      <UInput
        v-model="localConfig.signalNumber"
        placeholder="+1234567890"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Your registered Signal phone number (with country code)
        </span>
      </template>
    </UFormField>

    <UFormField label="Recipient Numbers" required>
      <UTextarea
        v-model="localConfig.signalRecipients"
        placeholder="+1234567890,+0987654321"
        :rows="2"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Comma-separated list of recipient phone numbers
        </span>
      </template>
    </UFormField>
  </div>
</template>
