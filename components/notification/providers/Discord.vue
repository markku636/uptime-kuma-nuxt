<script setup lang="ts">
/**
 * Discord Notification Provider
 * 原版: src/components/notifications/Discord.vue
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
  if (!config.value.discordChannelType) {
    config.value.discordChannelType = 'channel'
  }
  if (config.value.disableUrl === undefined) {
    config.value.disableUrl = false
  }
})

const channelTypeOptions = [
  { label: 'Send to channel', value: 'channel' },
  { label: 'Create new forum post', value: 'createNewForumPost' },
  { label: 'Post to existing thread', value: 'postToThread' }
]
</script>

<template>
  <div class="space-y-4">
    <!-- Webhook URL -->
    <UFormField label="Discord Webhook URL" required>
      <UInput
        v-model="config.discordWebhookUrl"
        type="url"
        placeholder="https://discord.com/api/webhooks/..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          前往 Discord 伺服器設定 → 整合 → Webhooks → 新增 Webhook，複製 Webhook URL
          <a 
            href="https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks" 
            target="_blank" 
            class="text-primary-500 hover:underline"
          >
            了解更多
          </a>
        </p>
      </template>
    </UFormField>

    <!-- Bot Display Name -->
    <UFormField label="Bot Display Name">
      <UInput
        v-model="config.discordUsername"
        placeholder="Uptime Kuma"
      />
    </UFormField>

    <!-- Prefix Custom Message -->
    <UFormField label="Prefix Custom Message">
      <UInput
        v-model="config.discordPrefixMessage"
        placeholder="Hello @everyone is..."
      />
      <template #help>
        <p class="text-sm text-gray-500">
          可使用 @everyone, @here 或 &lt;@USER_ID&gt; 標記用戶
        </p>
      </template>
    </UFormField>

    <!-- Message Type -->
    <UFormField label="Select message type">
      <USelect
        v-model="config.discordChannelType"
        :items="channelTypeOptions"
      />
    </UFormField>

    <!-- Forum Post Name (when createNewForumPost) -->
    <UFormField 
      v-if="config.discordChannelType === 'createNewForumPost'"
      label="Forum Post Name"
    >
      <UInput
        v-model="config.postName"
        placeholder="Monitor Alert"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          如果論壇帖子已存在，新訊息將發送到該帖子
        </p>
      </template>
    </UFormField>

    <!-- Thread ID (when postToThread) -->
    <UFormField 
      v-if="config.discordChannelType === 'postToThread'"
      label="Thread/Forum Post ID"
    >
      <UInput
        v-model="config.threadId"
        placeholder="e.g. 1177566663751782411"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          在 Discord 中右鍵點擊訊息串/帖子，選擇「複製 ID」
          <a 
            href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID-" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            如何取得 ID
          </a>
        </p>
      </template>
    </UFormField>

    <!-- Disable URL -->
    <UFormField>
      <UCheckbox
        v-model="config.disableUrl"
        label="Disable URL in Notification"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          勾選後通知訊息將不包含監控的 URL
        </p>
      </template>
    </UFormField>
  </div>
</template>
