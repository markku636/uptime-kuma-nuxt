<template>
  <UModal v-model="isOpen" :ui="{ width: 'max-w-md' }">
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold text-gray-100 flex items-center gap-2">
          Setup 2FA
          <span v-if="twoFAStatus === true" class="badge badge-success text-xs">Active</span>
          <span v-if="twoFAStatus === false" class="badge bg-gray-600 text-xs">Inactive</span>
        </h3>
        <button @click="isOpen = false" :disabled="processing" class="text-gray-400 hover:text-gray-200">
          <UIcon name="i-heroicons-x-mark" class="w-5 h-5" />
        </button>
      </div>

      <div class="space-y-4">
        <!-- QR Code for setup -->
        <div v-if="uri && !twoFAStatus" class="text-center">
          <div class="bg-white p-4 rounded-lg inline-block mb-4">
            <img :src="qrCodeUrl" alt="2FA QR Code" class="w-48 h-48" />
          </div>
          <p class="text-sm text-gray-400 mb-2">Scan this QR code with your authenticator app</p>
          <button 
            v-if="!showUri" 
            @click="showUri = true" 
            class="text-sm text-blue-400 hover:text-blue-300"
          >
            Show setup key
          </button>
          <p v-if="showUri" class="text-xs text-gray-500 break-all bg-gray-800 p-2 rounded mt-2">
            {{ uri }}
          </p>
        </div>

        <!-- Password input (for enable/disable) -->
        <div v-if="!uri || twoFAStatus">
          <label class="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
          <input 
            v-model="currentPassword" 
            type="password" 
            class="input w-full"
            autocomplete="current-password"
            placeholder="Enter your password"
          />
        </div>

        <!-- Enable 2FA button -->
        <button 
          v-if="!uri && !twoFAStatus" 
          @click="prepare2FA" 
          :disabled="processing || !currentPassword"
          class="btn btn-primary w-full"
        >
          <span v-if="processing" class="spinner w-4 h-4 mr-2"></span>
          Enable 2FA
        </button>

        <!-- Disable 2FA button -->
        <button 
          v-if="twoFAStatus" 
          @click="confirmDisable2FA" 
          :disabled="processing || !currentPassword"
          class="btn btn-danger w-full"
        >
          <span v-if="processing" class="spinner w-4 h-4 mr-2"></span>
          Disable 2FA
        </button>

        <!-- Token verification -->
        <div v-if="uri && !twoFAStatus" class="mt-6">
          <label class="block text-sm font-medium text-gray-300 mb-2">Verify Token</label>
          <p class="text-xs text-gray-500 mb-2">Enter the 6-digit code from your authenticator app</p>
          <div class="flex gap-2">
            <input 
              v-model="token" 
              type="text" 
              maxlength="6"
              class="input flex-1 text-center text-xl tracking-widest"
              placeholder="000000"
              autocomplete="one-time-code"
            />
            <button @click="verifyToken" :disabled="!token || token.length !== 6" class="btn btn-secondary">
              Verify
            </button>
          </div>
          <p v-if="tokenValid" class="text-sm text-emerald-400 mt-2">
            <UIcon name="i-heroicons-check-circle" class="w-4 h-4 inline" />
            Token verified successfully!
          </p>
        </div>

        <!-- Save button (after token verification) -->
        <button 
          v-if="uri && !twoFAStatus && tokenValid" 
          @click="save2FA" 
          :disabled="processing"
          class="btn btn-primary w-full"
        >
          <span v-if="processing" class="spinner w-4 h-4 mr-2"></span>
          Save & Enable 2FA
        </button>
      </div>

      <div class="flex justify-end mt-6">
        <button @click="isOpen = false" :disabled="processing" class="btn btn-secondary">
          Close
        </button>
      </div>
    </div>
  </UModal>

  <!-- Confirm Disable Modal -->
  <UModal v-model="showDisableConfirm" :ui="{ width: 'max-w-sm' }">
    <div class="p-6">
      <h3 class="text-lg font-semibold text-gray-100 mb-4">Disable 2FA</h3>
      <p class="text-gray-400 mb-6">Are you sure you want to disable two-factor authentication? This will make your account less secure.</p>
      <div class="flex justify-end gap-3">
        <button @click="showDisableConfirm = false" class="btn btn-secondary">Cancel</button>
        <button @click="disable2FA" :disabled="processing" class="btn btn-danger">
          <span v-if="processing" class="spinner w-4 h-4 mr-2"></span>
          Disable 2FA
        </button>
      </div>
    </div>
  </UModal>
</template>

<script setup lang="ts">
const toast = useToast()

const isOpen = defineModel<boolean>({ default: false })

const currentPassword = ref('')
const processing = ref(false)
const uri = ref<string | null>(null)
const token = ref('')
const tokenValid = ref(false)
const twoFAStatus = ref<boolean | null>(null)
const showUri = ref(false)
const showDisableConfirm = ref(false)

// Generate QR code URL using Google Charts API
const qrCodeUrl = computed(() => {
  if (!uri.value) return ''
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri.value)}`
})

// Get 2FA status
const getStatus = async () => {
  try {
    const res = await $fetch<{ enabled: boolean }>('/api/auth/2fa/status')
    twoFAStatus.value = res.enabled
  } catch (e: any) {
    console.error('Failed to get 2FA status:', e)
  }
}

// Prepare 2FA (generate secret)
const prepare2FA = async () => {
  processing.value = true
  try {
    const res = await $fetch<{ secret: string; qrCode: string }>('/api/auth/2fa/setup', {
      method: 'POST'
    })
    uri.value = res.qrCode
    currentPassword.value = ''
  } catch (e: any) {
    toast.add({ 
      title: 'Error', 
      description: e.data?.message || 'Failed to prepare 2FA', 
      color: 'error' 
    })
  } finally {
    processing.value = false
  }
}

// Verify token
const verifyToken = async () => {
  try {
    const res = await $fetch<{ ok: boolean }>('/api/auth/2fa/verify', {
      method: 'POST',
      body: { token: token.value }
    })
    tokenValid.value = res.ok
    if (res.ok) {
      // 2FA is now enabled
      twoFAStatus.value = true
      toast.add({ title: 'Success', description: '2FA enabled successfully', color: 'success' })
      isOpen.value = false
    } else {
      toast.add({ title: 'Invalid Token', description: 'Please try again', color: 'error' })
    }
  } catch (e: any) {
    toast.add({ 
      title: 'Error', 
      description: e.data?.message || 'Failed to verify token', 
      color: 'error' 
    })
  }
}

// Save 2FA (no longer needed as verify enables it)
const save2FA = async () => {
  // Verify token will enable 2FA
  await verifyToken()
}

// Confirm disable
const confirmDisable2FA = () => {
  showDisableConfirm.value = true
}

// Disable 2FA
const disable2FA = async () => {
  processing.value = true
  try {
    await $fetch('/api/auth/2fa/disable', {
      method: 'POST',
      body: { password: currentPassword.value }
    })
    toast.add({ title: 'Success', description: '2FA disabled successfully', color: 'success' })
    twoFAStatus.value = false
    currentPassword.value = ''
    showDisableConfirm.value = false
    isOpen.value = false
  } catch (e: any) {
    toast.add({ 
      title: 'Error', 
      description: e.data?.message || 'Failed to disable 2FA', 
      color: 'error' 
    })
  } finally {
    processing.value = false
  }
}

// Reset state when modal opens
watch(isOpen, (newVal) => {
  if (newVal) {
    getStatus()
    uri.value = null
    token.value = ''
    tokenValid.value = false
    currentPassword.value = ''
    showUri.value = false
  }
})
</script>
