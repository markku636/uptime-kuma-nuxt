<script setup lang="ts">
/**
 * PagerTree Notification Provider
 */

interface Config {
  pagerTreeIntegrationURL?: string
  pagerTreeAutoResolve?: boolean
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
    <UFormField label="Integration URL" required>
      <UInput
        v-model="localConfig.pagerTreeIntegrationURL"
        placeholder="https://api.pagertree.com/integration/..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Get this from PagerTree → Integrations → Add Integration → Uptime Kuma
        </span>
      </template>
    </UFormField>

    <UCheckbox
      v-model="localConfig.pagerTreeAutoResolve"
      label="Auto resolve on recovery"
    />
  </div>
</template>
