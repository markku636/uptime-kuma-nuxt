<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()

const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const changingPassword = ref(false)
const twoFactorEnabled = ref(false)
const showTwoFactorSetup = ref(false)
const showTwoFactorDisable = ref(false)
const twoFactorSetupData = ref<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null)
const twoFactorToken = ref('')
const settingUpTwoFactor = ref(false)
const disablingTwoFactor = ref(false)
const disablePassword = ref('')
const apiKeys = ref<any[]>([])
const loadingKeys = ref(true)
const showAddKeyForm = ref(false)
const newKeyName = ref('')
const newKeyValue = ref('')

onMounted(async () => {
  await Promise.all([fetchApiKeys(), fetchTwoFactorStatus()])
})

async function fetchTwoFactorStatus() {
  try {
    const result = await $fetch('/api/auth/2fa/status') as any
    twoFactorEnabled.value = result.enabled
  } catch (error) {}
}

async function startTwoFactorSetup() {
  try {
    const result = await $fetch('/api/auth/2fa/setup', { method: 'POST' }) as any
    twoFactorSetupData.value = { secret: result.secret, qrCode: result.qrCode, backupCodes: result.backupCodes }
    showTwoFactorSetup.value = true
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to setup 2FA', color: 'error' })
  }
}

async function verifyAndEnableTwoFactor() {
  if (!twoFactorToken.value || twoFactorToken.value.length !== 6) {
    toast.add({ title: 'Error', description: 'Please enter a valid 6-digit code', color: 'error' })
    return
  }
  settingUpTwoFactor.value = true
  try {
    await $fetch('/api/auth/2fa/verify', { method: 'POST', body: { token: twoFactorToken.value, secret: twoFactorSetupData.value?.secret } })
    toast.add({ title: 'Success', description: 'Two-factor authentication enabled', color: 'success' })
    twoFactorEnabled.value = true
    showTwoFactorSetup.value = false
    twoFactorToken.value = ''
    twoFactorSetupData.value = null
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Invalid verification code', color: 'error' })
  } finally {
    settingUpTwoFactor.value = false
  }
}

async function disableTwoFactor() {
  if (!disablePassword.value) {
    toast.add({ title: 'Error', description: 'Please enter your password', color: 'error' })
    return
  }
  disablingTwoFactor.value = true
  try {
    await $fetch('/api/auth/2fa/disable', { method: 'POST', body: { password: disablePassword.value } })
    toast.add({ title: 'Success', description: 'Two-factor authentication disabled', color: 'success' })
    twoFactorEnabled.value = false
    showTwoFactorDisable.value = false
    disablePassword.value = ''
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to disable 2FA', color: 'error' })
  } finally {
    disablingTwoFactor.value = false
  }
}

async function fetchApiKeys() {
  loadingKeys.value = true
  try { apiKeys.value = await $fetch('/api/v1/api-keys') as any[] }
  catch (error) {}
  finally { loadingKeys.value = false }
}

async function changePassword() {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    toast.add({ title: 'Error', description: 'Passwords do not match', color: 'error' })
    return
  }
  if (passwordForm.value.newPassword.length < 6) {
    toast.add({ title: 'Error', description: 'Password must be at least 6 characters', color: 'error' })
    return
  }
  changingPassword.value = true
  try {
    await $fetch('/api/auth/change-password', { method: 'POST', body: { currentPassword: passwordForm.value.currentPassword, newPassword: passwordForm.value.newPassword } })
    toast.add({ title: 'Success', description: 'Password changed successfully', color: 'success' })
    passwordForm.value = { currentPassword: '', newPassword: '', confirmPassword: '' }
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to change password', color: 'error' })
  } finally {
    changingPassword.value = false
  }
}

async function generateApiKey() {
  if (!newKeyName.value) {
    toast.add({ title: 'Error', description: 'Please enter a name for the API key', color: 'error' })
    return
  }
  try {
    const result = await $fetch('/api/v1/api-keys', { method: 'POST', body: { name: newKeyName.value } }) as any
    newKeyValue.value = result.key
    toast.add({ title: 'Success', description: 'API key generated', color: 'success' })
    await fetchApiKeys()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to generate API key', color: 'error' })
  }
}

