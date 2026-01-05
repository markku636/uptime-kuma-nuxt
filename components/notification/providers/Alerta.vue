<script setup lang="ts">
/**
 * Alerta Notification Provider
 */

interface Config {
  alertaAPIEndpoint?: string
  alertaAPIKey?: string
  alertaEnvironment?: string
  alertaAlertState?: string
  alertaRecoverState?: string
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
    <UFormField label="Alerta API Endpoint" required>
      <UInput
        v-model="localConfig.alertaAPIEndpoint"
        placeholder="https://alerta.example.com/api"
        required
      />
    </UFormField>

    <UFormField label="API Key" required>
      <UInput
        v-model="localConfig.alertaAPIKey"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Environment">
      <UInput
        v-model="localConfig.alertaEnvironment"
        placeholder="Production"
      />
    </UFormField>

    <UFormField label="Alert State">
      <UInput
        v-model="localConfig.alertaAlertState"
        placeholder="open (default)"
      />
    </UFormField>

    <UFormField label="Recover State">
      <UInput
        v-model="localConfig.alertaRecoverState"
        placeholder="closed (default)"
      />
    </UFormField>
  </div>
</template>
