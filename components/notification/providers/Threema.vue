<script setup lang="ts">
/**
 * Threema Gateway Notification Provider
 */

interface Config {
  threemaGatewayID?: string
  threemaRecipient?: string
  threemaSecret?: string
  threemaRecipientType?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const recipientTypeOptions = [
  { label: 'Threema ID', value: 'id' },
  { label: 'Phone Number', value: 'phone' },
  { label: 'Email', value: 'email' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Gateway ID" required>
      <UInput
        v-model="localConfig.threemaGatewayID"
        placeholder="*XXXXXXX"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Your Threema Gateway ID (starts with *)
        </span>
      </template>
    </UFormField>

    <UFormField label="Gateway Secret" required>
      <UInput
        v-model="localConfig.threemaSecret"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Recipient Type" required>
      <USelect
        v-model="localConfig.threemaRecipientType"
        :items="recipientTypeOptions"
      />
    </UFormField>

    <UFormField label="Recipient" required>
      <UInput
        v-model="localConfig.threemaRecipient"
        placeholder="Enter based on recipient type"
        required
      />
    </UFormField>
  </div>
</template>
