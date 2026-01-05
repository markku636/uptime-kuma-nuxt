<script setup lang="ts">
/**
 * ClickSend SMS Notification Provider
 */

interface Config {
  clickSendSmsLogin?: string
  clickSendSmsKey?: string
  clickSendSmsToNumber?: string
  clickSendSmsSenderName?: string
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
    <UFormField label="Username" required>
      <UInput
        v-model="localConfig.clickSendSmsLogin"
        placeholder="Your ClickSend username"
        required
      />
    </UFormField>

    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.clickSendSmsKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="To Number" required>
      <UInput
        v-model="localConfig.clickSendSmsToNumber"
        placeholder="+1234567890"
        required
      />
    </UFormField>

    <UFormField label="Sender Name">
      <UInput
        v-model="localConfig.clickSendSmsSenderName"
        placeholder="Uptime Kuma"
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Your sender ID or phone number (subject to carrier limitations)
        </span>
      </template>
    </UFormField>
  </div>
</template>
