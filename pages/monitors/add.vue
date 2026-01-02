<template>
  <div class="page-container max-w-4xl">
    <!-- Header -->
    <div class="mb-6">
      <NuxtLink to="/dashboard" class="link inline-flex items-center mb-3">
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1" />
        Back to Dashboard
      </NuxtLink>
      <h1 class="text-2xl font-bold text-gray-100">Add New Monitor</h1>
    </div>

    <!-- Form -->
    <div class="card card-body">
      <form @submit.prevent="handleCreate" class="space-y-6">
        <!-- Basic Information -->
        <div class="section-card">
          <h2 class="section-title">Basic Information</h2>
          
          <div class="grid gap-4 md:grid-cols-2">
            <div class="form-group md:col-span-2">
              <label class="input-label">Monitor Type</label>
              <select v-model="form.type" class="select-field">
                <optgroup label="General">
                  <option value="http">HTTP(s)</option>
                  <option value="keyword">HTTP(s) - Keyword</option>
                  <option value="json-query">HTTP(s) - JSON Query</option>
                  <option value="tcp">TCP Port</option>
                  <option value="ping">Ping</option>
                  <option value="dns">DNS</option>
                </optgroup>
                <optgroup label="Specific">
                  <option value="grpc-keyword">gRPC(s) - Keyword</option>
                  <option value="docker">Docker Container</option>
                  <option value="database">Database</option>
                  <option value="push">Push</option>
                </optgroup>
              </select>
            </div>

            <div class="form-group md:col-span-2">
              <label class="input-label">Friendly Name <span class="text-red-400">*</span></label>
              <input v-model="form.name" type="text" class="input-field" placeholder="My Monitor" required />
            </div>

            <!-- URL field for HTTP types -->
            <div v-if="showUrlField" class="form-group md:col-span-2">
              <label class="input-label">URL <span class="text-red-400">*</span></label>
              <input v-model="form.url" type="text" class="input-field" placeholder="https://example.com" required />
            </div>

            <!-- Hostname/Port for TCP/Ping/DNS -->
            <div v-if="showHostnameField" class="form-group" :class="showPortField ? '' : 'md:col-span-2'">
              <label class="input-label">Hostname <span class="text-red-400">*</span></label>
              <input v-model="form.hostname" type="text" class="input-field" placeholder="example.com" required />
            </div>

            <div v-if="showPortField" class="form-group">
              <label class="input-label">Port <span class="text-red-400">*</span></label>
              <input v-model.number="form.port" type="number" class="input-field" placeholder="443" required />
            </div>

            <!-- Push Token Display -->
            <div v-if="form.type === 'push'" class="form-group md:col-span-2">
              <label class="input-label">Push URL</label>
              <div class="bg-gray-700 rounded-lg p-3 text-sm text-gray-300 font-mono">
                Push URL will be generated after creation
              </div>
              <p class="text-xs text-gray-500 mt-1">Send a GET or POST request to this URL to report a heartbeat</p>
            </div>
          </div>
        </div>

        <!-- HTTP Settings -->
        <div v-if="isHttpType" class="section-card">
          <h2 class="section-title">HTTP Settings</h2>
          
          <div class="grid gap-4 md:grid-cols-2">
            <div class="form-group">
              <label class="input-label">Method</label>
              <select v-model="form.method" class="select-field">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>
            </div>

            <div class="form-group">
              <label class="input-label">Max Redirects</label>
              <input v-model.number="form.maxRedirects" type="number" class="input-field" min="0" max="10" />
            </div>

            <div v-if="form.type === 'keyword'" class="form-group md:col-span-2">
              <label class="input-label">Expected Keyword <span class="text-red-400">*</span></label>
              <input v-model="form.keyword" type="text" class="input-field" placeholder="OK" required />
              <p class="text-xs text-gray-500 mt-1">The keyword to search for in the response body</p>
            </div>

            <div v-if="form.type === 'json-query'" class="form-group md:col-span-2">
              <label class="input-label">JSON Query <span class="text-red-400">*</span></label>
              <input v-model="form.jsonPath" type="text" class="input-field" placeholder="$.status" required />
              <p class="text-xs text-gray-500 mt-1">JSONata expression to evaluate</p>
            </div>

            <div v-if="form.type === 'json-query'" class="form-group md:col-span-2">
              <label class="input-label">Expected Value</label>
              <input v-model="form.expectedValue" type="text" class="input-field" placeholder="ok" />
            </div>
          </div>

          <!-- Request Body (for POST/PUT/PATCH) -->
          <div v-if="['POST', 'PUT', 'PATCH'].includes(form.method)" class="form-group mt-4">
            <label class="input-label">Request Body</label>
            <textarea v-model="form.body" class="input-field font-mono text-sm" rows="4" placeholder='{"key": "value"}'></textarea>
          </div>

          <!-- HTTP Headers -->
          <div class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <label class="input-label">HTTP Headers</label>
              <button type="button" @click="addHeader" class="text-sm text-emerald-400 hover:text-emerald-300">
                + Add Header
              </button>
            </div>
            <div v-for="(header, index) in httpHeaders" :key="index" class="flex gap-2 mb-2">
              <input v-model="header.key" type="text" class="input-field flex-1" placeholder="Header Name" />
              <input v-model="header.value" type="text" class="input-field flex-1" placeholder="Header Value" />
              <button type="button" @click="removeHeader(index)" class="btn btn-danger btn-sm">
                <UIcon name="i-heroicons-trash" class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- HTTP Options -->
          <div class="mt-4 space-y-3">
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="form.ignoreTls" class="checkbox" />
              <span class="text-gray-300">Ignore TLS/SSL Certificate Errors</span>
            </label>
            <label v-if="form.type === 'keyword'" class="flex items-center gap-2">
              <input type="checkbox" v-model="form.invertKeyword" class="checkbox" />
              <span class="text-gray-300">Invert Keyword (alert if found)</span>
            </label>
          </div>
        </div>

        <!-- TLS/SSL Certificate Settings -->
        <div v-if="isHttpType" class="section-card">
          <div class="flex items-center justify-between cursor-pointer" @click="showTlsSection = !showTlsSection">
            <h2 class="section-title !mb-0">TLS/SSL Certificate</h2>
            <UIcon :name="showTlsSection ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-5 h-5 text-gray-400" />
          </div>
          
          <div v-show="showTlsSection" class="mt-4 space-y-4">
            <label class="flex items-center gap-2">
              <input type="checkbox" v-model="form.expiryNotification" class="checkbox" />
              <span class="text-gray-300">Enable Certificate Expiry Notification</span>
            </label>

            <div v-if="form.expiryNotification" class="form-group">
              <label class="input-label">Certificate Expiry Notification Days</label>
              <div class="flex flex-wrap gap-2 mt-2">
                <label 
                  v-for="days in [7, 14, 21, 30, 60, 90]" 
                  :key="days"
                  class="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-all"
                  :class="tlsExpiryDays.includes(days) ? 'bg-emerald-600/30 border border-emerald-500' : 'bg-gray-700 hover:bg-gray-600 border border-transparent'"
                >
                  <input type="checkbox" :value="days" v-model="tlsExpiryDays" class="hidden" />
                  <span class="text-sm text-gray-300">{{ days }} days</span>
                </label>
              </div>
              <p class="text-xs text-gray-500 mt-2">Select which days before expiry you want to be notified</p>
            </div>
          </div>
        </div>

        <!-- Authentication -->
        <div v-if="isHttpType" class="section-card">
          <div class="flex items-center justify-between cursor-pointer" @click="showAuthSection = !showAuthSection">
            <h2 class="section-title !mb-0">Authentication</h2>
            <UIcon :name="showAuthSection ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-5 h-5 text-gray-400" />
          </div>
          
          <div v-show="showAuthSection" class="mt-4 grid gap-4 md:grid-cols-2">
            <div class="form-group md:col-span-2">
              <label class="input-label">Authentication Method</label>
              <select v-model="form.authMethod" class="select-field">
                <option value="">None</option>
                <option value="basic">HTTP Basic Auth</option>
                <option value="ntlm">NTLM</option>
              </select>
            </div>

            <template v-if="form.authMethod === 'basic' || form.authMethod === 'ntlm'">
              <div class="form-group">
                <label class="input-label">Username</label>
                <input v-model="form.basicAuthUser" type="text" class="input-field" />
              </div>
              <div class="form-group">
                <label class="input-label">Password</label>
                <input v-model="form.basicAuthPass" type="password" class="input-field" />
              </div>
            </template>
          </div>
        </div>

        <!-- DNS Settings -->
        <div v-if="form.type === 'dns'" class="section-card">
          <h2 class="section-title">DNS Settings</h2>
          
          <div class="grid gap-4 md:grid-cols-2">
            <div class="form-group">
              <label class="input-label">Record Type</label>
              <select v-model="form.dnsRecordType" class="select-field">
                <option value="A">A</option>
                <option value="AAAA">AAAA</option>
                <option value="CNAME">CNAME</option>
                <option value="MX">MX</option>
                <option value="NS">NS</option>
                <option value="TXT">TXT</option>
              </select>
            </div>
            <div class="form-group">
              <label class="input-label">DNS Server</label>
              <input v-model="form.dnsResolver" type="text" class="input-field" placeholder="1.1.1.1" />
            </div>
          </div>
        </div>

        <!-- Docker Settings -->
        <div v-if="form.type === 'docker'" class="section-card">
          <h2 class="section-title">Docker Settings</h2>
          
          <div class="grid gap-4 md:grid-cols-2">
            <div class="form-group">
              <label class="input-label">Docker Host</label>
              <select v-model="form.dockerHost" class="select-field">
                <option v-for="host in dockerHosts" :key="host.id" :value="host.id">
                  {{ host.name }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label class="input-label">Container Name/ID <span class="text-red-400">*</span></label>
              <input v-model="form.dockerContainer" type="text" class="input-field" placeholder="my-container" required />
            </div>
          </div>
        </div>

        <!-- Database Settings -->
        <div v-if="form.type === 'database'" class="section-card">
          <h2 class="section-title">Database Settings</h2>
          
          <div class="grid gap-4 md:grid-cols-2">
            <div class="form-group md:col-span-2">
              <label class="input-label">Database Type</label>
              <select v-model="form.databaseType" class="select-field">
                <option value="mysql">MySQL/MariaDB</option>
                <option value="postgres">PostgreSQL</option>
                <option value="mssql">Microsoft SQL Server</option>
                <option value="mongodb">MongoDB</option>
                <option value="redis">Redis</option>
              </select>
            </div>
            <div class="form-group md:col-span-2">
              <label class="input-label">Connection String</label>
              <input v-model="form.databaseConnectionString" type="text" class="input-field font-mono" :placeholder="dbConnectionPlaceholder" />
            </div>
            <div class="form-group md:col-span-2">
              <label class="input-label">Query (Optional)</label>
              <textarea v-model="form.databaseQuery" class="input-field font-mono text-sm" rows="3" placeholder="SELECT 1"></textarea>
            </div>
          </div>
        </div>

        <!-- Timing -->
        <div class="section-card">
          <h2 class="section-title">Timing</h2>
          
          <div class="grid gap-4 md:grid-cols-2">
            <div class="form-group">
              <label class="input-label">Check Interval (seconds)</label>
              <input v-model.number="form.interval" type="number" class="input-field" min="20" />
              <p class="text-xs text-gray-500 mt-1">Minimum: 20 seconds</p>
            </div>

            <div class="form-group">
              <label class="input-label">Timeout (seconds)</label>
              <input v-model.number="form.timeout" type="number" class="input-field" min="1" />
            </div>

            <div class="form-group">
              <label class="input-label">Retry Interval (seconds)</label>
              <input v-model.number="form.retryInterval" type="number" class="input-field" min="20" />
            </div>

            <div class="form-group">
              <label class="input-label">Max Retries</label>
              <input v-model.number="form.maxretries" type="number" class="input-field" min="0" />
              <p class="text-xs text-gray-500 mt-1">Number of retries before marking as DOWN</p>
            </div>
          </div>
        </div>

        <!-- Advanced Options -->
        <div class="section-card">
          <div class="flex items-center justify-between cursor-pointer" @click="showAdvanced = !showAdvanced">
            <h2 class="section-title !mb-0">Advanced Options</h2>
            <UIcon :name="showAdvanced ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'" class="w-5 h-5 text-gray-400" />
          </div>
          
          <div v-show="showAdvanced" class="mt-4">
            <div class="space-y-3 mb-4">
              <label class="flex items-center gap-2">
                <input type="checkbox" v-model="form.upsideDown" class="checkbox" />
                <span class="text-gray-300">Upside Down Mode (alert when UP)</span>
              </label>
              <label class="flex items-center gap-2">
                <input type="checkbox" v-model="form.active" class="checkbox" />
                <span class="text-gray-300">Active (start monitoring immediately)</span>
              </label>
            </div>

            <div class="form-group">
              <label class="input-label">Description</label>
              <textarea v-model="form.description" class="input-field" rows="3" placeholder="Optional description"></textarea>
            </div>

            <!-- Proxy -->
            <div v-if="proxies.length > 0" class="form-group mt-4">
              <label class="input-label">Proxy</label>
              <select v-model="form.proxyId" class="select-field">
                <option :value="null">No Proxy</option>
                <option v-for="proxy in proxies" :key="proxy.id" :value="proxy.id">
                  {{ proxy.name }} ({{ proxy.host }}:{{ proxy.port }})
                </option>
              </select>
            </div>

            <!-- Tags -->
            <div v-if="availableTags.length > 0" class="form-group mt-4">
              <label class="input-label mb-2">Tags</label>
              <div class="flex flex-wrap gap-2">
                <label 
                  v-for="tag in availableTags" 
                  :key="tag.id" 
                  class="flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-all"
                  :class="selectedTags.includes(tag.id) ? 'bg-gray-600' : 'bg-gray-700 hover:bg-gray-600'"
                >
                  <input type="checkbox" :value="tag.id" v-model="selectedTags" class="hidden" />
                  <span class="w-3 h-3 rounded" :style="{ backgroundColor: tag.color }"></span>
                  <span class="text-sm text-gray-300">{{ tag.name }}</span>
                </label>
              </div>
            </div>

            <!-- Notifications -->
            <div v-if="notifications.length > 0" class="form-group mt-4">
              <label class="input-label mb-2">Notifications</label>
              <div class="space-y-2">
                <label 
                  v-for="notif in notifications" 
                  :key="notif.id" 
                  class="flex items-center gap-2 p-2 rounded bg-gray-700 cursor-pointer hover:bg-gray-600"
                >
                  <input type="checkbox" :value="notif.id" v-model="selectedNotifications" class="checkbox" />
                  <span class="text-sm text-gray-300">{{ notif.name }}</span>
                  <span class="text-xs text-gray-500">({{ notif.type }})</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <!-- Error -->
        <div v-if="error" class="alert alert-danger">
          {{ error }}
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <NuxtLink to="/dashboard" class="btn btn-secondary">Cancel</NuxtLink>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading" class="spinner w-4 h-4 mr-2"></span>
            Create Monitor
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: ['auth']
})

