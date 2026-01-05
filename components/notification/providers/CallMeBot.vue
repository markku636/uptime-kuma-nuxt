<script setup lang="ts">
/**
 * CallMeBot Notification Provider
 */

interface Config {
  callmebotApiKey?: string
  callmebotPhone?: string
  callmebotService?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const serviceOptions = [
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'Telegram', value: 'telegram' },
  { label: 'Signal', value: 'signal' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Service" required>
      <USelect
        v-model="localConfig.callmebotService"
        :items="serviceOptions"
      />
    </UFormField>

    <UFormField label="Phone Number" required>
      <UInput
        v-model="localConfig.callmebotPhone"
        placeholder="+1234567890"
        required
      />
    </UFormField>

    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.callmebotApiKey"
        type="password"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get your API key from 
          <a href="https://www.callmebot.com/" target="_blank" class="text-primary-500 hover:underline">
            CallMeBot
          </a>
        </span>
      </template>
    </UFormField>
  </div>
</template>
