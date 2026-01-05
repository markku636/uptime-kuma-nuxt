<script setup lang="ts">
/**
 * OneChat Notification Provider
 */

interface Config {
  onechatAccessToken?: string
  onechatReceiverID?: string
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
        v-model="localConfig.onechatAccessToken"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Receiver ID" required>
      <UInput
        v-model="localConfig.onechatReceiverID"
        placeholder="Target user ID"
        required
      />
    </UFormField>
  </div>
</template>
