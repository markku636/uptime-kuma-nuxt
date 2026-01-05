<script setup lang="ts">
/**
 * SMTP Email Notification Provider
 * 原版: src/components/notifications/SMTP.vue
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
  if (config.value.smtpSecure === undefined) {
    config.value.smtpSecure = false
  }
})

const securityOptions = [
  { label: 'None / STARTTLS (Port 25, 587)', value: false },
  { label: 'TLS (Port 465)', value: true }
]

// 檢查是否有收件人
const hasRecipient = computed(() => {
  return !!(config.value.smtpTo || config.value.smtpCC || config.value.smtpBCC)
})

// DKIM 設定顯示
const showDkim = ref(false)
</script>

<template>
  <div class="space-y-4">
    <!-- SMTP Host -->
    <UFormField label="SMTP Hostname" required>
      <UInput
        v-model="config.smtpHost"
        placeholder="smtp.gmail.com"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          輸入 SMTP 伺服器地址，或使用 <code class="text-xs bg-gray-100 dark:bg-gray-800 px-1 rounded">localhost</code> 
          連接本地 
          <a href="https://wikipedia.org/wiki/Mail_Transfer_Agent" target="_blank" class="text-primary-500 hover:underline">
            MTA (郵件傳輸代理)
          </a>
        </p>
      </template>
    </UFormField>

    <!-- SMTP Port -->
    <UFormField label="SMTP Port" required>
      <UInput
        v-model.number="config.smtpPort"
        type="number"
        placeholder="587"
        required
        min="0"
        max="65535"
      />
    </UFormField>

    <!-- Security -->
    <UFormField label="Security">
      <USelect
        v-model="config.smtpSecure"
        :items="securityOptions"
      />
    </UFormField>

    <!-- Ignore TLS Error -->
    <UFormField>
      <UCheckbox
        v-model="config.smtpIgnoreTLSError"
        label="Ignore TLS Error"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          忽略憑證錯誤（不建議在生產環境使用）
        </p>
      </template>
    </UFormField>

    <!-- Username -->
    <UFormField label="Username">
      <UInput
        v-model="config.smtpUsername"
        placeholder="user@example.com"
        autocomplete="off"
      />
    </UFormField>

    <!-- Password -->
    <UFormField label="Password">
      <UInput
        v-model="config.smtpPassword"
        type="password"
        placeholder="Your SMTP password or app-specific password"
        autocomplete="new-password"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          如使用 Gmail，請使用「應用程式密碼」而非帳號密碼
        </p>
      </template>
    </UFormField>

    <UDivider label="Email Settings" />

    <!-- From Email -->
    <UFormField label="From Email" required>
      <UInput
        v-model="config.smtpFrom"
        placeholder='"Uptime Kuma" <alerts@example.com>'
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          可以使用 "顯示名稱" &lt;email@example.com&gt; 格式
        </p>
      </template>
    </UFormField>

    <!-- To Email -->
    <UFormField label="To Email" :required="!hasRecipient">
      <UInput
        v-model="config.smtpTo"
        placeholder="admin@example.com, team@example.com"
        :required="!hasRecipient"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          多個收件人請用逗號分隔
        </p>
      </template>
    </UFormField>

    <!-- CC -->
    <UFormField label="CC">
      <UInput
        v-model="config.smtpCC"
        placeholder="cc@example.com"
      />
    </UFormField>

    <!-- BCC -->
    <UFormField label="BCC">
      <UInput
        v-model="config.smtpBCC"
        placeholder="bcc@example.com"
      />
    </UFormField>

    <UDivider label="Custom Content (Optional)" />

    <!-- Custom Subject -->
    <UFormField label="Custom Subject">
      <UInput
        v-model="config.customSubject"
        placeholder="[Uptime Kuma] {{ monitorJSON.name }} is {{ msg }}"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          留空使用預設標題。支援 Jinja2 模板變數
        </p>
      </template>
    </UFormField>

    <!-- Custom Body -->
    <UFormField label="Custom Body">
      <UTextarea
        v-model="config.customBody"
        :rows="4"
        placeholder="Monitor: {{ monitorJSON.name }}&#10;Status: {{ msg }}&#10;Time: {{ heartbeatJSON.time }}"
      />
      <template #help>
        <p class="text-sm text-gray-500">
          留空使用預設內容。支援 Jinja2 模板變數
        </p>
      </template>
    </UFormField>

    <!-- Use HTML Body -->
    <UFormField>
      <UCheckbox
        v-model="config.htmlBody"
        label="Use HTML for custom E-mail body"
      />
    </UFormField>

    <!-- DKIM Settings -->
    <UDivider />
    
    <UButton 
      variant="ghost" 
      class="w-full justify-between"
      @click="showDkim = !showDkim"
    >
      <span>DKIM Settings (Advanced)</span>
      <UIcon :name="showDkim ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" />
    </UButton>

    <div v-if="showDkim" class="space-y-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
      <p class="text-sm text-gray-500">
        DKIM (DomainKeys Identified Mail) 用於郵件簽名驗證。
        <a 
          href="https://nodemailer.com/dkim/" 
          target="_blank"
          class="text-primary-500 hover:underline"
        >
          查看文檔
        </a>
      </p>

      <!-- DKIM Domain -->
      <UFormField label="DKIM Domain">
        <UInput
          v-model="config.smtpDkimDomain"
          placeholder="example.com"
        />
      </UFormField>

      <!-- DKIM Key Selector -->
      <UFormField label="DKIM Key Selector">
        <UInput
          v-model="config.smtpDkimKeySelector"
          placeholder="2017"
        />
      </UFormField>

      <!-- DKIM Private Key -->
      <UFormField label="DKIM Private Key">
        <UTextarea
          v-model="config.smtpDkimPrivateKey"
          :rows="4"
          placeholder="-----BEGIN PRIVATE KEY-----"
        />
      </UFormField>

      <!-- DKIM Hash Algorithm -->
      <UFormField label="DKIM Hash Algorithm">
        <UInput
          v-model="config.smtpDkimHashAlgo"
          placeholder="sha256"
        />
      </UFormField>

      <!-- DKIM Header Field Names -->
      <UFormField label="DKIM Header Field Names">
        <UInput
          v-model="config.smtpDkimheaderFieldNames"
          placeholder="message-id:date:from:to"
        />
      </UFormField>

      <!-- DKIM Skip Fields -->
      <UFormField label="DKIM Skip Fields">
        <UInput
          v-model="config.smtpDkimskipFields"
          placeholder="message-id:date"
        />
      </UFormField>
    </div>
  </div>
</template>
