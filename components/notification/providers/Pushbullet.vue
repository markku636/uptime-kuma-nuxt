<script setup lang="ts">
/**
 * Pushbullet Notification Provider
 */

interface Config {
  pushbulletAccessToken?: string
  pushbulletDeviceIdentifier?: string
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
    <UFormField label="Access Token" required>
      <UInput
        v-model="localConfig.pushbulletAccessToken"
        type="password"
        placeholder="Your Pushbullet access token"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get your access token from 
          <a href="https://www.pushbullet.com/#settings/account" target="_blank" class="text-primary-500 hover:underline">
            Pushbullet Settings
          </a>
        </span>
      </template>
    </UFormField>

    <UFormField label="Device Identifier">
      <UInput
        v-model="localConfig.pushbulletDeviceIdentifier"
        placeholder="Leave empty to send to all devices"
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Optional: Specific device to send notifications to
        </span>
      </template>
    </UFormField>
  </div>
</template>
