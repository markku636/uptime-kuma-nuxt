<script setup lang="ts">
/**
 * Gorush Notification Provider
 */

interface Config {
  gorushServerURL?: string
  gorushDeviceToken?: string
  gorushPlatform?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const platformOptions = [
  { label: 'iOS (APNs)', value: 'ios' },
  { label: 'Android (FCM)', value: 'android' },
  { label: 'Huawei', value: 'huawei' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Gorush Server URL" required>
      <UInput
        v-model="localConfig.gorushServerURL"
        placeholder="https://gorush.example.com"
        required
      />
    </UFormField>

    <UFormField label="Platform" required>
      <USelect
        v-model="localConfig.gorushPlatform"
        :items="platformOptions"
      />
    </UFormField>

    <UFormField label="Device Token" required>
      <UInput
        v-model="localConfig.gorushDeviceToken"
        placeholder="Your device token"
        required
      />
    </UFormField>
  </div>
</template>
