<script setup lang="ts">
/**
 * SMSC Notification Provider
 */

interface Config {
  smscLogin?: string
  smscPassword?: string
  smscPhones?: string
  smscSenderName?: string
  smscCharset?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const charsetOptions = [
  { label: 'UTF-8', value: 'utf-8' },
  { label: 'KOI8-R', value: 'koi8-r' },
  { label: 'Windows-1251', value: 'windows-1251' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Login" required>
      <UInput
        v-model="localConfig.smscLogin"
        required
      />
    </UFormField>

    <UFormField label="Password" required>
      <UInput
        v-model="localConfig.smscPassword"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Phone Numbers" required>
      <UInput
        v-model="localConfig.smscPhones"
        placeholder="Comma-separated phone numbers"
        required
      />
    </UFormField>

    <UFormField label="Sender Name">
      <UInput
        v-model="localConfig.smscSenderName"
        placeholder="Your sender name"
      />
    </UFormField>

    <UFormField label="Charset">
      <USelect
        v-model="localConfig.smscCharset"
        :items="charsetOptions"
      />
    </UFormField>
  </div>
</template>
