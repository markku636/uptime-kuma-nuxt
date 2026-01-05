<script setup lang="ts">
/**
 * Nostr Notification Provider
 */

interface Config {
  nostrPrivateKey?: string
  nostrRelays?: string
  nostrRecipients?: string
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
    <UFormField label="Private Key (nsec)" required>
      <UInput
        v-model="localConfig.nostrPrivateKey"
        type="password"
        placeholder="nsec1..."
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Your Nostr private key in nsec format
        </span>
      </template>
    </UFormField>

    <UFormField label="Relays" required>
      <UTextarea
        v-model="localConfig.nostrRelays"
        placeholder="wss://relay.damus.io&#10;wss://nos.lol"
        :rows="3"
        required
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          One relay URL per line
        </span>
      </template>
    </UFormField>

    <UFormField label="Recipients (npub)">
      <UTextarea
        v-model="localConfig.nostrRecipients"
        placeholder="npub1...&#10;npub1..."
        :rows="3"
      />
      <template #hint>
        <span class="text-xs text-gray-500">
          Optional: Recipients' public keys (one per line). Leave empty for public posts.
        </span>
      </template>
    </UFormField>
  </div>
</template>
