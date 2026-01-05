<script setup lang="ts">
/**
 * Matrix Notification Provider
 * 原版: src/components/notifications/Matrix.vue
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
</script>

<template>
  <div class="space-y-4">
    <!-- Homeserver URL -->
    <UFormField label="Homeserver URL" required>
      <UInput
        v-model="config.homeserverUrl"
        type="url"
        placeholder="https://matrix.org"
        required
      />
    </UFormField>

    <!-- Internal Room ID -->
    <UFormField label="Internal Room ID" required>
      <UInput
        v-model="config.internalRoomId"
        placeholder="!roomid:matrix.org"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          以 ! 開頭的內部房間 ID，可在房間設定中找到
        </p>
      </template>
    </UFormField>

    <!-- Access Token -->
    <UFormField label="Access Token" required>
      <UInput
        v-model="config.accessToken"
        type="password"
        placeholder="syt_xxxxx"
        required
        maxlength="500"
      />
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得 Matrix 憑證"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>建議使用獨立的 Bot 帳號而非你的主帳號。</p>
          <p>取得 Access Token 的方法：</p>
          <div class="bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
            <code class="text-xs whitespace-pre-wrap">
curl -XPOST -d '{"type": "m.login.password", "identifier": {"user": "botusername", "type": "m.id.user"}, "password": "passwordforuser"}' "https://home.server/_matrix/client/v3/login"
            </code>
          </div>
          <p class="text-xs text-gray-400 mt-2">
            將 home.server 替換為你的 Homeserver 地址
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
