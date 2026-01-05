<script setup lang="ts">
/**
 * OneBot Notification Provider (QQ)
 */

interface Config {
  onebotHttpAddr?: string
  onebotAccessToken?: string
  onebotMsgType?: string
  onebotReceiverId?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const msgTypeOptions = [
  { label: 'Private Message', value: 'private' },
  { label: 'Group Message', value: 'group' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="OneBot HTTP Address" required>
      <UInput
        v-model="localConfig.onebotHttpAddr"
        placeholder="http://127.0.0.1:5700"
        required
      />
    </UFormField>

    <UFormField label="Access Token">
      <UInput
        v-model="localConfig.onebotAccessToken"
        type="password"
        placeholder="Optional access token"
      />
    </UFormField>

    <UFormField label="Message Type" required>
      <USelect
        v-model="localConfig.onebotMsgType"
        :items="msgTypeOptions"
      />
    </UFormField>

    <UFormField :label="localConfig.onebotMsgType === 'group' ? 'Group ID' : 'QQ Number'" required>
      <UInput
        v-model="localConfig.onebotReceiverId"
        :placeholder="localConfig.onebotMsgType === 'group' ? 'Group ID' : 'QQ Number'"
        required
      />
    </UFormField>
  </div>
</template>
