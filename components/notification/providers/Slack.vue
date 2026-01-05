<script setup lang="ts">
/**
 * Slack Notification Provider
 * 原版: src/components/notifications/Slack.vue
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
    <!-- Webhook URL -->
    <UFormField label="Webhook URL" required>
      <UInput
        v-model="config.slackwebhookURL"
        type="url"
        placeholder="https://hooks.slack.com/services/..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          <a 
            href="https://api.slack.com/messaging/webhooks" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            如何建立 Slack Webhook
          </a>
        </p>
      </template>
    </UFormField>

    <!-- Username -->
    <UFormField label="Username">
      <UInput
        v-model="config.slackusername"
        placeholder="Uptime Kuma"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          留空則使用 Webhook 預設的顯示名稱
        </p>
      </template>
    </UFormField>

    <!-- Icon Emoji -->
    <UFormField label="Icon Emoji">
      <UInput
        v-model="config.slackiconemo"
        placeholder=":rocket:"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          使用 Slack Emoji 格式，例如 :white_check_mark: 或 :x:
          <a 
            href="https://www.webfx.com/tools/emoji-cheat-sheet/" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            Emoji 速查表
          </a>
        </p>
      </template>
    </UFormField>

    <!-- Channel Name -->
    <UFormField label="Channel Name">
      <UInput
        v-model="config.slackchannel"
        placeholder="#alerts"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          留空則使用 Webhook 預設的頻道。輸入 #channel 或 @user
        </p>
      </template>
    </UFormField>

    <!-- Rich Messages -->
    <UFormField label="Message format">
      <UCheckbox
        v-model="config.slackrichmessage"
        label="Send rich messages"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          開啟後將發送帶有附件格式的訊息，包含顏色指示和更多詳細資訊
        </p>
      </template>
    </UFormField>

    <!-- Notify Channel -->
    <UFormField>
      <UCheckbox
        v-model="config.slackchannelnotify"
        label="Notify Channel (@channel)"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          開啟後會使用 @channel 通知頻道中的所有人
        </p>
      </template>
    </UFormField>
  </div>
</template>
