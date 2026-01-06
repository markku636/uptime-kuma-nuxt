<template>
  <form @submit.prevent="handleSubmit" class="space-y-6">
    <!-- Basic Info -->
    <div class="section-card">
      <h2 class="section-title">Basic Information</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">Monitor Type <span class="text-red-400">*</span></label>
          <select v-model="form.type" class="select-field" :disabled="loading">
            <option v-for="type in monitorTypes" :key="type.value" :value="type.value">
              {{ type.label }}
            </option>
          </select>
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">Friendly Name <span class="text-red-400">*</span></label>
          <input 
            v-model="form.name" 
            type="text" 
            class="input-field" 
            placeholder="My Monitor"
            :disabled="loading"
          />
        </div>

        <!-- URL for HTTP monitors -->
        <div v-if="showUrlField" class="form-group md:col-span-2">
          <label class="input-label">URL <span class="text-red-400">*</span></label>
          <input 
            v-model="form.url" 
            type="text" 
            class="input-field" 
            placeholder="https://example.com"
            :disabled="loading"
          />
        </div>

        <!-- Hostname for TCP/Ping/DNS monitors -->
        <div v-if="showHostnameField" class="form-group" :class="showPortField ? '' : 'md:col-span-2'">
          <label class="input-label">Hostname <span class="text-red-400">*</span></label>
          <input 
            v-model="form.hostname" 
            type="text" 
            class="input-field" 
            placeholder="example.com"
            :disabled="loading"
          />
        </div>

        <!-- Port for TCP/Game monitors -->
        <div v-if="showPortField" class="form-group">
          <label class="input-label">Port <span class="text-red-400">*</span></label>
          <input 
            v-model.number="form.port" 
            type="number" 
            class="input-field" 
            placeholder="443"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- HTTP Settings -->
    <div v-if="showHttpSettings" class="section-card">
      <h2 class="section-title">HTTP Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group">
          <label class="input-label">Method</label>
          <select v-model="form.method" class="select-field" :disabled="loading">
            <option v-for="method in httpMethods" :key="method.value" :value="method.value">
              {{ method.label }}
            </option>
          </select>
        </div>

        <div v-if="form.type === 'http' || form.type === 'keyword'" class="form-group">
          <label class="input-label">Expected Keyword</label>
          <input 
            v-model="form.keyword" 
            type="text" 
            class="input-field" 
            placeholder="OK"
            :disabled="loading"
          />
        </div>
      </div>

      <div class="mt-4 space-y-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            v-model="form.invertKeyword" 
            type="checkbox" 
            class="checkbox"
            :disabled="loading"
          />
          <span class="text-gray-300">Invert Keyword (alert if found)</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            v-model="form.ignoreTls" 
            type="checkbox" 
            class="checkbox"
            :disabled="loading"
          />
          <span class="text-gray-300">Ignore TLS/SSL Certificate</span>
        </label>
      </div>
    </div>

    <!-- JSON Query Settings -->
    <div v-if="form.type === 'json-query'" class="section-card">
      <h2 class="section-title">JSON Query Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">JSON Path <span class="text-red-400">*</span></label>
          <input 
            v-model="form.jsonPath" 
            type="text" 
            class="input-field" 
            placeholder="$.data.status"
            :disabled="loading"
          />
          <p class="text-xs text-gray-500 mt-1">Use JSONPath syntax (e.g., $.data.status)</p>
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">Expected Value</label>
          <input 
            v-model="form.expectedValue" 
            type="text" 
            class="input-field" 
            placeholder="ok"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- gRPC Settings -->
    <div v-if="form.type === 'grpc-keyword'" class="section-card">
      <h2 class="section-title">gRPC Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">gRPC URL <span class="text-red-400">*</span></label>
          <input 
            v-model="form.grpcUrl" 
            type="text" 
            class="input-field" 
            placeholder="localhost:50051"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Service Name <span class="text-red-400">*</span></label>
          <input 
            v-model="form.grpcServiceName" 
            type="text" 
            class="input-field" 
            placeholder="mypackage.MyService"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Method <span class="text-red-400">*</span></label>
          <input 
            v-model="form.grpcMethod" 
            type="text" 
            class="input-field" 
            placeholder="HealthCheck"
            :disabled="loading"
          />
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">Proto Definition</label>
          <textarea 
            v-model="form.grpcProtoContent" 
            class="input-field" 
            rows="6" 
            placeholder="Paste your .proto file content here"
            :disabled="loading"
          ></textarea>
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">Request Body (JSON)</label>
          <textarea 
            v-model="form.grpcBody" 
            class="input-field" 
            rows="3" 
            placeholder='{"key": "value"}'
            :disabled="loading"
          ></textarea>
        </div>
      </div>

      <div class="mt-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            v-model="form.grpcEnableTls" 
            type="checkbox" 
            class="checkbox"
            :disabled="loading"
          />
          <span class="text-gray-300">Enable TLS</span>
        </label>
      </div>
    </div>

    <!-- Database Settings -->
    <div v-if="showDatabaseSettings" class="section-card">
      <h2 class="section-title">Database Settings</h2>
      
      <div class="grid gap-4">
        <div class="form-group">
          <label class="input-label">Connection String <span class="text-red-400">*</span></label>
          <input 
            v-model="form.databaseConnectionString" 
            type="text" 
            class="input-field" 
            :placeholder="databasePlaceholder"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Query (optional)</label>
          <textarea 
            v-model="form.databaseQuery" 
            class="input-field" 
            rows="3" 
            placeholder="SELECT 1"
            :disabled="loading"
          ></textarea>
          <p class="text-xs text-gray-500 mt-1">Optional query to execute for health check</p>
        </div>
      </div>
    </div>

    <!-- Docker Settings -->
    <div v-if="form.type === 'docker'" class="section-card">
      <h2 class="section-title">Docker Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">Container Name/ID <span class="text-red-400">*</span></label>
          <input 
            v-model="form.dockerContainer" 
            type="text" 
            class="input-field" 
            placeholder="my-container"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Docker Host</label>
          <input 
            v-model="form.dockerHost" 
            type="text" 
            class="input-field" 
            placeholder="/var/run/docker.sock"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Connection Type</label>
          <select v-model="form.dockerDaemon" class="select-field" :disabled="loading">
            <option value="socket">Socket</option>
            <option value="tcp">TCP</option>
            <option value="tls">TCP + TLS</option>
          </select>
        </div>
      </div>
    </div>

    <!-- MQTT Settings -->
    <div v-if="form.type === 'mqtt'" class="section-card">
      <h2 class="section-title">MQTT Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">Topic</label>
          <input 
            v-model="form.mqttTopic" 
            type="text" 
            class="input-field" 
            placeholder="my/topic"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Username</label>
          <input 
            v-model="form.mqttUsername" 
            type="text" 
            class="input-field"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Password</label>
          <input 
            v-model="form.mqttPassword" 
            type="password" 
            class="input-field"
            :disabled="loading"
          />
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">Success Message</label>
          <input 
            v-model="form.mqttSuccessMessage" 
            type="text" 
            class="input-field" 
            placeholder="Expected message content"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- Kafka Settings -->
    <div v-if="form.type === 'kafka'" class="section-card">
      <h2 class="section-title">Kafka Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">Topic</label>
          <input 
            v-model="form.kafkaTopic" 
            type="text" 
            class="input-field" 
            placeholder="my-topic"
            :disabled="loading"
          />
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">SASL Mechanism</label>
          <select v-model="form.kafkaSaslMechanism" class="select-field" :disabled="loading">
            <option value="">None</option>
            <option value="plain">PLAIN</option>
            <option value="scram-sha-256">SCRAM-SHA-256</option>
            <option value="scram-sha-512">SCRAM-SHA-512</option>
          </select>
        </div>

        <template v-if="form.kafkaSaslMechanism">
          <div class="form-group">
            <label class="input-label">Username</label>
            <input v-model="form.kafkaUsername" type="text" class="input-field" :disabled="loading" />
          </div>
          <div class="form-group">
            <label class="input-label">Password</label>
            <input v-model="form.kafkaPassword" type="password" class="input-field" :disabled="loading" />
          </div>
        </template>
      </div>
    </div>

    <!-- Game Server Settings -->
    <div v-if="form.type === 'gamedig'" class="section-card">
      <h2 class="section-title">Game Server Settings</h2>
      
      <div class="form-group">
        <label class="input-label">Game <span class="text-red-400">*</span></label>
        <select v-model="form.game" class="select-field" :disabled="loading">
          <option v-for="game in gameTypes" :key="game.value" :value="game.value">
            {{ game.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Timing -->
    <div class="section-card">
      <h2 class="section-title">Timing</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group">
          <label class="input-label">Check Interval (seconds)</label>
          <input 
            v-model.number="form.interval" 
            type="number" 
            class="input-field"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Timeout (seconds)</label>
          <input 
            v-model.number="form.timeout" 
            type="number" 
            class="input-field"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Retry Interval (seconds)</label>
          <input 
            v-model.number="form.retryInterval" 
            type="number" 
            class="input-field"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Max Retries</label>
          <input 
            v-model.number="form.maxretries" 
            type="number" 
            class="input-field"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- Advanced Options -->
    <div class="section-card">
      <h2 class="section-title">Advanced Options</h2>
      
      <label class="flex items-center gap-2 cursor-pointer">
        <input 
          v-model="form.upsideDown" 
          type="checkbox" 
          class="checkbox"
          :disabled="loading"
        />
        <span class="text-gray-300">Upside Down Mode (alert when UP)</span>
      </label>
    </div>

    <!-- Description -->
    <div class="section-card">
      <h2 class="section-title">Description</h2>
      <textarea 
        v-model="form.description" 
        class="input-field" 
        rows="3" 
        placeholder="Optional description"
        :disabled="loading"
      ></textarea>
    </div>

    <!-- Submit -->
    <div class="flex justify-end gap-3">
      <button 
        type="button" 
        class="btn btn-outline"
        @click="navigateTo('/monitors')"
        :disabled="loading"
      >
        Cancel
      </button>
      <button 
        type="submit" 
        class="btn btn-primary"
        :disabled="loading"
      >
        <UIcon v-if="loading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mr-2" />
        {{ submitLabel }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
interface Props {
  initialData?: any
  loading?: boolean
  submitLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  submitLabel: 'Create Monitor'
})

const emit = defineEmits(['submit'])

const form = reactive({
  type: props.initialData?.type || 'http',
  name: props.initialData?.name || '',
  url: props.initialData?.url || '',
  hostname: props.initialData?.hostname || '',
  port: props.initialData?.port || 443,
  method: props.initialData?.method || 'GET',
  keyword: props.initialData?.keyword || '',
  invertKeyword: props.initialData?.invertKeyword || false,
  ignoreTls: props.initialData?.ignoreTls || false,
  upsideDown: props.initialData?.upsideDown || false,
  interval: props.initialData?.interval || 60,
  timeout: props.initialData?.timeout || 48,
  retryInterval: props.initialData?.retryInterval || 60,
  maxretries: props.initialData?.maxretries || 0,
  description: props.initialData?.description || '',
  // JSON Query
  jsonPath: props.initialData?.jsonPath || '',
  expectedValue: props.initialData?.expectedValue || '',
  // gRPC
  grpcUrl: props.initialData?.grpcUrl || '',
  grpcServiceName: props.initialData?.grpcServiceName || '',
  grpcMethod: props.initialData?.grpcMethod || '',
  grpcProtoContent: props.initialData?.grpcProtoContent || '',
  grpcBody: props.initialData?.grpcBody || '',
  grpcEnableTls: props.initialData?.grpcEnableTls || false,
  // Database
  databaseConnectionString: props.initialData?.databaseConnectionString || '',
  databaseQuery: props.initialData?.databaseQuery || '',
  // Docker
  dockerContainer: props.initialData?.dockerContainer || '',
  dockerHost: props.initialData?.dockerHost || '/var/run/docker.sock',
  dockerDaemon: props.initialData?.dockerDaemon || 'socket',
  // MQTT
  mqttTopic: props.initialData?.mqttTopic || '',
  mqttUsername: props.initialData?.mqttUsername || '',
  mqttPassword: props.initialData?.mqttPassword || '',
  mqttSuccessMessage: props.initialData?.mqttSuccessMessage || '',
  // Kafka
  kafkaTopic: props.initialData?.kafkaTopic || '',
  kafkaSaslMechanism: props.initialData?.kafkaSaslMechanism || '',
  kafkaUsername: props.initialData?.kafkaUsername || '',
  kafkaPassword: props.initialData?.kafkaPassword || '',
  // Game
  game: props.initialData?.game || '',
})

const monitorTypes = [
  { value: 'http', label: 'HTTP(s)' },
  { value: 'keyword', label: 'HTTP(s) - Keyword' },
  { value: 'json-query', label: 'HTTP(s) - JSON Query' },
  { value: 'grpc-keyword', label: 'gRPC(s) - Keyword' },
  { value: 'tcp', label: 'TCP Port' },
  { value: 'ping', label: 'Ping' },
  { value: 'dns', label: 'DNS' },
  { value: 'push', label: 'Push' },
  { value: 'docker', label: 'Docker Container' },
  { value: 'mongodb', label: 'MongoDB' },
  { value: 'mysql', label: 'MySQL/MariaDB' },
  { value: 'postgres', label: 'PostgreSQL' },
  { value: 'sqlserver', label: 'SQL Server' },
  { value: 'redis', label: 'Redis' },
  { value: 'mqtt', label: 'MQTT' },
  { value: 'kafka', label: 'Kafka Producer' },
  { value: 'rabbitmq', label: 'RabbitMQ' },
  { value: 'steam', label: 'Steam Game Server' },
  { value: 'gamedig', label: 'Game Server (GameDig)' },
  { value: 'radius', label: 'Radius' },
  { value: 'tailscale-ping', label: 'Tailscale Ping' },
]

const httpMethods = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'HEAD', label: 'HEAD' },
  { value: 'OPTIONS', label: 'OPTIONS' },
]

