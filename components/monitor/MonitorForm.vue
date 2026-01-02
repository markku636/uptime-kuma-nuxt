<template>
  <form @submit.prevent="handleSubmit">
    <!-- Basic Info -->
    <div class="mb-4">
      <h4 class="section-title"><i class="bi bi-info-circle me-2"></i>Basic Information</h4>
      
      <div class="mb-3">
        <label class="form-label">Monitor Type <span class="text-danger">*</span></label>
        <select v-model="form.type" class="form-select" :disabled="loading">
          <option v-for="type in monitorTypes" :key="type.value" :value="type.value">
            {{ type.label }}
          </option>
        </select>
      </div>

      <div class="mb-3">
        <label class="form-label">Friendly Name <span class="text-danger">*</span></label>
        <input 
          v-model="form.name" 
          type="text" 
          class="form-control" 
          placeholder="My Monitor"
          :disabled="loading"
        />
      </div>

      <!-- URL for HTTP monitors -->
      <div v-if="showUrlField" class="mb-3">
        <label class="form-label">URL <span class="text-danger">*</span></label>
        <input 
          v-model="form.url" 
          type="text" 
          class="form-control" 
          placeholder="https://example.com"
          :disabled="loading"
        />
      </div>

      <!-- Hostname for TCP/Ping/DNS monitors -->
      <div v-if="showHostnameField" class="mb-3">
        <label class="form-label">Hostname <span class="text-danger">*</span></label>
        <input 
          v-model="form.hostname" 
          type="text" 
          class="form-control" 
          placeholder="example.com"
          :disabled="loading"
        />
      </div>

      <!-- Port for TCP/Game monitors -->
      <div v-if="showPortField" class="mb-3">
        <label class="form-label">Port <span class="text-danger">*</span></label>
        <input 
          v-model.number="form.port" 
          type="number" 
          class="form-control" 
          placeholder="443"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- HTTP Settings -->
    <div v-if="showHttpSettings" class="mb-4">
      <h4 class="section-title"><i class="bi bi-globe me-2"></i>HTTP Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">Method</label>
        <select v-model="form.method" class="form-select" :disabled="loading">
          <option v-for="method in httpMethods" :key="method.value" :value="method.value">
            {{ method.label }}
          </option>
        </select>
      </div>

      <div v-if="form.type === 'http' || form.type === 'keyword'" class="mb-3">
        <label class="form-label">Expected Keyword</label>
        <input 
          v-model="form.keyword" 
          type="text" 
          class="form-control" 
          placeholder="OK"
          :disabled="loading"
        />
      </div>

      <div class="mb-3 form-check">
        <input 
          v-model="form.invertKeyword" 
          type="checkbox" 
          class="form-check-input" 
          id="invertKeyword"
          :disabled="loading"
        />
        <label class="form-check-label" for="invertKeyword">Invert Keyword (alert if found)</label>
      </div>

      <div class="mb-3 form-check">
        <input 
          v-model="form.ignoreTls" 
          type="checkbox" 
          class="form-check-input" 
          id="ignoreTls"
          :disabled="loading"
        />
        <label class="form-check-label" for="ignoreTls">Ignore TLS/SSL Certificate</label>
      </div>
    </div>

    <!-- JSON Query Settings -->
    <div v-if="form.type === 'json-query'" class="mb-4">
      <h4 class="section-title"><i class="bi bi-braces me-2"></i>JSON Query Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">JSON Path <span class="text-danger">*</span></label>
        <input 
          v-model="form.jsonPath" 
          type="text" 
          class="form-control" 
          placeholder="$.data.status"
          :disabled="loading"
        />
        <div class="form-text">Use JSONPath syntax (e.g., $.data.status)</div>
      </div>

      <div class="mb-3">
        <label class="form-label">Expected Value</label>
        <input 
          v-model="form.expectedValue" 
          type="text" 
          class="form-control" 
          placeholder="ok"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- gRPC Settings -->
    <div v-if="form.type === 'grpc-keyword'" class="mb-4">
      <h4 class="section-title"><i class="bi bi-hdd-network me-2"></i>gRPC Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">gRPC URL <span class="text-danger">*</span></label>
        <input 
          v-model="form.grpcUrl" 
          type="text" 
          class="form-control" 
          placeholder="localhost:50051"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Service Name <span class="text-danger">*</span></label>
        <input 
          v-model="form.grpcServiceName" 
          type="text" 
          class="form-control" 
          placeholder="mypackage.MyService"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Method <span class="text-danger">*</span></label>
        <input 
          v-model="form.grpcMethod" 
          type="text" 
          class="form-control" 
          placeholder="HealthCheck"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Proto Definition</label>
        <textarea 
          v-model="form.grpcProtoContent" 
          class="form-control" 
          rows="6" 
          placeholder="Paste your .proto file content here"
          :disabled="loading"
        ></textarea>
      </div>

      <div class="mb-3">
        <label class="form-label">Request Body (JSON)</label>
        <textarea 
          v-model="form.grpcBody" 
          class="form-control" 
          rows="3" 
          placeholder='{"key": "value"}'
          :disabled="loading"
        ></textarea>
      </div>

      <div class="mb-3 form-check">
        <input 
          v-model="form.grpcEnableTls" 
          type="checkbox" 
          class="form-check-input" 
          id="grpcEnableTls"
          :disabled="loading"
        />
        <label class="form-check-label" for="grpcEnableTls">Enable TLS</label>
      </div>
    </div>

    <!-- Database Settings -->
    <div v-if="showDatabaseSettings" class="mb-4">
      <h4 class="section-title"><i class="bi bi-database me-2"></i>Database Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">Connection String <span class="text-danger">*</span></label>
        <input 
          v-model="form.databaseConnectionString" 
          type="text" 
          class="form-control" 
          :placeholder="databasePlaceholder"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Query (optional)</label>
        <textarea 
          v-model="form.databaseQuery" 
          class="form-control" 
          rows="3" 
          placeholder="SELECT 1"
          :disabled="loading"
        ></textarea>
        <div class="form-text">Optional query to execute for health check</div>
      </div>
    </div>

    <!-- Docker Settings -->
    <div v-if="form.type === 'docker'" class="mb-4">
      <h4 class="section-title"><i class="bi bi-boxes me-2"></i>Docker Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">Container Name/ID <span class="text-danger">*</span></label>
        <input 
          v-model="form.dockerContainer" 
          type="text" 
          class="form-control" 
          placeholder="my-container"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Docker Host</label>
        <input 
          v-model="form.dockerHost" 
          type="text" 
          class="form-control" 
          placeholder="/var/run/docker.sock"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Connection Type</label>
        <select v-model="form.dockerDaemon" class="form-select" :disabled="loading">
          <option value="socket">Socket</option>
          <option value="tcp">TCP</option>
          <option value="tls">TCP + TLS</option>
        </select>
      </div>
    </div>

    <!-- MQTT Settings -->
    <div v-if="form.type === 'mqtt'" class="mb-4">
      <h4 class="section-title"><i class="bi bi-wifi me-2"></i>MQTT Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">Topic</label>
        <input 
          v-model="form.mqttTopic" 
          type="text" 
          class="form-control" 
          placeholder="my/topic"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Username</label>
        <input 
          v-model="form.mqttUsername" 
          type="text" 
          class="form-control"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Password</label>
        <input 
          v-model="form.mqttPassword" 
          type="password" 
          class="form-control"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">Success Message</label>
        <input 
          v-model="form.mqttSuccessMessage" 
          type="text" 
          class="form-control" 
          placeholder="Expected message content"
          :disabled="loading"
        />
      </div>
    </div>

    <!-- Kafka Settings -->
    <div v-if="form.type === 'kafka'" class="mb-4">
      <h4 class="section-title"><i class="bi bi-diagram-3 me-2"></i>Kafka Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">Topic</label>
        <input 
          v-model="form.kafkaTopic" 
          type="text" 
          class="form-control" 
          placeholder="my-topic"
          :disabled="loading"
        />
      </div>

      <div class="mb-3">
        <label class="form-label">SASL Mechanism</label>
        <select v-model="form.kafkaSaslMechanism" class="form-select" :disabled="loading">
          <option value="">None</option>
          <option value="plain">PLAIN</option>
          <option value="scram-sha-256">SCRAM-SHA-256</option>
          <option value="scram-sha-512">SCRAM-SHA-512</option>
        </select>
      </div>

      <div v-if="form.kafkaSaslMechanism" class="row">
        <div class="col-6">
          <div class="mb-3">
            <label class="form-label">Username</label>
            <input v-model="form.kafkaUsername" type="text" class="form-control" :disabled="loading" />
          </div>
        </div>
        <div class="col-6">
          <div class="mb-3">
            <label class="form-label">Password</label>
            <input v-model="form.kafkaPassword" type="password" class="form-control" :disabled="loading" />
          </div>
        </div>
      </div>
    </div>

    <!-- Game Server Settings -->
    <div v-if="form.type === 'gamedig'" class="mb-4">
      <h4 class="section-title"><i class="bi bi-controller me-2"></i>Game Server Settings</h4>
      
      <div class="mb-3">
        <label class="form-label">Game <span class="text-danger">*</span></label>
        <select v-model="form.game" class="form-select" :disabled="loading">
          <option v-for="game in gameTypes" :key="game.value" :value="game.value">
            {{ game.label }}
          </option>
        </select>
      </div>
    </div>

    <!-- Timing -->
    <div class="mb-4">
      <h4 class="section-title"><i class="bi bi-clock me-2"></i>Timing</h4>
      
      <div class="row">
        <div class="col-md-6">
          <div class="mb-3">
            <label class="form-label">Check Interval (seconds)</label>
            <input 
              v-model.number="form.interval" 
              type="number" 
              class="form-control"
              :disabled="loading"
            />
          </div>
        </div>
        <div class="col-md-6">
          <div class="mb-3">
            <label class="form-label">Timeout (seconds)</label>
            <input 
              v-model.number="form.timeout" 
              type="number" 
              class="form-control"
              :disabled="loading"
            />
          </div>
        </div>
      </div>

      <div class="row">
        <div class="col-md-6">
          <div class="mb-3">
            <label class="form-label">Retry Interval (seconds)</label>
            <input 
              v-model.number="form.retryInterval" 
              type="number" 
              class="form-control"
              :disabled="loading"
            />
          </div>
        </div>
        <div class="col-md-6">
          <div class="mb-3">
            <label class="form-label">Max Retries</label>
            <input 
              v-model.number="form.maxretries" 
              type="number" 
              class="form-control"
              :disabled="loading"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Advanced Options -->
    <div class="mb-4">
      <h4 class="section-title"><i class="bi bi-gear me-2"></i>Advanced Options</h4>
      
      <div class="mb-3 form-check">
        <input 
          v-model="form.upsideDown" 
          type="checkbox" 
          class="form-check-input" 
          id="upsideDown"
          :disabled="loading"
        />
        <label class="form-check-label" for="upsideDown">Upside Down Mode (alert when UP)</label>
      </div>
    </div>

    <!-- Description -->
    <div class="mb-4">
      <label class="form-label">Description</label>
      <textarea 
        v-model="form.description" 
        class="form-control" 
        rows="3" 
        placeholder="Optional description"
        :disabled="loading"
      ></textarea>
    </div>

    <!-- Submit -->
    <div class="d-flex justify-content-end gap-2">
      <button 
        type="button" 
        class="btn btn-outline-secondary"
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
        <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>
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
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--bs-border-color);
  color: var(--bs-heading-color);
}

.form-label {
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.form-control,
.form-select {
  border-radius: 0.375rem;
}

.form-control:focus,
.form-select:focus {
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.25);
}

.form-text {
  font-size: 0.875rem;
  color: var(--bs-secondary);
}
</style>
