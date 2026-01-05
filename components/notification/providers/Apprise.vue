<script setup lang="ts">
/**
 * Apprise Notification Provider
 * A universal notification gateway
 */

interface Config {
  appriseURL?: string
  appriseURLs?: string
  appriseTitle?: string
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
    <UFormField label="Apprise Server URL" required>
      <UInput
        v-model="localConfig.appriseURL"
        placeholder="http://localhost:8000/notify"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Your Apprise API server endpoint
        </span>
      </template>
    </UFormField>

    <UFormField label="Apprise URLs" required>
      <UTextarea
        v-model="localConfig.appriseURLs"
        placeholder="discord://webhook_id/webhook_token&#10;slack://tokenA/tokenB/tokenC&#10;telegram://bot_token/chat_id"
        :rows="4"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          One Apprise URL per line. See 
          <a href="https://github.com/caronc/apprise/wiki" target="_blank" class="text-primary-500 hover:underline">
            Apprise Wiki
          </a> for supported services
        </span>
      </template>
    </UFormField>

    <UFormField label="Notification Title">
      <UInput
        v-model="localConfig.appriseTitle"
        placeholder="Uptime Kuma Alert"
      />
    </UFormField>
  </div>
</template>
