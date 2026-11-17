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
const trustProxyFromEnv = ref(false)

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
    const result = await $fetch('/api/settings/reverse-proxy') as any
    cloudflareTunnelToken.value = result.cloudflareTunnelToken || ''
    trustProxy.value = result.trustProxy || false
    trustProxyFromEnv.value = !!result.trustProxyFromEnv
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
    await $fetch('/api/settings/reverse-proxy', {
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
      <h4 class="text-lg font-semibold text-highlighted mb-4">Cloudflare Tunnel</h4>
      
      <!-- Status -->
      <div class="space-y-2 mb-4">
        <div class="flex items-center gap-2">
          <span class="text-toned">cloudflared:</span>
          <span v-if="cloudflaredInstalled === true" class="text-up-fg">Installed</span>
          <span v-else-if="cloudflaredInstalled === false" class="text-down-fg">Not installed</span>
          <span v-else class="text-muted">Checking...</span>
        </div>
        
        <div v-if="cloudflaredInstalled" class="flex items-center gap-2">
          <span class="text-toned">Status:</span>
          <span v-if="cloudflaredRunning" class="text-up-fg">Running</span>
          <span v-else class="text-down-fg">Not running</span>
        </div>

        <div v-if="cloudflaredMessage" class="mt-2">
          <span class="text-toned">Message:</span>
          <pre class="code-block mt-1">{{ cloudflaredMessage }}</pre>
        </div>
      </div>

      <!-- Installation Guide -->
      <p v-if="cloudflaredInstalled === false" class="text-toned mb-4">
        To use Cloudflare Tunnel, you need to install cloudflared. Visit 
        <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" 
           target="_blank" class="link">
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
            <div class="text-xs text-muted mt-1">
              <a v-if="cloudflareTunnelToken && !cloudflaredRunning" 
                 @click.prevent="removeToken" 
                 class="text-down-fg hover:underline cursor-pointer mr-4">
                Remove Token
              </a>
              <span>Don't know how to get the token? </span>
              <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy-with-Cloudflare-Tunnel" 
                 target="_blank" class="link">
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
      <h4 class="text-lg font-semibold text-highlighted mb-4">Other Software</h4>
      <p class="text-toned">
        For other reverse proxy software like nginx, Apache, and Traefik, please read the 
        <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" 
           target="_blank" class="link">
          Reverse Proxy Wiki
        </a>.
      </p>
    </div>

    <!-- HTTP Headers -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-highlighted mb-4">HTTP Headers</h4>
      
      <UFormField label="Trust Proxy">
        <div class="space-y-2">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="trustProxy" type="radio" name="trustProxy" :value="true" class="checkbox" />
            <span class="text-toned">Yes (Recommended if using a reverse proxy)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="trustProxy" type="radio" name="trustProxy" :value="false" class="checkbox" />
            <span class="text-toned">No</span>
          </label>
        </div>
        <template #hint>
          <p class="text-xs text-muted mt-2">
            If you are behind a reverse proxy (nginx, Apache, etc.), enable this to correctly detect the client IP address from X-Forwarded-For header.
            A proxy on this machine is trusted automatically. Enable this for a proxy elsewhere (e.g. another container) that every request passes through; the last X-Forwarded-For hop is used. If the server can also be reached without the proxy, clients could fake their address and avoid the login rate limit.
          </p>
          <p v-if="trustProxyFromEnv" class="text-xs text-muted mt-1">
            TRUST_PROXY=true is set for this server, so the proxy is trusted whatever is chosen here.
          </p>
        </template>
      </UFormField>

      <div class="mt-4">
        <UButton @click="saveSettings" color="primary">Save</UButton>
      </div>
    </div>

    <!-- Stop Confirmation Modal -->
    <UModal 
      :open="showStopConfirm"
      @update:open="showStopConfirm = $event"
      title="Stop Cloudflared?"
      :ui="{ footer: 'justify-end' }"
    >
      <template #default>
        <span class="hidden"></span>
      </template>
      
      <template #body>
        <div class="space-y-4">
          <p class="text-toned">
            The current connection may be lost if you are currently connecting via Cloudflare Tunnel. 
            Are you sure you want to stop it?
          </p>
          <p class="text-pending-fg text-sm">
            If authentication is disabled, cloudflared cannot be stopped for security reasons.
          </p>
          
          <UFormField label="Current Password">
            <UInput
              v-model="currentPassword"
              type="password"
              placeholder="Enter your password to confirm"
            />
          </UFormField>
        </div>
      </template>

      <template #footer="{ close }">
        <UButton variant="ghost" @click="close">Cancel</UButton>
        <UButton color="error" @click="stopCloudflared" :loading="loading">
          Stop cloudflared
        </UButton>
      </template>
    </UModal>
  </div>
</template>