async function deleteApiKey(id: number) {
  if (!confirm('Are you sure you want to delete this API key?')) return
  try {
    await $fetch(`/api/v1/api-keys/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'API key deleted', color: 'success' })
    await fetchApiKeys()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete API key', color: 'error' })
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Copied', description: 'Copied to clipboard', color: 'success' })
}
</script>

<template>
  <div class="space-y-6">
    <!-- Change Password -->
    <div class="section-card">
      <h5 class="text-lg font-semibold text-white mb-4">Change Password</h5>
      <form @submit.prevent="changePassword" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Current Password</label>
          <input v-model="passwordForm.currentPassword" type="password" class="input-field" autocomplete="current-password" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">New Password</label>
          <input v-model="passwordForm.newPassword" type="password" class="input-field" autocomplete="new-password" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Confirm New Password</label>
          <input v-model="passwordForm.confirmPassword" type="password" class="input-field" autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn-primary" :disabled="changingPassword">
          {{ changingPassword ? 'Changing...' : 'Change Password' }}
        </button>
      </form>
    </div>

    <!-- Two-Factor Authentication -->
    <div class="section-card">
      <div class="flex justify-between items-center mb-4">
        <h5 class="text-lg font-semibold text-white">Two-Factor Authentication</h5>
        <span :class="twoFactorEnabled ? 'badge badge-success' : 'badge badge-secondary'">
          {{ twoFactorEnabled ? 'Enabled' : 'Disabled' }}
        </span>
      </div>
      <p class="text-gray-400 mb-4">Add an extra layer of security to your account.</p>
      <button v-if="!twoFactorEnabled" class="btn btn-primary" @click="startTwoFactorSetup">Enable 2FA</button>
      <button v-else class="btn btn-danger" @click="showTwoFactorDisable = true">Disable 2FA</button>
    </div>

    <!-- API Keys -->
    <div class="section-card">
      <div class="flex justify-between items-center mb-4">
        <h5 class="text-lg font-semibold text-white">API Keys</h5>
        <button class="btn btn-primary" @click="showAddKeyForm = true">Generate Key</button>
      </div>
      <div v-if="loadingKeys" class="text-center py-8 text-gray-400">Loading...</div>
      <div v-else-if="apiKeys.length === 0" class="text-center py-8 text-gray-400">No API keys generated yet</div>
      <div v-else class="space-y-2">
        <div v-for="key in apiKeys" :key="key.id" class="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
          <div>
            <span class="font-medium text-white">{{ key.name }}</span>
            <span class="text-sm text-gray-400 ml-2">Created: {{ new Date(key.createdAt).toLocaleDateString() }}</span>
          </div>
          <button class="btn btn-danger" @click="deleteApiKey(key.id)">Delete</button>
        </div>
      </div>
    </div>

    <!-- 2FA Setup Modal -->
    <div v-if="showTwoFactorSetup" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4">
        <h3 class="text-xl font-bold text-white mb-4">Setup Two-Factor Authentication</h3>
        <div v-if="twoFactorSetupData" class="space-y-4">
          <div>
            <p class="text-gray-300 mb-2">1. Scan this QR code</p>
            <div class="bg-white p-4 rounded-lg text-center">
              <img :src="twoFactorSetupData.qrCode" alt="2FA QR Code" class="mx-auto" style="max-width: 200px" />
            </div>
            <p class="text-sm text-gray-400 mt-2 text-center">Or enter: <code class="bg-gray-700 px-2 py-1 rounded">{{ twoFactorSetupData.secret }}</code></p>
          </div>
          <div>
            <p class="text-gray-300 mb-2">2. Save backup codes</p>
            <div class="grid grid-cols-2 gap-2 p-3 bg-gray-700 rounded-lg font-mono text-sm">
              <span v-for="code in twoFactorSetupData.backupCodes" :key="code" class="text-gray-300">{{ code }}</span>
            </div>
          </div>
          <div>
            <p class="text-gray-300 mb-2">3. Enter 6-digit code</p>
            <input v-model="twoFactorToken" type="text" class="input-field text-center text-2xl tracking-widest" maxlength="6" placeholder="000000" />
          </div>
          <div class="flex gap-3">
            <button class="btn btn-secondary flex-1" @click="showTwoFactorSetup = false">Cancel</button>
            <button class="btn btn-primary flex-1" :disabled="settingUpTwoFactor" @click="verifyAndEnableTwoFactor">
              {{ settingUpTwoFactor ? 'Verifying...' : 'Verify & Enable' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2FA Disable Modal -->
    <div v-if="showTwoFactorDisable" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-red-400 mb-4">Disable Two-Factor Authentication</h3>
        <p class="text-gray-400 mb-4">Enter your password to confirm.</p>
        <input v-model="disablePassword" type="password" class="input-field mb-4" placeholder="Password" />
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="showTwoFactorDisable = false">Cancel</button>
          <button class="btn btn-danger flex-1" :disabled="disablingTwoFactor" @click="disableTwoFactor">
            {{ disablingTwoFactor ? 'Disabling...' : 'Disable 2FA' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Add API Key Modal -->
    <div v-if="showAddKeyForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-white mb-4">Generate API Key</h3>
        <div v-if="newKeyValue">
          <div class="alert alert-warning mb-4">This key will only be shown once!</div>
          <div class="flex gap-2 mb-4">
            <input :value="newKeyValue" type="text" class="input-field flex-1 font-mono" readonly />
            <button class="btn btn-secondary" @click="copyToClipboard(newKeyValue)">Copy</button>
          </div>
          <button class="btn btn-primary w-full" @click="showAddKeyForm = false; newKeyValue = ''; newKeyName = ''">Done</button>
        </div>
        <form v-else @submit.prevent="generateApiKey" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Key Name</label>
            <input v-model="newKeyName" type="text" class="input-field" placeholder="e.g., CI/CD Pipeline" />
          </div>
          <div class="flex gap-3">
            <button type="button" class="btn btn-secondary flex-1" @click="showAddKeyForm = false">Cancel</button>
            <button type="submit" class="btn btn-primary flex-1">Generate</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
