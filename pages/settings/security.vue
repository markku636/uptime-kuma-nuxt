<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()

// Password change
const passwordForm = ref({ currentPassword: '', newPassword: '', confirmPassword: '' })
const changingPassword = ref(false)

// Two-Factor Authentication
const twoFactorEnabled = ref(false)
const showTwoFactorSetup = ref(false)
const showTwoFactorDisable = ref(false)
const twoFactorSetupData = ref<{ secret: string; qrCode: string; backupCodes: string[] } | null>(null)
const twoFactorToken = ref('')
const settingUpTwoFactor = ref(false)
const disablingTwoFactor = ref(false)
const disablePassword = ref('')

// Disable Auth
const disableAuth = ref(false)
const showDisableAuthWarning = ref(false)
const disableAuthPassword = ref('')

// Active Sessions
const activeSessions = ref<any[]>([])
const loadingSessions = ref(true)

onMounted(async () => {
  await Promise.all([fetchTwoFactorStatus(), fetchActiveSessions()])
})

async function fetchTwoFactorStatus() {
  try {
    const result = await $fetch('/api/auth/2fa/status') as any
    // Handle both { ok, data } format and direct format
    const data = result?.data || result
    twoFactorEnabled.value = data?.enabled || false
    disableAuth.value = data?.disableAuth || false
  } catch (error) {
    console.error('Failed to fetch 2FA status:', error)
  }
}

