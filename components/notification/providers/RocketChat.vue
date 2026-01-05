<script setup lang="ts">
/**
 * Rocket.Chat Notification Provider
 * 原版: src/components/notifications/RocketChat.vue
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
        v-model="config.rocketwebhookURL"
        type="url"
        placeholder="https://rocket.example.com/hooks/..."
        required
      />
    </UFormField>

    <!-- Username -->
    <UFormField label="Username">
      <UInput
        v-model="config.rocketusername"
        placeholder="Uptime Kuma"
      />
    </UFormField>

    <!-- Icon Emoji -->
    <UFormField label="Icon Emoji">
      <UInput
        v-model="config.rocketiconemo"
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
        v-model="config.rocketchannel"
        placeholder="#general"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          留空則使用 Webhook 預設的頻道。格式：#channel 或 @user
        </p>
      </template>
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何建立 Rocket.Chat Webhook"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>
            <a 
              href="https://docs.rocket.chat/guides/administration/administration/integrations" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              查看 Rocket.Chat Integration 文檔
            </a>
          </p>
        </div>
      </template>
    </UAlert>
  </div>
</template>
