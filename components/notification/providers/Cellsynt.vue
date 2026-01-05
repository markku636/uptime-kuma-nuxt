<script setup lang="ts">
/**
 * Cellsynt SMS Notification Provider
 */

interface Config {
  cellsyntUsername?: string
  cellsyntPassword?: string
  cellsyntDestination?: string
  cellsyntOrigintype?: string
  cellsyntOriginator?: string
}

const config = defineModel<Config>({ default: () => ({}) })

const emit = defineEmits<{
  (e: 'update:modelValue', value: Config): void
}>()

const localConfig = computed({
  get: () => config.value,
  set: (value: Config) => emit('update:modelValue', value)
})

const originTypeOptions = [
  { label: 'Numeric', value: 'numeric' },
  { label: 'Alphanumeric', value: 'alpha' },
  { label: 'Shortcode', value: 'shortcode' }
]
</script>

<template>
  <div class="space-y-4">
    <UFormField label="Username" required>
      <UInput
        v-model="localConfig.cellsyntUsername"
        required
      />
    </UFormField>

    <UFormField label="Password" required>
      <UInput
        v-model="localConfig.cellsyntPassword"
        type="password"
        required
      />
    </UFormField>

    <UFormField label="Destination Number" required>
      <UInput
        v-model="localConfig.cellsyntDestination"
        placeholder="+46700123456"
        required
      />
    </UFormField>

    <UFormField label="Originator Type">
      <USelect
        v-model="localConfig.cellsyntOrigintype"
        :items="originTypeOptions"
      />
    </UFormField>

    <UFormField label="Originator">
      <UInput
        v-model="localConfig.cellsyntOriginator"
        placeholder="Uptime Kuma"
      />
    </UFormField>
  </div>
</template>