async function fetchActiveSessions() {
  loadingSessions.value = true
  try {
    const result = await $fetch('/api/auth/sessions') as any[]
    activeSessions.value = result || []
  } catch (error) {}
  finally { loadingSessions.value = false }
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

async function toggleDisableAuth() {
  if (!disableAuth.value) {
    // Trying to enable "disable auth" - show warning
    showDisableAuthWarning.value = true
  } else {
    // Re-enabling auth
    try {
      await $fetch('/api/auth/toggle-auth', { method: 'POST', body: { disableAuth: false } })
      disableAuth.value = false
      toast.add({ title: 'Success', description: 'Authentication re-enabled', color: 'success' })
    } catch (error: any) {
      toast.add({ title: 'Error', description: error.data?.message || 'Failed to enable auth', color: 'error' })
    }
  }
}

async function confirmDisableAuth() {
  if (!disableAuthPassword.value) {
    toast.add({ title: 'Error', description: 'Please enter your password', color: 'error' })
    return
  }
  try {
    await $fetch('/api/auth/toggle-auth', { method: 'POST', body: { disableAuth: true, password: disableAuthPassword.value } })
    disableAuth.value = true
    showDisableAuthWarning.value = false
    disableAuthPassword.value = ''
    toast.add({ title: 'Warning', description: 'Authentication has been disabled!', color: 'warning' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to disable auth', color: 'error' })
  }
}

async function revokeSession(sessionId: string) {
  if (!confirm('Revoke this session?')) return
  try {
    await $fetch(`/api/auth/sessions/${sessionId}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'Session revoked', color: 'success' })
    await fetchActiveSessions()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to revoke session', color: 'error' })
  }
}

async function revokeAllSessions() {
  if (!confirm('Revoke all other sessions? You will remain logged in.')) return
  try {
    await $fetch('/api/auth/sessions/revoke-all', { method: 'POST' })
    toast.add({ title: 'Success', description: 'All other sessions revoked', color: 'success' })
    await fetchActiveSessions()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to revoke sessions', color: 'error' })
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
      <p class="text-gray-400 mb-4">Add an extra layer of security to your account using a TOTP authenticator app.</p>
      <button v-if="!twoFactorEnabled" class="btn btn-primary" @click="startTwoFactorSetup">Enable 2FA</button>
      <button v-else class="btn btn-danger" @click="showTwoFactorDisable = true">Disable 2FA</button>
    </div>

    <!-- Advanced Security -->
    <div class="section-card border border-red-500/30">
      <h5 class="text-lg font-semibold text-red-400 mb-4">⚠️ Advanced Security</h5>
      
      <!-- Disable Auth Toggle -->
      <div class="mb-6">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-white font-medium">Disable Authentication</p>
            <p class="text-gray-400 text-sm">Allow anyone to access the dashboard without logging in</p>
          </div>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" :checked="disableAuth" class="sr-only peer" @change="toggleDisableAuth">
            <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
          </label>
        </div>
        <div v-if="disableAuth" class="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
          <p class="text-red-400 text-sm">⚠️ Authentication is currently disabled. Anyone can access your dashboard!</p>
        </div>
      </div>
    </div>

    <!-- Active Sessions -->
    <div class="section-card">
      <div class="flex justify-between items-center mb-4">
        <h5 class="text-lg font-semibold text-white">Active Sessions</h5>
        <button v-if="activeSessions.length > 1" class="btn btn-sm btn-secondary" @click="revokeAllSessions">
          Revoke All Others
        </button>
      </div>
      
      <div v-if="loadingSessions" class="text-center py-8 text-gray-400">Loading sessions...</div>
      <div v-else-if="activeSessions.length === 0" class="text-center py-8 text-gray-400">No active sessions</div>
      <div v-else class="space-y-3">
        <div v-for="session in activeSessions" :key="session.id" class="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
          <div class="flex items-center gap-3">
            <UIcon :name="session.current ? 'i-heroicons-device-phone-mobile' : 'i-heroicons-computer-desktop'" class="w-6 h-6 text-gray-400" />
            <div>
              <p class="text-white">{{ session.userAgent || 'Unknown Device' }}</p>
              <p class="text-sm text-gray-400">
                {{ session.ip || 'Unknown IP' }} · Last active: {{ new Date(session.lastActive).toLocaleString() }}
                <span v-if="session.current" class="text-green-400 ml-2">(Current)</span>
              </p>
            </div>
          </div>
          <button v-if="!session.current" class="btn btn-sm btn-danger" @click="revokeSession(session.id)">Revoke</button>
        </div>
      </div>
    </div>

    <!-- 2FA Setup Modal -->
    <div v-if="showTwoFactorSetup" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-white mb-4">Setup Two-Factor Authentication</h3>
        <div v-if="twoFactorSetupData" class="space-y-4">
          <div>
            <p class="text-gray-300 mb-2">1. Scan this QR code with your authenticator app</p>
            <div class="bg-white p-4 rounded-lg text-center">
              <img :src="twoFactorSetupData.qrCode" alt="2FA QR Code" class="mx-auto" style="max-width: 200px" />
            </div>
            <p class="text-sm text-gray-400 mt-2 text-center">
              Or enter manually: 
              <code class="bg-gray-700 px-2 py-1 rounded cursor-pointer" @click="copyToClipboard(twoFactorSetupData.secret)">
                {{ twoFactorSetupData.secret }}
              </code>
            </p>
          </div>
          <div>
            <p class="text-gray-300 mb-2">2. Save these backup codes in a safe place</p>
            <div class="grid grid-cols-2 gap-2 p-3 bg-gray-700 rounded-lg font-mono text-sm">
              <span v-for="code in twoFactorSetupData.backupCodes" :key="code" class="text-gray-300">{{ code }}</span>
            </div>
            <button class="text-green-400 text-sm mt-2" @click="copyToClipboard(twoFactorSetupData.backupCodes.join('\n'))">
              Copy all codes
            </button>
          </div>
          <div>
            <p class="text-gray-300 mb-2">3. Enter the 6-digit code from your app</p>
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
        <p class="text-gray-400 mb-4">Enter your password to confirm disabling 2FA.</p>
        <input v-model="disablePassword" type="password" class="input-field mb-4" placeholder="Password" />
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="showTwoFactorDisable = false">Cancel</button>
          <button class="btn btn-danger flex-1" :disabled="disablingTwoFactor" @click="disableTwoFactor">
            {{ disablingTwoFactor ? 'Disabling...' : 'Disable 2FA' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Disable Auth Warning Modal -->
    <div v-if="showDisableAuthWarning" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4">
        <h3 class="text-xl font-bold text-red-400 mb-4">⚠️ Warning: Disable Authentication</h3>
        <div class="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-4">
          <p class="text-red-400 text-sm">
            This will allow <strong>anyone</strong> to access your Uptime Kuma dashboard without logging in. 
            Only do this if you're sure your instance is not publicly accessible.
          </p>
        </div>
        <p class="text-gray-400 mb-4">Enter your password to confirm.</p>
        <input v-model="disableAuthPassword" type="password" class="input-field mb-4" placeholder="Password" />
        <div class="flex gap-3">
          <button class="btn btn-secondary flex-1" @click="showDisableAuthWarning = false">Cancel</button>
          <button class="btn btn-danger flex-1" @click="confirmDisableAuth">
            Disable Auth
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
