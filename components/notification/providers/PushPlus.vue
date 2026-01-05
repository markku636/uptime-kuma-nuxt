<script setup lang="ts">
/**
 * PushPlus (推送加) Notification Provider
 */

interface Config {
  pushplusToken?: string
  pushplusTemplate?: string
  pushplusTopic?: string
  pushplusChannel?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const templateOptions = [
  { label: 'HTML', value: 'html' },
  { label: 'Text', value: 'txt' },
  { label: 'JSON', value: 'json' },
  { label: 'Markdown', value: 'markdown' }
]

const channelOptions = [
  { label: 'WeChat', value: 'wechat' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'CP', value: 'cp' },
  { label: 'Mail', value: 'mail' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Token" required>
      <UInput
        v-model="localConfig.pushplusToken"
        type="password"
        placeholder="Your PushPlus token"
        required
      />
    </UFormField>

    <UFormField label="Template">
      <USelect
        v-model="localConfig.pushplusTemplate"
        :items="templateOptions"
      />
    </UFormField>

    <UFormField label="Topic (群組編碼)">
      <UInput
        v-model="localConfig.pushplusTopic"
        placeholder="Optional: Group topic code"
      />
    </UFormField>

    <UFormField label="Channel">
      <USelect
        v-model="localConfig.pushplusChannel"
        :items="channelOptions"
      />
    </UFormField>
  </div>
</template>
