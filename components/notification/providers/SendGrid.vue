<script setup lang="ts">
/**
 * SendGrid Email Notification Provider
 */

interface Config {
  sendgridApiKey?: string
  sendgridFromEmail?: string
  sendgridToEmail?: string
  sendgridFromName?: string
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
    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.sendgridApiKey"
        type="password"
        placeholder="SG.xxxxxx"
        required
      />
    </UFormField>

    <UFormField label="From Email" required>
      <UInput
        v-model="localConfig.sendgridFromEmail"
        type="email"
        placeholder="alerts@example.com"
        required
      />
    </UFormField>

    <UFormField label="From Name">
      <UInput
        v-model="localConfig.sendgridFromName"
        placeholder="Uptime Kuma"
      />
    </UFormField>

    <UFormField label="To Email" required>
      <UInput
        v-model="localConfig.sendgridToEmail"
        type="email"
        placeholder="admin@example.com"
        required
      />
    </UFormField>
  </div>
</template>
