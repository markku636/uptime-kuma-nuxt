<script setup lang="ts">
/**
 * SIGNL4 Notification Provider
 */

interface Config {
  signl4TeamSecret?: string
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
    <UFormField label="Team Secret" required>
      <UInput
        v-model="localConfig.signl4TeamSecret"
        type="password"
        placeholder="Your SIGNL4 team secret"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Found in your SIGNL4 app → Team Settings
        </span>
      </template>
    </UFormField>
  </div>
</template>
