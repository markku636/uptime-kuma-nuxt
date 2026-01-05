<script setup lang="ts">
/**
 * LunaSea Notification Provider
 */

interface Config {
  lunaseaTarget?: string
  lunaseaUserID?: string
  lunaseaDevice?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const targetOptions = [
  { label: 'User', value: 'user' },
  { label: 'Device', value: 'device' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Target Type" required>
      <USelect
        v-model="localConfig.lunaseaTarget"
        :items="targetOptions"
      />
    </UFormField>

    <UFormField v-if="localConfig.lunaseaTarget === 'user'" label="User ID" required>
      <UInput
        v-model="localConfig.lunaseaUserID"
        placeholder="Your LunaSea User ID"
        required
      />
    </UFormField>

    <UFormField v-if="localConfig.lunaseaTarget === 'device'" label="Device ID" required>
      <UInput
        v-model="localConfig.lunaseaDevice"
        placeholder="Your Device ID"
        required
      />
    </UFormField>
  </div>
</template>