const router = useRouter()
const loading = ref(false)
const error = ref('')
const showAuthSection = ref(false)
const showAdvanced = ref(false)
const showTlsSection = ref(false)

// HTTP Headers management
const httpHeaders = ref<{ key: string; value: string }[]>([])
const addHeader = () => httpHeaders.value.push({ key: '', value: '' })
const removeHeader = (index: number) => httpHeaders.value.splice(index, 1)

// TLS Certificate expiry notification days
const tlsExpiryDays = ref<number[]>([7, 14, 30])

// Available options from API
const dockerHosts = ref<any[]>([])
const proxies = ref<any[]>([])
const availableTags = ref<any[]>([])
const notifications = ref<any[]>([])

// Selected items
const selectedTags = ref<number[]>([])
const selectedNotifications = ref<number[]>([])

// Form data
const form = reactive({
  type: 'http',
  name: '',
  url: '',
  hostname: '',
  port: null as number | null,
  method: 'GET',
  maxRedirects: 10,
  keyword: '',
  jsonPath: '',
  expectedValue: '',
  body: '',
  invertKeyword: false,
  ignoreTls: false,
  expiryNotification: false,
  interval: 60,
  timeout: 48,
  retryInterval: 60,
  maxretries: 0,
  upsideDown: false,
  active: true,
  description: '',
  // Auth
  authMethod: '',
  basicAuthUser: '',
  basicAuthPass: '',
  // DNS
  dnsRecordType: 'A',
  dnsResolver: '',
  // Docker
  dockerHost: null as number | null,
  dockerContainer: '',
  // Database
  databaseType: 'mysql',
  databaseConnectionString: '',
  databaseQuery: '',
  // Proxy
  proxyId: null as number | null,
})

