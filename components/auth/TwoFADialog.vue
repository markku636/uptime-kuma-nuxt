<template>
  <UModal v-model:open="isOpen" :title="dialogTitle" :closeable="!isRequired">
    <template #body>
      <!-- Setup Mode -->
      <div v-if="mode === 'setup'" class="space-y-4">
        <UAlert
          icon="i-heroicons-information-circle"
          color="info"
          :description="$t('Scan this QR code with your authenticator app')"
        />

        <!-- QR Code -->
        <div class="flex justify-center p-4 bg-white rounded-lg">
          <img
            v-if="qrCodeDataUrl"
            :src="qrCodeDataUrl"
            :alt="$t('2FA QR Code')"
            class="w-48 h-48"
          />
          <div v-else class="w-48 h-48 flex items-center justify-center">
            <UIcon name="i-heroicons-arrow-path" class="w-8 h-8 animate-spin text-gray-400" />
          </div>
        </div>

        <!-- Manual Entry -->
        <div class="text-center">
          <button 
            type="button"
            class="text-sm text-primary-500 hover:text-primary-600"
            @click="showManualEntry = !showManualEntry"
          >
            {{ $t("Can't scan? Enter code manually") }}
          </button>
        </div>

        <div v-if="showManualEntry" class="space-y-2">
          <CopyableInput
            :value="secretKey"
            :label="$t('Secret Key')"
            readonly
          />
        </div>

        <!-- Verification Code -->
        <UFormField :label="$t('Verification Code')" required>
          <UInput
            v-model="verificationCode"
            placeholder="000000"
            :maxlength="6"
            class="text-center font-mono text-2xl tracking-widest"
            @keyup.enter="handleSetup"
          />
          <template #hint>
            <span class="text-xs text-gray-500">
              {{ $t('Enter the 6-digit code from your authenticator app') }}
            </span>
          </template>
        </UFormField>

        <UAlert
          v-if="setupError"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          :description="setupError"
        />
      </div>

      <!-- Verify Mode -->
      <div v-else-if="mode === 'verify'" class="space-y-4">
        <p class="text-gray-600 dark:text-gray-400">
          {{ $t('Enter your 2FA code to continue') }}
        </p>

        <UFormField :label="$t('Verification Code')" required>
          <UInput
            v-model="verificationCode"
            placeholder="000000"
            :maxlength="6"
            class="text-center font-mono text-2xl tracking-widest"
            autofocus
            @keyup.enter="handleVerify"
          />
        </UFormField>

        <UAlert
          v-if="verifyError"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          :description="verifyError"
        />

        <!-- Recovery Code Option -->
        <div class="text-center">
          <button
            type="button"
            class="text-sm text-primary-500 hover:text-primary-600"
            @click="useRecoveryCode = !useRecoveryCode"
          >
            {{ useRecoveryCode ? $t('Use authenticator code') : $t('Use recovery code instead') }}
          </button>
        </div>

        <UFormField v-if="useRecoveryCode" :label="$t('Recovery Code')">
          <UInput
            v-model="recoveryCode"
            :placeholder="$t('Enter recovery code')"
            @keyup.enter="handleVerify"
          />
        </UFormField>
      </div>

      <!-- Disable Mode -->
      <div v-else-if="mode === 'disable'" class="space-y-4">
        <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          :title="$t('Warning')"
          :description="$t('Disabling 2FA will make your account less secure')"
        />

        <UFormField :label="$t('Current Password')" required>
          <UInput
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
          />
        </UFormField>

        <UFormField :label="$t('2FA Code')" required>
          <UInput
            v-model="verificationCode"
            placeholder="000000"
            :maxlength="6"
            class="text-center font-mono text-xl tracking-widest"
            @keyup.enter="handleDisable"
          />
        </UFormField>

        <UAlert
          v-if="disableError"
          icon="i-heroicons-exclamation-triangle"
          color="error"
          :description="disableError"
        />
      </div>

      <!-- Recovery Codes Display -->
      <div v-else-if="mode === 'recovery-codes'" class="space-y-4">
        <UAlert
          icon="i-heroicons-exclamation-triangle"
          color="warning"
          :title="$t('Save these recovery codes')"
          :description="$t('Each code can only be used once. Store them securely.')"
        />

        <div class="grid grid-cols-2 gap-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg font-mono text-sm">
          <div
            v-for="code in recoveryCodes"
            :key="code"
            class="p-2 bg-white dark:bg-gray-700 rounded text-center"
          >
            {{ code }}
          </div>
        </div>

        <div class="flex gap-2 justify-center">
          <UButton variant="outline" @click="downloadRecoveryCodes">
            <UIcon name="i-heroicons-arrow-down-tray" class="mr-1" />
            {{ $t('Download') }}
          </UButton>
          <UButton variant="outline" @click="copyRecoveryCodes">
            <UIcon name="i-heroicons-clipboard" class="mr-1" />
            {{ $t('Copy') }}
          </UButton>
        </div>

        <UCheckbox
          v-model="savedRecoveryCodes"
          :label="$t('I have saved my recovery codes')"
        />
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton v-if="!isRequired" variant="ghost" @click="isOpen = false">
          {{ $t('Cancel') }}
        </UButton>
        
        <UButton
          v-if="mode === 'setup'"
          @click="handleSetup"
          :loading="isSubmitting"
          :disabled="verificationCode.length !== 6"
        >
          {{ $t('Enable 2FA') }}
        </UButton>
        
        <UButton
          v-else-if="mode === 'verify'"
          @click="handleVerify"
          :loading="isSubmitting"
          :disabled="!canVerify"
        >
          {{ $t('Verify') }}
        </UButton>
        
        <UButton
          v-else-if="mode === 'disable'"
          color="error"
          @click="handleDisable"
          :loading="isSubmitting"
          :disabled="!currentPassword || verificationCode.length !== 6"
        >
          {{ $t('Disable 2FA') }}
        </UButton>
        
        <UButton
          v-else-if="mode === 'recovery-codes'"
          @click="handleRecoveryCodesDone"
          :disabled="!savedRecoveryCodes"
        >
          {{ $t('Done') }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<script setup lang="ts">
type Mode = 'setup' | 'verify' | 'disable' | 'recovery-codes'

const props = defineProps<{
  mode: Mode
  isRequired?: boolean
  qrCodeDataUrl?: string
  secretKey?: string
  recoveryCodes?: string[]
}>()

const emit = defineEmits<{
  (e: 'setup', code: string): void
  (e: 'verify', code: string, recovery?: string): void
  (e: 'disable', password: string, code: string): void
  (e: 'done'): void
}>()

const isOpen = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const verificationCode = ref('')
const currentPassword = ref('')
const recoveryCode = ref('')
const showManualEntry = ref(false)
const useRecoveryCode = ref(false)
const savedRecoveryCodes = ref(false)
const isSubmitting = ref(false)

const setupError = ref('')
const verifyError = ref('')
const disableError = ref('')

const dialogTitle = computed(() => {
  switch (props.mode) {
    case 'setup':
      return t('Setup Two-Factor Authentication')
    case 'verify':
      return t('Two-Factor Authentication')
    case 'disable':
      return t('Disable Two-Factor Authentication')
    case 'recovery-codes':
      return t('Recovery Codes')
    default:
      return t('2FA')
  }
})

const canVerify = computed(() => {
  if (useRecoveryCode.value) {
    return recoveryCode.value.length > 0
  }
  return verificationCode.value.length === 6
})

// Reset state when dialog opens
watch(isOpen, (open) => {
  if (open) {
    verificationCode.value = ''
    currentPassword.value = ''
    recoveryCode.value = ''
    showManualEntry.value = false
    useRecoveryCode.value = false
    savedRecoveryCodes.value = false
    setupError.value = ''
    verifyError.value = ''
    disableError.value = ''
  }
})

async function handleSetup() {
  if (verificationCode.value.length !== 6) return
  
  try {
    isSubmitting.value = true
    setupError.value = ''
    emit('setup', verificationCode.value)
  } catch (error: any) {
    setupError.value = error.message || t('Setup failed')
  } finally {
    isSubmitting.value = false
  }
}

async function handleVerify() {
  if (!canVerify.value) return
  
  try {
    isSubmitting.value = true
    verifyError.value = ''
    
    if (useRecoveryCode.value) {
      emit('verify', '', recoveryCode.value)
    } else {
      emit('verify', verificationCode.value)
    }
  } catch (error: any) {
    verifyError.value = error.message || t('Verification failed')
  } finally {
    isSubmitting.value = false
  }
}

async function handleDisable() {
  if (!currentPassword.value || verificationCode.value.length !== 6) return
  
  try {
    isSubmitting.value = true
    disableError.value = ''
    emit('disable', currentPassword.value, verificationCode.value)
  } catch (error: any) {
    disableError.value = error.message || t('Failed to disable 2FA')
  } finally {
    isSubmitting.value = false
  }
}

function handleRecoveryCodesDone() {
  if (!savedRecoveryCodes.value) return
  emit('done')
  isOpen.value = false
}

function downloadRecoveryCodes() {
  if (!props.recoveryCodes) return
  
  const content = props.recoveryCodes.join('\n')
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'recovery-codes.txt'
  a.click()
  URL.revokeObjectURL(url)
}

async function copyRecoveryCodes() {
  if (!props.recoveryCodes) return
  
  const content = props.recoveryCodes.join('\n')
  await navigator.clipboard.writeText(content)
}
</script>