const gameTypes = [
  { value: 'minecraft', label: 'Minecraft' },
  { value: 'csgo', label: 'CS:GO / CS2' },
  { value: 'tf2', label: 'Team Fortress 2' },
  { value: 'arkse', label: 'ARK: Survival Evolved' },
  { value: 'rust', label: 'Rust' },
  { value: 'valheim', label: 'Valheim' },
  { value: 'terraria', label: 'Terraria' },
  { value: 'garrysmod', label: "Garry's Mod" },
  { value: 'dayz', label: 'DayZ' },
  { value: '7d2d', label: '7 Days to Die' },
]

// Computed properties for conditional fields
const showUrlField = computed(() => 
  ['http', 'keyword', 'json-query'].includes(form.type)
)

const showHostnameField = computed(() => 
  ['tcp', 'ping', 'dns', 'mqtt', 'kafka', 'rabbitmq', 'steam', 'gamedig', 'radius', 'tailscale-ping'].includes(form.type)
)

const showPortField = computed(() => 
  ['tcp', 'mqtt', 'kafka', 'rabbitmq', 'steam', 'gamedig', 'radius'].includes(form.type)
)

const showHttpSettings = computed(() => 
  ['http', 'keyword', 'json-query'].includes(form.type)
)

const showDatabaseSettings = computed(() => 
  ['mongodb', 'mysql', 'postgres', 'sqlserver', 'redis'].includes(form.type)
)

