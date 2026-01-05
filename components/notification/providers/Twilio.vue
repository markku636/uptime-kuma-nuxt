<script setup lang="ts">
/**
 * Twilio SMS Notification Provider
 */

interface Config {
  twilioAccountSID?: string
  twilioAuthToken?: string
  twilioToNumber?: string
  twilioFromNumber?: string
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
    <UFormField label="Account SID" required>
      <UInput
        v-model="localConfig.twilioAccountSID"
        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        required
      />
    </UFormField>

    <UFormField label="Auth Token" required>
      <UInput
        v-model="localConfig.twilioAuthToken"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="To Number" required>
      <UInput
        v-model="localConfig.twilioToNumber"
        placeholder="+1234567890"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Recipient phone number with country code
        </span>
      </template>
    </UFormField>

    <UFormField label="From Number" required>
      <UInput
        v-model="localConfig.twilioFromNumber"
        placeholder="+1234567890"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Your Twilio phone number
        </span>
      </template>
    </UFormField>
  </div>
</template>
