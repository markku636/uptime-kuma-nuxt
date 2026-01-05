<script setup lang="ts">
/**
 * Pushover Notification Provider
 * 原版: src/components/notifications/Pushover.vue
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

const priorityOptions = [
  { label: '-2 (Lowest - No notification)', value: '-2' },
  { label: '-1 (Low - No sound/vibration)', value: '-1' },
  { label: '0 (Normal)', value: '0' },
  { label: '1 (High)', value: '1' },
  { label: '2 (Emergency - Requires confirmation)', value: '2' }
]

const soundOptions = [
  'pushover', 'bike', 'bugle', 'cashregister', 'classical',
  'cosmic', 'falling', 'gamelan', 'incoming', 'intermission',
  'magic', 'mechanical', 'pianobar', 'siren', 'spacealarm',
  'tugboat', 'alien', 'climb', 'persistent', 'echo',
  'updown', 'vibrate', 'none'
]

const soundItems = soundOptions.map(s => ({ label: s, value: s }))
</script>

<template>
  <div class="space-y-4">
    <!-- User Key -->
    <UFormField label="User Key" required>
      <UInput
        v-model="config.pushoveruserkey"
        type="password"
        placeholder="Your Pushover User Key"
        required
      />
    </UFormField>

    <!-- Application Token -->
    <UFormField label="Application Token" required>
      <UInput
        v-model="config.pushoverapptoken"
        type="password"
        placeholder="Your Application API Token"
        required
      />
    </UFormField>

    <!-- Device -->
    <UFormField label="Device">
      <UInput
        v-model="config.pushoverdevice"
        placeholder="Leave empty for all devices"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          指定接收通知的設備名稱，留空則發送到所有設備
        </p>
      </template>
    </UFormField>

    <!-- Message Title -->
    <UFormField label="Message Title">
      <UInput
        v-model="config.pushovertitle"
        placeholder="Uptime Kuma Alert"
      />
    </UFormField>

    <!-- Priority -->
    <UFormField label="Priority">
      <USelect
        v-model="config.pushoverpriority"
        :items="priorityOptions"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          優先級 2 (Emergency) 會持續通知直到用戶確認
        </p>
      </template>
    </UFormField>

    <!-- Sound - Down -->
    <UFormField label="Notification Sound - Down">
      <USelect
        v-model="config.pushoversounds"
        :items="soundItems"
      />
    </UFormField>

    <!-- Sound - Up -->
    <UFormField label="Notification Sound - Up">
      <USelect
        v-model="config.pushoversounds_up"
        :items="soundItems"
      />
    </UFormField>

    <!-- TTL -->
    <UFormField label="Message TTL (seconds)">
      <UInput
        v-model.number="config.pushoverttl"
        type="number"
        min="0"
        placeholder="3600"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          訊息的生存時間（秒）。留空或 0 表示永不過期
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得 Pushover 憑證"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>
            更多資訊請參考 
            <a 
              href="https://pushover.net/api" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              Pushover API 文檔
            </a>
          </p>
          <ol class="list-decimal list-inside space-y-1">
            <li>登入 <a href="https://pushover.net/" target="_blank" class="text-primary-500 hover:underline">Pushover.net</a></li>
            <li>在首頁找到你的 User Key</li>
            <li>建立一個 Application 取得 API Token</li>
          </ol>
          <p class="text-xs text-gray-400 mt-2">
            提示：Priority 2 (Emergency) 需要設定 Retry 和 Expire 參數
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
