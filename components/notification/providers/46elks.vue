<script setup lang="ts">
/**
 * 46elks SMS Notification Provider
 */

interface Config {
  elksUsername?: string
  elksAuthToken?: string
  elksToNumber?: string
  elksFromNumber?: string
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
    <UFormField label="API Username" required>
      <UInput
        v-model="localConfig.elksUsername"
        placeholder="Your 46elks API username"
        required
      />
    </UFormField>

    <UFormField label="API Password" required>
      <UInput
        v-model="localConfig.elksAuthToken"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="From Number" required>
      <UInput
        v-model="localConfig.elksFromNumber"
        placeholder="+46766861001"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Your 46elks number or a custom alphanumeric sender ID
        </span>
      </template>
    </UFormField>

    <UFormField label="To Number" required>
      <UInput
        v-model="localConfig.elksToNumber"
        placeholder="+46701234567"
        required
      />
    </UFormField>
  </div>
</template>
