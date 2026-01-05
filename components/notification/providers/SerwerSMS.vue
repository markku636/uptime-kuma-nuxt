<script setup lang="ts">
/**
 * SerwerSMS Notification Provider
 */

interface Config {
  serwersmsUsername?: string
  serwersmsPassword?: string
  serwersmsPhoneNumber?: string
  serwersmsSenderName?: string
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
    <UFormField label="Username" required>
      <UInput
        v-model="localConfig.serwersmsUsername"
        required
      />
    </UFormField>

    <UFormField label="Password" required>
      <UInput
        v-model="localConfig.serwersmsPassword"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Phone Number" required>
      <UInput
        v-model="localConfig.serwersmsPhoneNumber"
        placeholder="48123456789"
        required
      />
    </UFormField>

    <UFormField label="Sender Name">
      <UInput
        v-model="localConfig.serwersmsSenderName"
        placeholder="Your registered sender name"
      />
    </UFormField>
  </div>
</template>
