<script setup lang="ts">
/**
 * Aliyun SMS (阿里雲短信) Notification Provider
 * 原版: src/components/notifications/AliyunSms.vue
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
    <!-- Access Key ID -->
    <UFormField label="Access Key ID" required>
      <UInput
        v-model="config.accessKeyId"
        placeholder="Your Aliyun Access Key ID"
        required
      />
    </UFormField>

    <!-- Secret Access Key -->
    <UFormField label="Secret Access Key" required>
      <UInput
        v-model="config.secretAccessKey"
        type="password"
        placeholder="Your Aliyun Secret Access Key"
        required
      />
    </UFormField>

    <!-- Phone Numbers -->
    <UFormField label="Phone Numbers (手機號碼)" required>
      <UInput
        v-model="config.phonenumber"
        placeholder="13800138000,13900139000"
        required
      />
      <template #help>
        <p class="text-sm text-gray-500">
          多個號碼請用逗號分隔，格式為中國大陸手機號
        </p>
      </template>
    </UFormField>

    <!-- Template Code -->
    <UFormField label="Template Code (模板編號)" required>
      <UInput
        v-model="config.templateCode"
        placeholder="SMS_123456789"
        required
      />
    </UFormField>

    <!-- Sign Name -->
    <UFormField label="Sign Name (簽名名稱)" required>
      <UInput
        v-model="config.signName"
        placeholder="Your approved signature"
        required
      />
    </UFormField>

    <!-- Info Box -->
    <UAlert
      icon="i-heroicons-exclamation-triangle"
      color="warning"
      variant="subtle"
      title="短信模板要求"
    >
      <template #description>
        <div class="text-sm space-y-2 mt-2">
          <p>短信模板必須包含以下變數：</p>
          <code class="block bg-gray-100 dark:bg-gray-800 p-2 rounded text-xs">
            ${name} ${time} ${status} ${msg}
          </code>
          <p class="mt-2">
            <a 
              href="https://help.aliyun.com/document_detail/101414.html" 
              target="_blank"
              class="text-primary-500 hover:underline"
            >
              查看阿里雲短信 API 文檔
            </a>
          </p>
        </div>
      </template>
    </UAlert>

    <!-- Additional Info -->
    <UAlert
      icon="i-heroicons-information-circle"
      color="info"
      variant="subtle"
      title="如何取得阿里雲憑證"
    >
      <template #description>
        <ol class="text-sm list-decimal list-inside space-y-2 mt-2">
          <li>登入阿里雲控制台</li>
          <li>前往「AccessKey 管理」建立或查看 AccessKey</li>
          <li>前往「短信服務」控制台</li>
          <li>申請並審核短信簽名</li>
          <li>建立短信模板（需包含必要變數）</li>
          <li>等待模板審核通過後使用</li>
        </ol>
      </template>
    </UAlert>
  </div>
</template>
