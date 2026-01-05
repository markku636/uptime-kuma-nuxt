<script setup lang="ts">
/**
 * Kook (KOOK/開黑啦) Notification Provider
 */

interface Config {
  kookGuildID?: string
  kookBotToken?: string
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
    <UFormField label="Bot Token" required>
      <UInput
        v-model="localConfig.kookBotToken"
        type="password"
        placeholder="Your Kook bot token"
        required
      />
    </UFormField>

    <UFormField label="Guild/Channel ID" required>
      <UInput
        v-model="localConfig.kookGuildID"
        placeholder="Target channel ID"
        required
      />
    </UFormField>
  </div>
</template>