// Computed
const isHttpType = computed(() => ['http', 'keyword', 'json-query'].includes(form.type))
const showUrlField = computed(() => ['http', 'keyword', 'json-query', 'grpc-keyword'].includes(form.type))
const showHostnameField = computed(() => ['tcp', 'ping', 'dns'].includes(form.type))
const showPortField = computed(() => ['tcp'].includes(form.type))

const dbConnectionPlaceholder = computed(() => {
  switch (form.databaseType) {
    case 'mysql': return 'mysql://user:pass@localhost:3306/database'
    case 'postgres': return 'postgresql://user:pass@localhost:5432/database'
    case 'mssql': return 'Server=localhost;Database=mydb;User Id=sa;Password=pass;'
    case 'mongodb': return 'mongodb://user:pass@localhost:27017/database'
    case 'redis': return 'redis://user:pass@localhost:6379'
    default: return ''
  }
})

// Fetch available options
onMounted(async () => {
  try {
    const [tagsRes, notifsRes, proxiesRes, dockerRes] = await Promise.all([
      $fetch<any>('/api/v1/tags').catch(() => ({ data: [] })),
      $fetch<any>('/api/v1/notifications').catch(() => ({ data: [] })),
      $fetch<any>('/api/v1/proxies').catch(() => ({ data: [] })),
      $fetch<any>('/api/v1/docker-hosts').catch(() => ({ data: [] })),
    ])
    
    availableTags.value = tagsRes.data || []
    notifications.value = notifsRes.data || []
    proxies.value = proxiesRes.data || []
    dockerHosts.value = dockerRes.data || []
  } catch (e) {
    console.error('Failed to fetch options:', e)
  }
})

const handleCreate = async () => {
  loading.value = true
  error.value = ''

  try {
    // Build headers object
    const headers: Record<string, string> = {}
    httpHeaders.value.forEach(h => {
      if (h.key && h.value) {
        headers[h.key] = h.value
      }
    })

    const body = {
      ...form,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      tags: selectedTags.value,
      notifications: selectedNotifications.value,
      tlsExpiryDays: form.expiryNotification ? tlsExpiryDays.value : undefined,
    }

    await $fetch('/api/v1/monitors', {
      method: 'POST',
      body,
    })

    router.push('/dashboard')
  } catch (e: any) {
    error.value = e.data?.message || 'Failed to create monitor'
  } finally {
    loading.value = false
  }
}
</script>
