<script setup lang="ts">
/**
 * Home Assistant Notification Provider
 */

interface Config {
  homeAssistantUrl?: string
  homeAssistantLongLivedAccessToken?: string
  homeAssistantNotifyTarget?: string
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
    <UFormField label="Home Assistant URL" required>
      <UInput
        v-model="localConfig.homeAssistantUrl"
        placeholder="http://homeassistant.local:8123"
        required
      />
    </UFormField>

    <UFormField label="Long-Lived Access Token" required>
      <UInput
        v-model="localConfig.homeAssistantLongLivedAccessToken"
        type="password"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Create at: Profile → Long-Lived Access Tokens
        </span>
      </template>
    </UFormField>

    <UFormField label="Notification Service">
      <UInput
        v-model="localConfig.homeAssistantNotifyTarget"
        placeholder="notify.mobile_app_phone"
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          The notify service name (e.g., notify.mobile_app_phone)
        </span>
      </template>
    </UFormField>
  </div>
</template>
