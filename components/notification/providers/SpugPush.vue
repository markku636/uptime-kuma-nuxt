<script setup lang="ts">
/**
 * SpugPush Notification Provider
 */

interface Config {
  spugpushTemplateKey?: string
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
    <UFormField label="Template Key" required>
      <UInput
        v-model="localConfig.spugpushTemplateKey"
        placeholder="Your SpugPush template key"
        required
      />
    </UFormField>
  </div>
</template>
