<script setup lang="ts">
/**
 * Mattermost Notification Provider
 * 原版: src/components/notifications/Mattermost.vue
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
        v-model="config.mattermostWebhookUrl"
        type="url"
        placeholder="https://mattermost.example.com/hooks/..."
        required
      />
    </UFormField>

    <!-- Username -->
    <UFormField label="Username">
      <UInput
        v-model="config.mattermostusername"
        placeholder="Uptime Kuma"
      />
    </UFormField>

    <!-- Icon URL -->
    <UFormField label="Icon URL">
      <UInput
        v-model="config.mattermosticonurl"
        type="url"
        placeholder="https://example.com/icon.png"
      />
    </UFormField>

    <!-- Icon Emoji -->
    <UFormField label="Icon Emoji">
      <UInput
        v-model="config.mattermosticonemo"
        placeholder=":robot:"
      />
      <template #help>
        <p class="text-sm text-gray-500">
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
        v-model="config.mattermostchannel"
        placeholder="town-square"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          留空則使用 Webhook 預設的頻道
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何建立 Mattermost Webhook"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>
            <a 
              href="https://developers.mattermost.com/integrate/webhooks/incoming/" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              查看 Mattermost Webhook 文檔
            </a>
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
