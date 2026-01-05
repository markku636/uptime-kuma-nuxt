<script setup lang="ts">
/**
 * Bark Notification Provider (iOS Push)
 * 原版: src/components/notifications/Bark.vue
 */

interface Props {
  modelValue: Record<string, any>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: Record<string, any>): void
}>()

const config = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
})

// 設定預設值
onMounted(() => {
  if (!config.value.apiVersion) {
    config.value.apiVersion = 'v2'
  }
})

const apiVersionOptions = [
  { label: 'v1 (Legacy)', value: 'v1' },
  { label: 'v2 (Recommended)', value: 'v2' }
]

const soundOptions = [
  'alarm', 'anticipate', 'bell', 'birdsong', 'bloom', 'calypso',
  'chime', 'choo', 'descent', 'electronic', 'fanfare', 'glass',
  'gotosleep', 'healthnotification', 'horn', 'ladder', 'mailsent',
  'minuet', 'multiwayinvitation', 'newmail', 'newsflash', 'noir',
  'paymentsuccess', 'shake', 'sherwoodforest', 'silence', 'spell',
  'suspense', 'telegraph', 'tiptoes', 'typewriters', 'update'
].map(s => ({ label: s, value: s }))
</script>

<template>
  <div class="space-y-4">
    <!-- API Version -->
    <UFormField label="Bark API Version">
      <USelect
        v-model="config.apiVersion"
        :items="apiVersionOptions"
      />
    </UFormField>

    <!-- Bark Endpoint -->
    <UFormField label="Bark Endpoint" required>
      <UInput
        v-model="config.barkEndpoint"
        placeholder="https://api.day.app/your-key"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          從 Bark App 取得你的推送地址。
          <a 
            href="https://github.com/Finb/Bark" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            了解更多
          </a>
        </p>
      </template>
    </UFormField>

    <!-- Bark Group -->
    <UFormField label="Bark Group">
      <UInput
        v-model="config.barkGroup"
        placeholder="uptime-kuma"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          通知分組名稱，相同群組的通知會歸類在一起
        </p>
      </template>
    </UFormField>

    <!-- Bark Sound -->
    <UFormField label="Bark Sound">
      <USelect
        v-model="config.barkSound"
        :items="soundOptions"
      />
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="關於 Bark"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>Bark 是一個 iOS 推送通知應用程式。</p>
          <ol class="list-decimal list-inside space-y-1">
            <li>從 App Store 下載 Bark App</li>
            <li>打開 App 後會顯示你的專屬推送地址</li>
            <li>複製推送地址填入上方「Bark Endpoint」欄位</li>
          </ol>
          <p class="mt-2 text-xs text-gray-400">
            你也可以自架 Bark Server 以獲得更好的隱私控制
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
