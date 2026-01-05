<script setup lang="ts">
/**
 * WAHA (WhatsApp HTTP API) Notification Provider
 */

interface Config {
  wahaApiUrl?: string
  wahaSession?: string
  wahaChatId?: string
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
    <UFormField label="WAHA API URL" required>
      <UInput
        v-model="localConfig.wahaApiUrl"
        placeholder="http://localhost:3000"
        required
      />
    </UFormField>

    <UFormField label="Session" required>
      <UInput
        v-model="localConfig.wahaSession"
        placeholder="default"
        required
      />
    </UFormField>

    <UFormField label="Chat ID" required>
      <UInput
        v-model="localConfig.wahaChatId"
        placeholder="1234567890@c.us"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Format: Phone@c.us for users or GroupID@g.us for groups
        </span>
      </template>
    </UFormField>
  </div>
</template>
