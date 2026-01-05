<script setup lang="ts">
/**
 * ntfy Notification Provider
 * 原版: src/components/notifications/Ntfy.vue
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
  if (!config.value.ntfyserverurl) {
    config.value.ntfyserverurl = 'https://ntfy.sh'
  }
  if (!config.value.ntfyPriority) {
    config.value.ntfyPriority = 5
  }
  if (!config.value.ntfyPriorityDown) {
    config.value.ntfyPriorityDown = 5
  }
  if (!config.value.ntfyAuthenticationMethod) {
    config.value.ntfyAuthenticationMethod = 'none'
  }
})

const authMethodOptions = [
  { label: 'None', value: 'none' },
  { label: 'Username & Password', value: 'usernamePassword' },
  { label: 'Access Token', value: 'accessToken' }
]

// 說明文字
const priorityHelpText = computed(() => {
  const upPriority = config.value.ntfyPriority || 5
  const downPriority = config.value.ntfyPriorityDown || 5
  
  if (upPriority === downPriority && upPriority >= 5) {
    return '所有事件將使用最高優先級 (5)'
  } else if (upPriority > downPriority) {
    return `DOWN 事件使用優先級 ${downPriority}，其他事件使用優先級 ${upPriority}`
  } else {
    return `DOWN 事件使用優先級 ${downPriority}，其他事件使用較低優先級 ${upPriority}`
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Topic -->
    <UFormField label="Topic" required>
      <UInput
        v-model="config.ntfytopic"
        placeholder="uptime-kuma-alerts"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          ntfy 主題名稱，建議使用難以猜測的名稱以避免收到垃圾訊息
        </p>
      </template>
    </UFormField>

    <!-- Server URL -->
    <UFormField label="Server URL" required>
      <UInput
        v-model="config.ntfyserverurl"
        type="url"
        placeholder="https://ntfy.sh"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          ntfy 伺服器 URL（不要包含 topic）。預設為公開的 ntfy.sh
        </p>
      </template>
    </UFormField>

    <!-- Priority (Normal) -->
    <UFormField label="Priority (Normal events)">
      <UInput
        v-model.number="config.ntfyPriority"
        type="number"
        min="1"
        max="5"
        placeholder="5"
        required
      />
    </UFormField>

    <!-- Priority (Down) -->
    <UFormField label="Priority (Down events)">
      <UInput
        v-model.number="config.ntfyPriorityDown"
        type="number"
        min="1"
        max="5"
        placeholder="5"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          {{ priorityHelpText }}
        </p>
        <p class="text-xs text-gray-400 mt-1">
          1 = 最低, 5 = 最高/緊急
        </p>
      </template>
    </UFormField>

    <!-- Authentication Method -->
    <UFormField label="Authentication Method">
      <USelect
        v-model="config.ntfyAuthenticationMethod"
        :items="authMethodOptions"
      />
    </UFormField>

    <!-- Username & Password -->
    <template v-if="config.ntfyAuthenticationMethod === 'usernamePassword'">
      <UFormField label="Username">
        <UInput
          v-model="config.ntfyusername"
          placeholder="Your ntfy username"
        />
      </UFormField>

      <UFormField label="Password">
        <UInput
          v-model="config.ntfypassword"
          type="password"
          placeholder="Your ntfy password"
        />
      </UFormField>
    </template>

    <!-- Access Token -->
    <UFormField 
      v-if="config.ntfyAuthenticationMethod === 'accessToken'"
      label="Access Token"
    >
      <UInput
        v-model="config.ntfyaccesstoken"
        type="password"
        placeholder="tk_xxxxxxxxx"
      />
    </UFormField>

    <!-- Icon URL -->
    <UFormField label="Icon URL">
      <UInput
        v-model="config.ntfyIcon"
        type="url"
        placeholder="https://example.com/icon.png"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          自訂通知圖示 URL（可選）
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="關於 ntfy"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>
            ntfy 是一個簡單的 HTTP 推送通知服務。
            <a 
              href="https://ntfy.sh" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              了解更多
            </a>
          </p>
          <p>你可以：</p>
          <ul class="list-disc list-inside space-y-1">
            <li>使用免費的 ntfy.sh 公開伺服器</li>
            <li>自架 ntfy 伺服器獲得更多控制權</li>
            <li>透過 ntfy App (iOS/Android) 接收推送通知</li>
          </ul>
        </div>
      </template>
    </UAlert>
  </div>
</template>