const databasePlaceholder = computed(() => {
  switch (form.type) {
    case 'mongodb': return 'mongodb://user:pass@localhost:27017/db'
    case 'mysql': return 'mysql://user:pass@localhost:3306/db'
    case 'postgres': return 'postgresql://user:pass@localhost:5432/db'
    case 'sqlserver': return 'Server=localhost;Database=db;User Id=user;Password=pass;'
    case 'redis': return 'redis://user:pass@localhost:6379'
    default: return ''
  }
})

const handleSubmit = () => {
  const data: any = {
    type: form.type,
    name: form.name,
    interval: form.interval,
    timeout: form.timeout,
    retryInterval: form.retryInterval,
    maxretries: form.maxretries,
    description: form.description || undefined,
    upsideDown: form.upsideDown,
  }

  // HTTP-based monitors
  if (showUrlField.value) {
    data.url = form.url
    data.method = form.method
    data.keyword = form.keyword || undefined
    data.invertKeyword = form.invertKeyword
    data.ignoreTls = form.ignoreTls
  }

  // JSON Query specific
  if (form.type === 'json-query') {
    data.jsonPath = form.jsonPath
    data.expectedValue = form.expectedValue || undefined
  }

  // gRPC specific
  if (form.type === 'grpc-keyword') {
    data.grpcUrl = form.grpcUrl
    data.grpcServiceName = form.grpcServiceName
    data.grpcMethod = form.grpcMethod
    data.grpcProtoContent = form.grpcProtoContent || undefined
    data.grpcBody = form.grpcBody || undefined
    data.grpcEnableTls = form.grpcEnableTls
    data.keyword = form.keyword || undefined
    data.invertKeyword = form.invertKeyword
  }

  // Hostname-based monitors
  if (showHostnameField.value) {
    data.hostname = form.hostname
  }

  // Port-based monitors
  if (showPortField.value) {
    data.port = form.port
  }

  // Database monitors
  if (showDatabaseSettings.value) {
    data.databaseConnectionString = form.databaseConnectionString
    data.databaseQuery = form.databaseQuery || undefined
  }

  // Docker specific
  if (form.type === 'docker') {
    data.dockerContainer = form.dockerContainer
    data.dockerHost = form.dockerHost
    data.dockerDaemon = form.dockerDaemon
  }

  // MQTT specific
  if (form.type === 'mqtt') {
    data.mqttTopic = form.mqttTopic || undefined
    data.mqttUsername = form.mqttUsername || undefined
    data.mqttPassword = form.mqttPassword || undefined
    data.mqttSuccessMessage = form.mqttSuccessMessage || undefined
  }

  // Kafka specific
  if (form.type === 'kafka') {
    data.kafkaTopic = form.kafkaTopic || undefined
    data.kafkaSaslMechanism = form.kafkaSaslMechanism || undefined
    data.kafkaUsername = form.kafkaUsername || undefined
    data.kafkaPassword = form.kafkaPassword || undefined
  }

  // Game server specific
  if (form.type === 'gamedig') {
    data.game = form.game
  }

  emit('submit', data)
}
</script>

<style scoped>
.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: rgb(243 244 246);
}

.form-group {
  margin-bottom: 0;
}

.input-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: rgb(209 213 219);
  font-size: 0.875rem;
}

.checkbox {
  width: 1rem;
  height: 1rem;
  background-color: rgb(31 41 55);
  border: 1px solid rgb(75 85 99);
  border-radius: 0.25rem;
  cursor: pointer;
}

.checkbox:checked {
  background-color: rgb(16 185 129);
  border-color: rgb(16 185 129);
}

.checkbox:focus {
  outline: none;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.3);
}
</style>
