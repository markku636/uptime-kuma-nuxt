<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()

// Cloudflare Tunnel status
const cloudflaredInstalled = ref<boolean | null>(null)
const cloudflaredRunning = ref(false)
const cloudflareTunnelToken = ref('')
const cloudflaredMessage = ref('')
const currentPassword = ref('')
const loading = ref(false)

// Trust Proxy settings
const trustProxy = ref(false)

// Modal states
const showStopConfirm = ref(false)

onMounted(async () => {
  await fetchCloudflaredStatus()
  await fetchSettings()
})

async function fetchCloudflaredStatus() {
  try {
    const result = await $fetch('/api/cloudflared/status') as any
    cloudflaredInstalled.value = result.installed
    cloudflaredRunning.value = result.running
    cloudflaredMessage.value = result.message || ''
  } catch (error) {
    cloudflaredInstalled.value = false
  }
}

async function fetchSettings() {
  try {
    const result = await $fetch('/api/settings') as any
    cloudflareTunnelToken.value = result.cloudflareTunnelToken || ''
    trustProxy.value = result.trustProxy || false
  } catch (error) {
    console.error('Failed to fetch settings')
  }
}

async function startCloudflared() {
  if (!cloudflareTunnelToken.value) {
    toast.add({ title: 'Error', description: 'Please enter a Cloudflare Tunnel token', color: 'error' })
    return
  }
  
  loading.value = true
  try {
    await $fetch('/api/cloudflared/start', {
      method: 'POST',
      body: { token: cloudflareTunnelToken.value }
    })
    toast.add({ title: 'Success', description: 'Cloudflared started successfully', color: 'success' })
    await fetchCloudflaredStatus()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to start cloudflared', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function stopCloudflared() {
  loading.value = true
  try {
    await $fetch('/api/cloudflared/stop', {
      method: 'POST',
      body: { password: currentPassword.value }
    })
    toast.add({ title: 'Success', description: 'Cloudflared stopped', color: 'success' })
    showStopConfirm.value = false
    currentPassword.value = ''
    await fetchCloudflaredStatus()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to stop cloudflared', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function removeToken() {
  cloudflareTunnelToken.value = ''
  await saveSettings()
}

async function saveSettings() {
  try {
    await $fetch('/api/settings', {
      method: 'PUT',
      body: { 
        cloudflareTunnelToken: cloudflareTunnelToken.value,
        trustProxy: trustProxy.value
      }
    })
    toast.add({ title: 'Success', description: 'Settings saved', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save settings', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Cloudflare Tunnel -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-white mb-4">Cloudflare Tunnel</h4>
      
      <!-- Status -->
      <div class="space-y-2 mb-4">
        <div class="flex items-center gap-2">
          <span class="text-gray-400">cloudflared:</span>
          <span v-if="cloudflaredInstalled === true" class="text-green-500">Installed</span>
          <span v-else-if="cloudflaredInstalled === false" class="text-red-500">Not installed</span>
          <span v-else class="text-gray-500">Checking...</span>
        </div>
        
        <div v-if="cloudflaredInstalled" class="flex items-center gap-2">
          <span class="text-gray-400">Status:</span>
          <span v-if="cloudflaredRunning" class="text-green-500">Running</span>
          <span v-else class="text-red-500">Not running</span>
        </div>

        <div v-if="cloudflaredMessage" class="mt-2">
          <span class="text-gray-400">Message:</span>
          <pre class="bg-gray-800 p-2 rounded text-sm text-gray-300 mt-1 whitespace-pre-wrap">{{ cloudflaredMessage }}</pre>
        </div>
      </div>

      <!-- Installation Guide -->
      <p v-if="cloudflaredInstalled === false" class="text-gray-400 mb-4">
        To use Cloudflare Tunnel, you need to install cloudflared. Visit 
        <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" 
           target="_blank" class="text-green-400 hover:underline">
          Cloudflare's website
        </a> for installation instructions.
      </p>

      <!-- Token Input -->
      <div v-if="cloudflaredInstalled" class="space-y-4">
        <UFormField label="Cloudflare Tunnel Token">
          <UInput
            v-model="cloudflareTunnelToken"
            type="password"
            :disabled="cloudflaredRunning"
            placeholder="Enter your Cloudflare Tunnel token"
          />
          <template #hint>
            <div class="text-xs text-gray-500 mt-1">
              <a v-if="cloudflareTunnelToken && !cloudflaredRunning" 
                 @click.prevent="removeToken" 
                 class="text-red-400 hover:underline cursor-pointer mr-4">
                Remove Token
              </a>
              <span>Don't know how to get the token? </span>
              <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy-with-Cloudflare-Tunnel" 
                 target="_blank" class="text-green-400 hover:underline">
                Read the guide
              </a>
            </div>
          </template>
        </UFormField>

        <!-- Start/Stop Buttons -->
        <div class="flex gap-2">
          <UButton 
            v-if="!cloudflaredRunning" 
            @click="startCloudflared"
            :loading="loading"
            color="primary"
          >
            Start cloudflared
          </UButton>
          
          <UButton 
            v-if="cloudflaredRunning" 
            @click="showStopConfirm = true"
            color="error"
          >
            Stop cloudflared
          </UButton>
        </div>
      </div>
    </div>

    <!-- Other Reverse Proxy -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-white mb-4">Other Software</h4>
      <p class="text-gray-400">
        For other reverse proxy software like nginx, Apache, and Traefik, please read the 
        <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" 
           target="_blank" class="text-green-400 hover:underline">
          Reverse Proxy Wiki
        </a>.
      </p>
    </div>

    <!-- HTTP Headers -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-white mb-4">HTTP Headers</h4>
      
      <UFormField label="Trust Proxy">
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="trustProxy" type="radio" name="trustProxy" :value="true" />
            <span class="text-gray-300">Yes (Recommended if using a reverse proxy)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="trustProxy" type="radio" name="trustProxy" :value="false" />
            <span class="text-gray-300">No</span>
          </label>
        </div>
        <template #hint>
          <p class="text-xs text-gray-500 mt-2">
            If you are behind a reverse proxy (nginx, Apache, etc.), enable this to correctly detect the client IP address from X-Forwarded-For header.
          </p>
        </template>
      </UFormField>

      <div class="mt-4">
        <UButton @click="saveSettings" color="primary">Save</UButton>
      </div>
    </div>

    <!-- Stop Confirmation Modal -->
    <UModal v-model:open="showStopConfirm">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold text-white mb-4">Stop Cloudflared?</h3>
          <p class="text-gray-400 mb-4">
            The current connection may be lost if you are currently connecting via Cloudflare Tunnel. 
            Are you sure you want to stop it?
          </p>
          <p class="text-amber-400 text-sm mb-4">
            If authentication is disabled, cloudflared cannot be stopped for security reasons.
          </p>
          
          <UFormField label="Current Password" class="mb-4">
            <UInput
              v-model="currentPassword"
              type="password"
              placeholder="Enter your password to confirm"
            />
          </UFormField>

          <div class="flex justify-end gap-2">
            <UButton variant="ghost" @click="showStopConfirm = false">Cancel</UButton>
            <UButton color="error" @click="stopCloudflared" :loading="loading">
              Stop cloudflared
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
