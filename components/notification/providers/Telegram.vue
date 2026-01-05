<script setup lang="ts">
/**
 * Telegram Notification Provider
 * 原版: src/components/notifications/Telegram.vue
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
  if (!config.value.telegramServerUrl) {
    config.value.telegramServerUrl = 'https://api.telegram.org'
  }
})

const parseModesOptions = [
  { label: 'Plain Text', value: 'plain' },
  { label: 'HTML', value: 'HTML' },
  { label: 'MarkdownV2', value: 'MarkdownV2' }
]

// 自動取得 Chat ID
const isAutoGetting = ref(false)
const autoGetError = ref('')

async function autoGetTelegramChatID() {
  if (!config.value.telegramBotToken) return
  
  isAutoGetting.value = true
  autoGetError.value = ''
  
  try {
    const url = `${config.value.telegramServerUrl}/bot${config.value.telegramBotToken}/getUpdates`
    const response = await fetch(url)
    const data = await response.json()
    
    if (data.ok && data.result && data.result.length > 0) {
      const chatId = data.result[0].message?.chat?.id
      if (chatId) {
        config.value.telegramChatID = String(chatId)
      } else {
        autoGetError.value = '無法從回應中取得 Chat ID，請先發送訊息給 Bot'
      }
    } else {
      autoGetError.value = '沒有找到訊息記錄，請先發送訊息給 Bot'
    }
  } catch (error) {
    autoGetError.value = '取得失敗，請檢查 Bot Token 是否正確'
  } finally {
    isAutoGetting.value = false
  }
}

// 產生 getUpdates URL (隱藏 token)
const getUpdatesUrl = computed(() => {
  const token = config.value.telegramBotToken 
    ? '*'.repeat(Math.min(config.value.telegramBotToken.length, 20)) + '...'
    : '<YOUR_BOT_TOKEN>'
  return `${config.value.telegramServerUrl || 'https://api.telegram.org'}/bot${token}/getUpdates`
})

const templatePlaceholder = `Example:
Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}

{{ msg }}`
</script>

<template>
  <div class="space-y-4">
    <!-- Bot Token -->
    <UFormField label="Bot Token" required>
      <UInput
        v-model="config.telegramBotToken"
        type="password"
        placeholder="123456789:ABC..."
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          從 
          <a 
            href="https://t.me/BotFather" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            @BotFather
          </a>
          取得你的 Bot Token
        </p>
      </template>
    </UFormField>

    <!-- Chat ID -->
    <UFormField label="Chat ID" required>
      <div class="flex gap-2">
        <UInput
          v-model="config.telegramChatID"
          placeholder="-1001234567890"
          required
          class="flex-1"
        />
        <UButton
          v-if="config.telegramBotToken"
          :loading="isAutoGetting"
          variant="outline"
          @click="autoGetTelegramChatID"
        >
          Auto Get
        </UButton>
      </div>
      <template #help>
        <div class="text-sm text-gray-500 space-y-2">
          <p>支援個人、群組或頻道 Chat ID</p>
          <p>
            如何取得 Chat ID：先發送任意訊息給 Bot，然後訪問:
          </p>
          <p class="break-all text-xs font-mono bg-gray-100 dark:bg-gray-800 p-2 rounded">
            {{ getUpdatesUrl }}
          </p>
          <p v-if="autoGetError" class="text-red-500">{{ autoGetError }}</p>
        </div>
      </template>
    </UFormField>

    <!-- Message Thread ID (Supergroup topics) -->
    <UFormField label="Message Thread ID (Optional)">
      <UInput
        v-model="config.telegramMessageThreadID"
        placeholder="12345"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          用於超級群組的主題功能，留空則發送到一般聊天
        </p>
      </template>
    </UFormField>

    <!-- Custom Server URL -->
    <UFormField label="Server URL (Optional)">
      <UInput
        v-model="config.telegramServerUrl"
        placeholder="https://api.telegram.org"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          如果使用自架 Telegram Bot API Server，請填入。
          <a 
            href="https://core.telegram.org/bots/api#using-a-local-bot-api-server" 
            target="_blank"
            class="text-primary-500 hover:underline"
          >
            了解更多
          </a>
        </p>
      </template>
    </UFormField>

    <!-- Use Template -->
    <UFormField>
      <UCheckbox
        v-model="config.telegramUseTemplate"
        label="Use custom message template"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          使用 Jinja2 模板語法自訂通知訊息
        </p>
      </template>
    </UFormField>

    <!-- Template Settings -->
    <template v-if="config.telegramUseTemplate">
      <UFormField label="Message Format" required>
        <USelect
          v-model="config.telegramTemplateParseMode"
          :items="parseModesOptions"
        />
        <template #help>
          <p class="text-sm text-gray-500">
            <a 
              href="https://core.telegram.org/bots/api#formatting-options" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              查看格式文檔
            </a>
          </p>
        </template>
      </UFormField>

      <UFormField label="Message Template" required>
        <UTextarea
          v-model="config.telegramTemplate"
          :placeholder="templatePlaceholder"
          :rows="6"
          required
        />
      </UFormField>
    </template>

    <!-- Send Silently -->
    <UFormField>
      <UCheckbox
        v-model="config.telegramSendSilently"
        label="Send Silently"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          訊息將不會發出通知音效
        </p>
      </template>
    </UFormField>

    <!-- Protect Content -->
    <UFormField>
      <UCheckbox
        v-model="config.telegramProtectContent"
        label="Protect Content"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          防止訊息被轉發或儲存
        </p>
      </template>
    </UFormField>
  </div>
</template>
