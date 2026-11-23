<template>
  <form @submit.prevent="handleSubmit()" class="space-y-6">
    <p v-if="currentWorkspace?.role === 'viewer'" role="status" class="text-muted">This workspace is read-only.</p>
    <div v-if="initialData?.id" class="section-card space-y-2">
      <p>Request values are write-only. Leave blank fields to keep their current values; enter a complete replacement to update them.</p>
      <label v-for="key in configuredFields" :key="key" class="block text-sm"><input v-model="clearSecrets" type="checkbox" :value="key" class="mr-2"> Clear configured {{ key }}</label>
    </div>
    <!-- Basic Info -->
    <div class="section-card">
      <h2 class="section-title">Basic Information</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">Monitor Type <span class="text-red-400">*</span></label>
          <select v-model="form.type" class="select-field" :disabled="loading">
            <option v-for="type in monitorTypes" :key="type.value" :value="type.value">
              {{ type.label }}{{ ['http','keyword','json-query','push'].includes(type.value) ? '' : ' (unsupported)' }}
            </option>
          </select>
          <p v-if="!['http','keyword','json-query','push'].includes(form.type)" role="status" class="text-sm mt-2">This checker is stored for compatibility but is not scheduled by the bounded PostgreSQL worker yet. HTTP, keyword and JSON query checks are supported.</p>
          <p v-if="form.type === 'push'" role="status" class="text-sm mt-2">A missed-heartbeat alert is raised after twice the check interval (at least 60 seconds) without a push.</p>
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
            placeholder="https://example.com or {{baseUrl}}/health"
            :disabled="loading"
          />
          <p class="text-xs text-gray-400 mt-1">
            Supports <code>&#123;&#123;variable&#125;&#125;</code> placeholders resolved from the workspace environment variables in Settings → Workspaces.
          </p>
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

    <!-- Bruno declarative request -->
    <div v-if="form.type === 'bruno'" class="section-card space-y-3">
      <h2 class="section-title">Bruno request</h2>
      <p class="text-sm text-secondary">Paste a single declarative <code>.bru</code> request. Scripts, tests and post-response variables are ignored. Variables use this environment's variables/secrets.</p>
      <textarea
        v-model="form.body"
        class="input-field font-mono text-xs"
        rows="14"
        maxlength="131072"
        spellcheck="false"
        placeholder="meta {&#10;  name: Example&#10;}&#10;get {&#10;  url: https://example.com/health&#10;}&#10;assert {&#10;  res.status: eq 200&#10;}"
      />
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
          <span class="text-gray-700 dark:text-gray-300">Invert Keyword (alert if found)</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            v-model="form.ignoreTls" 
            type="checkbox" 
            class="checkbox"
            :disabled="loading"
          />
          <span class="text-gray-700 dark:text-gray-300">Ignore TLS/SSL Certificate</span>
        </label>

        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            v-model="form.cacheBust" 
            type="checkbox" 
            class="checkbox"
            :disabled="loading"
          />
          <span class="text-gray-700 dark:text-gray-300">Cache Bust (add random query string)</span>
        </label>
      </div>

      <!-- Remote Browser (for Keyword monitoring) -->
      <div v-if="form.type === 'keyword'" class="mt-4">
        <label class="flex items-center gap-2 cursor-pointer mb-2">
          <input 
            v-model="form.useRemoteBrowser" 
            type="checkbox" 
            class="checkbox"
            :disabled="loading"
          />
          <span class="text-gray-700 dark:text-gray-300">Use Remote Browser</span>
        </label>
        <p class="text-xs text-gray-400 mb-2">Use a Chromium-based browser to render JavaScript content before checking for keyword</p>
        <p class="text-xs text-amber-500 mb-2">Compatibility field: this deployment stores the selection but the bounded keyword checker does not execute remote browsers.</p>
        
        <div v-if="form.useRemoteBrowser" class="mt-2">
          <label class="input-label">Remote Browser</label>
          <select v-model="form.remoteBrowser" class="select-field" :disabled="loading">
            <option :value="null">Auto Select</option>
            <option v-for="browser in remoteBrowsers" :key="browser.id" :value="browser.id">
              {{ browser.name }}
            </option>
          </select>
          <p class="text-xs text-gray-400 mt-1">
            <NuxtLink to="/settings/remote-browsers" class="text-green-400 hover:underline">Manage Remote Browsers</NuxtLink>
          </p>
        </div>
      </div>

      <!-- Proxy Selection -->
      <div class="mt-4">
        <label class="input-label">Proxy</label>
        <select v-model="form.proxyId" class="select-field" :disabled="loading">
          <option :value="null">Direct connection</option>
          <option v-if="form.proxyId" :value="form.proxyId" disabled>Previously configured proxy (unsupported)</option>
        </select>
        <p class="text-xs text-gray-400 mt-1">HTTP proxy transport is unavailable in this checker. Clear any previous proxy before saving.</p>
      </div>

      <!-- Accepted Status Codes -->
      <div class="mt-4">
        <label class="input-label">Accepted Status Codes</label>
        <input 
          v-model="form.acceptedStatuscodes" 
          type="text" 
          class="input-field" 
          placeholder="200-299"
          :disabled="loading"
        />
        <p class="text-xs text-gray-400 mt-1">Select status codes which are considered as a successful response. Use comma to separate multiple codes (e.g., 200-299, 301, 302)</p>
      </div>

      <!-- Max Redirects -->
      <div class="mt-4">
        <label class="input-label">Max Redirects</label>
        <input 
          v-model.number="form.maxRedirects" 
          type="number" 
          class="input-field w-32" 
          min="0"
          max="10"
          :disabled="loading"
        />
        <p class="text-xs text-gray-400 mt-1">Maximum number of redirects to follow (0–10). Set to 0 to disable.</p>
      </div>

      <!-- HTTP Headers -->
      <div class="mt-4">
        <label class="input-label">HTTP Headers</label>
        <div class="space-y-2">
          <div 
            v-for="(header, index) in form.headers" 
            :key="index" 
            class="flex gap-2"
          >
            <input 
              v-model="header.key" 
              type="text" 
              class="input-field flex-1" 
              placeholder="Header Name"
              :disabled="loading"
            />
            <input 
              v-model="header.value" 
              type="text" 
              class="input-field flex-1" 
              placeholder="Header Value"
              :disabled="loading"
            />
            <button 
              type="button" 
              class="btn btn-outline text-red-400 hover:bg-red-500/20"
              @click="removeHeader(index)"
              :disabled="loading"
            >
              <UIcon name="i-heroicons-trash" class="w-4 h-4" />
            </button>
          </div>
        </div>
        <button 
          type="button" 
          class="btn btn-outline text-sm mt-2"
          @click="addHeader"
          :disabled="loading"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
          Add Header
        </button>
      </div>

      <!-- Request Body (for POST/PUT/PATCH) -->
      <div v-if="['POST', 'PUT', 'PATCH'].includes(form.method)" class="mt-4">
        <label class="input-label">Request Body</label>
        <textarea 
          v-model="form.body" 
          class="input-field" 
          rows="4" 
          placeholder='{"key": "value"}'
          :disabled="loading"
        ></textarea>
        <p class="text-xs text-gray-400 mt-1">JSON format for the request body</p>
      </div>

      <!-- Authentication Method -->
      <div class="mt-4">
        <label class="input-label">Authentication Method</label>
        <select v-model="form.authMethod" class="select-field" :disabled="loading">
          <option value="">None</option>
          <option value="basic">HTTP Basic Auth</option>
          <option v-if="['ntlm','mtls'].includes(form.authMethod)" :value="form.authMethod" disabled>Previously configured authentication (unsupported)</option>
          <option value="oauth2-cc">OAuth2: Client Credentials</option>
        </select>
      </div>

      <!-- Basic Auth / NTLM -->
      <div v-if="form.authMethod === 'basic' || form.authMethod === 'ntlm'" class="mt-4 grid gap-4 md:grid-cols-2">
        <div class="form-group">
          <label class="input-label">Username</label>
          <input 
            v-model="form.basicAuthUser" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Password</label>
          <input 
            v-model="form.basicAuthPass" 
            type="password" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
        <div v-if="form.authMethod === 'ntlm'" class="form-group">
          <label class="input-label">Domain</label>
          <input 
            v-model="form.authDomain" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
        <div v-if="form.authMethod === 'ntlm'" class="form-group">
          <label class="input-label">Workstation</label>
          <input 
            v-model="form.authWorkstation" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
      </div>

      <!-- OAuth2 Client Credentials -->
      <div v-if="form.authMethod === 'oauth2-cc'" class="mt-4 grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">Token URL <span class="text-red-400">*</span></label>
          <input 
            v-model="form.oauthTokenUrl" 
            type="text" 
            class="input-field" 
            placeholder="https://auth.example.com/oauth/token"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Client ID <span class="text-red-400">*</span></label>
          <input 
            v-model="form.oauthClientId" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Client Secret <span class="text-red-400">*</span></label>
          <input 
            v-model="form.oauthClientSecret" 
            type="password" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Scopes</label>
          <input 
            v-model="form.oauthScopes" 
            type="text" 
            class="input-field" 
            placeholder="read write (space separated)"
            :disabled="loading"
          />
        </div>
        <div class="form-group">
          <label class="input-label">Audience</label>
          <input 
            v-model="form.oauthAudience" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
      </div>

      <!-- mTLS -->
      <div v-if="form.authMethod === 'mtls'" class="mt-4 space-y-4">
        <div class="form-group">
          <label class="input-label">Client Certificate <span class="text-red-400">*</span></label>
          <textarea 
            v-model="form.tlsCert" 
            class="input-field" 
            rows="4" 
            placeholder="-----BEGIN CERTIFICATE-----"
            :disabled="loading"
          ></textarea>
        </div>
        <div class="form-group">
          <label class="input-label">Client Key <span class="text-red-400">*</span></label>
          <textarea 
            v-model="form.tlsKey" 
            class="input-field" 
            rows="4" 
            placeholder="-----BEGIN PRIVATE KEY-----"
            :disabled="loading"
          ></textarea>
        </div>
        <div class="form-group">
          <label class="input-label">CA Certificate</label>
          <textarea 
            v-model="form.tlsCa" 
            class="input-field" 
            rows="4" 
            placeholder="-----BEGIN CERTIFICATE-----"
            :disabled="loading"
          ></textarea>
        </div>
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
          <span class="text-gray-700 dark:text-gray-300">Enable TLS</span>
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

    <!-- SNMP Settings -->
    <div v-if="form.type === 'snmp'" class="section-card">
      <h2 class="section-title">SNMP Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group md:col-span-2">
          <label class="input-label">Community String <span class="text-red-400">*</span></label>
          <input 
            v-model="form.snmpCommunity" 
            type="password" 
            class="input-field" 
            placeholder="public"
            :disabled="loading"
          />
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">OID <span class="text-red-400">*</span></label>
          <input 
            v-model="form.snmpOid" 
            type="text" 
            class="input-field" 
            placeholder="1.3.6.1.4.1.9.6.1.101"
            pattern="^([0-2])((\.0)|(\.[1-9][0-9]*))*$"
            :disabled="loading"
          />
          <p class="text-xs text-gray-400 mt-1">Object Identifier (e.g., 1.3.6.1.4.1.9.6.1.101)</p>
        </div>

        <div class="form-group">
          <label class="input-label">SNMP Version</label>
          <select v-model="form.snmpVersion" class="select-field" :disabled="loading">
            <option value="1">SNMPv1</option>
            <option value="2c">SNMPv2c</option>
          </select>
        </div>

        <div class="form-group">
          <label class="input-label">Expected Value</label>
          <input 
            v-model="form.expectedValue" 
            type="text" 
            class="input-field" 
            placeholder="Optional expected value"
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- DNS Settings -->
    <div v-if="form.type === 'dns'" class="section-card">
      <h2 class="section-title">DNS Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group">
          <label class="input-label">DNS Server <span class="text-red-400">*</span></label>
          <input 
            v-model="form.dnsResolveServer" 
            type="text" 
            class="input-field" 
            placeholder="1.1.1.1"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">DNS Server Port</label>
          <input 
            v-model.number="form.dnsPort" 
            type="number" 
            class="input-field" 
            placeholder="53"
            min="1"
            max="65535"
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Record Type</label>
          <select v-model="form.dnsResolveType" class="select-field" :disabled="loading">
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
            <option value="CAA">CAA</option>
            <option value="CNAME">CNAME</option>
            <option value="MX">MX</option>
            <option value="NS">NS</option>
            <option value="PTR">PTR</option>
            <option value="SOA">SOA</option>
            <option value="SRV">SRV</option>
            <option value="TXT">TXT</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Radius Settings -->
    <div v-if="form.type === 'radius'" class="section-card">
      <h2 class="section-title">Radius Settings</h2>
      
      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group">
          <label class="input-label">Username <span class="text-red-400">*</span></label>
          <input 
            v-model="form.radiusUsername" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Password <span class="text-red-400">*</span></label>
          <input 
            v-model="form.radiusPassword" 
            type="password" 
            class="input-field" 
            :disabled="loading"
          />
        </div>

        <div class="form-group md:col-span-2">
          <label class="input-label">Shared Secret <span class="text-red-400">*</span></label>
          <input 
            v-model="form.radiusSecret" 
            type="password" 
            class="input-field" 
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Called Station ID</label>
          <input 
            v-model="form.radiusCalledStationId" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>

        <div class="form-group">
          <label class="input-label">Calling Station ID</label>
          <input 
            v-model="form.radiusCallingStationId" 
            type="text" 
            class="input-field" 
            :disabled="loading"
          />
        </div>
      </div>
    </div>

    <!-- Ping Settings -->
    <div v-if="form.type === 'ping'" class="section-card">
      <h2 class="section-title">Ping Settings</h2>
      <p class="text-sm text-secondary">Packet count, packet size and numeric output are not executed by the distributed worker in this deployment. Use an external probe if you need them.</p>
    </div>

    <div v-if="showHttpSettings" class="section-card space-y-4">
      <MonitorAssertionEditor v-model="assertions" :disabled="loading || !canEdit" @validity="assertionsValid=$event" />
      <button type="button" class="btn btn-outline" :disabled="trialLoading || loading || !canEdit || !assertionsValid" @click="handleSubmit(true)">{{ trialLoading ? 'Checking…' : 'Test request and assertions' }}</button>
      <p v-if="trialError" role="alert" class="text-red-400">{{ trialError }}</p>
      <div v-if="trialResult"><p>{{ trialResult.status===1?'Check passed':'Check failed' }} · {{ trialResult.code }} · {{ Math.round(trialResult.ping) }} ms</p><MonitorAssertionResults :result="trialResult.assertionResults" /></div>
    </div>
    <!-- Monitor Conditions are not evaluated by this runtime -->
    <div v-if="supportsConditions" class="section-card">
      <h2 class="section-title">Monitor Conditions</h2>
      <p class="text-sm text-secondary">Custom conditions are not evaluated for this monitor type in this deployment. Use HTTP response assertions (available for HTTP-based monitors) instead.</p>
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
          <label class="input-label">Alert if response time exceeds (ms)</label>
          <input
            v-model.number="form.responseTimeThreshold"
            type="number"
            min="1"
            max="300000"
            class="input-field"
            :disabled="loading"
            placeholder="Off"
          />
          <p class="text-xs text-secondary mt-1">Optional. Sends one alert per hour when a healthy check is slower than this.</p>
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
        <span class="text-gray-700 dark:text-gray-300">Upside Down Mode (alert when UP)</span>
      </label>

      <!-- Certificate Expiry Notification (for HTTP monitors) -->
      <label v-if="showHttpSettings && !form.ignoreTls" class="flex items-center gap-2 cursor-pointer mt-3">
        <input 
          v-model="form.expiryNotification" 
          type="checkbox" 
          class="checkbox"
          :disabled="loading"
        />
        <span class="text-gray-700 dark:text-gray-300">Certificate Expiry Notification</span>
      </label>

      <!-- Resend Notification Interval -->
      <div class="mt-4">
        <label class="input-label">Resend Notification After N Minutes Still Down</label>
        <input 
          v-model.number="form.resendInterval" 
          type="number" 
          class="input-field w-32"
          min="0"
          :disabled="loading"
        />
        <p class="text-xs text-gray-400 mt-1">Repeats every N minutes while the monitor stays down. Set to 0 to disable reminders (range 0–1440).</p>
      </div>
    </div>

    <!-- Notifications -->
    <div class="section-card">
      <h2 class="section-title">Notifications</h2>
      
      <p v-if="!notifications || notifications.length === 0" class="text-gray-600 dark:text-gray-400">
        No notifications configured. 
        <NuxtLink to="/settings/notifications" class="text-green-400 hover:underline">Setup Notification</NuxtLink>
      </p>

      <div v-else class="space-y-3">
        <label 
          v-for="notification in notifications" 
          :key="notification.id" 
          class="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50"
        >
          <input 
            type="checkbox"
            :checked="isNotificationSelected(notification.id)"
            @change="toggleNotification(notification.id)"
            class="checkbox"
            :disabled="loading"
          />
          <span class="text-gray-300 flex-1">{{ notification.name }}</span>
          <span v-if="notification.isDefault" class="px-2 py-0.5 text-xs bg-green-600 rounded">Default</span>
        </label>
      </div>

      <div class="mt-4">
        <NuxtLink 
          to="/settings/notifications" 
          class="btn btn-outline text-sm"
        >
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-1" />
          Setup Notification
        </NuxtLink>
      </div>
    </div>

    <!-- Tags -->
    <div class="section-card">
      <h2 class="section-title">Tags</h2>
      
      <div v-if="!tags || tags.length === 0" class="text-gray-600 dark:text-gray-400">
        No tags available. 
        <NuxtLink to="/settings/tags" class="text-green-400 hover:underline">Create Tags</NuxtLink>
      </div>

      <div v-else class="flex flex-wrap gap-2">
        <label 
          v-for="tag in tags" 
          :key="tag.id" 
          class="flex items-center gap-2 cursor-pointer px-3 py-1.5 rounded-full border transition-colors"
          :class="isTagSelected(tag.id) ? 'border-green-500 bg-green-500/20' : 'border-gray-600 hover:border-gray-500'"
        >
          <input 
            type="checkbox"
            :checked="isTagSelected(tag.id)"
            @change="toggleTag(tag.id)"
            class="sr-only"
            :disabled="loading"
          />
          <span 
            class="w-3 h-3 rounded-full" 
            :style="{ backgroundColor: tag.color || '#6b7280' }"
          ></span>
          <span class="text-sm text-gray-300">{{ tag.name }}</span>
        </label>
      </div>
    </div>

    <!-- Parent Group -->
    <div class="section-card">
      <h2 class="section-title">Parent Group</h2>
      
      <select v-model="form.parent" class="select-field" :disabled="loading">
        <option :value="null">No Parent (Root)</option>
        <option 
          v-for="group in availableGroups" 
          :key="group.id" 
          :value="group.id"
        >
          {{ group.name }}
        </option>
      </select>
      <p class="text-xs text-gray-400 mt-1">Assign this monitor to a group</p>
    </div>

    <!-- Node Assignment (Cluster Mode) -->
    <div v-if="clusterNodes.length > 0" class="section-card">
      <h2 class="section-title">Node Assignment</h2>
      <p class="text-xs text-amber-500 dark:text-amber-400 mb-3">
        Compatibility fields only: this deployment schedules checks with a shared work queue, so these values are stored but do not choose the executing node.
      </p>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="form-group">
          <label class="input-label">Primary Node</label>
          <select v-model="form.nodeId" class="select-field" :disabled="loading">
            <option :value="null">Auto (Current Node)</option>
            <option 
              v-for="node in clusterNodes" 
              :key="node.id" 
              :value="node.id"
            >
              {{ node.name || node.id }}
            </option>
          </select>
          <p class="text-xs text-gray-400 mt-1">Stored for compatibility; not used for scheduling</p>
        </div>

        <div class="form-group">
          <label class="input-label">Assigned Node (Override)</label>
          <select v-model="form.assignedNode" class="select-field" :disabled="loading">
            <option :value="null">Use Primary Node</option>
            <option 
              v-for="node in clusterNodes" 
              :key="node.id" 
              :value="node.id"
            >
              {{ node.name || node.id }}
            </option>
          </select>
          <p class="text-xs text-gray-400 mt-1">Stored for compatibility; failover is automatic</p>
        </div>
      </div>
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
        :disabled="loading || !canEdit || !assertionsValid"
      >
        <UIcon v-if="loading" name="i-heroicons-arrow-path" class="w-4 h-4 animate-spin mr-2" />
        {{ submitLabel }}
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import type { AssertionSet } from '../../shared/types/assertions'
const { canEdit, current: currentWorkspace } = useWorkspace()
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
const assertions=ref<AssertionSet|null>(props.initialData?.assertions||null)
const assertionsValid=ref(true),clearSecrets=ref<string[]>([]),trialLoading=ref(false),trialError=ref(''),trialResult=ref<any>(null)
const configuredFields=computed(()=>Object.keys(props.initialData?.configuredSecrets||{}).filter(key=>props.initialData.configuredSecrets[key]))
const secretFieldNames=['url','body','headers','basicAuthUser','basicAuthPass','authConfig','grpcUrl','grpcBody','grpcMetadata','databaseConnectionString','databaseQuery','mqttUsername','mqttPassword','kafkaBrokers','kafkaUsername','kafkaPassword','rabbitmqNodes','rabbitmqUsername','rabbitmqPassword','redisConnectionString','radiusSecret','dockerDaemon','dockerHost','queryParams']


// Get composables data
const { notifications, fetchNotifications } = useNotifications()
const { tags, fetchTags } = useTags()
const { proxies, fetchProxies } = useProxies()
const { remoteBrowsers, fetchRemoteBrowsers } = useRemoteBrowsers()

// Cluster nodes state
const nodesData = ref<Array<{ id: string; name?: string; healthy?: boolean }>>([])

// Fetch cluster nodes
async function fetchClusterNodes() {
  try {
    const response = await $fetch<Array<{ id: string; name?: string; healthy?: boolean }>>('/api/cluster/nodes')
    nodesData.value = response || []
  } catch (error) {
    console.warn('Failed to fetch cluster nodes, cluster mode may not be enabled:', error)
    nodesData.value = []
  }
}

// Fetch data on mount
onMounted(() => {
  fetchNotifications()
  fetchTags()
  fetchProxies()
  fetchRemoteBrowsers()
  fetchClusterNodes()
})

// Initialize notification IDs from initial data
const initNotificationIds = (): Record<number, boolean> => {
  const ids: Record<number, boolean> = {}
  if (props.initialData?.notificationIDList) {
    for (const id of Object.keys(props.initialData.notificationIDList)) {
      ids[Number(id)] = true
    }
  }
  for(const id of props.initialData?.notifications||[])ids[id]=true
  return ids
}

// Initialize tag IDs from initial data
const initTagIds = (): number[] => {
  if (props.initialData?.tags) {
    return props.initialData.tags.map((t: any) => t.tagId || t.tag?.id || t.tag_id || t.id)
  }
  return []
}

// Initialize HTTP headers from initial data
const initHeaders = (): Array<{ key: string; value: string }> => {
  if (props.initialData?.headers) {
    try {
      const headersObj = typeof props.initialData.headers === 'string' 
        ? JSON.parse(props.initialData.headers) 
        : props.initialData.headers
      return Object.entries(headersObj).map(([key, value]) => ({ 
        key, 
        value: String(value) 
      }))
    } catch {
      return []
    }
  }
  return []
}

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
  responseTimeThreshold: props.initialData?.responseTimeThreshold || null,
  retryInterval: props.initialData?.retryInterval || 60,
  maxretries: props.initialData?.maxretries || 0,
  description: props.initialData?.description || '',
  // Notifications & Tags
  notificationIDList: initNotificationIds(),
  selectedTags: initTagIds(),
  // Certificate expiry notification
  expiryNotification: props.initialData?.expiryNotification || false,
  // Resend notification interval
  resendInterval: props.initialData?.resendInterval || 0,
  // Parent group
  parent: props.initialData?.parent || null,
  // HTTP Advanced
  proxyId: props.initialData?.proxyId || null,
  acceptedStatuscodes: props.initialData?.acceptedStatuscodes?.join(', ') ?? '200-399',
  headers: initHeaders(),
  body: props.initialData?.body || '',
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
  dockerHost: props.initialData?.dockerHost || (props.initialData?.id ? '' : '/var/run/docker.sock'),
  dockerDaemon: props.initialData?.dockerDaemon || (props.initialData?.id ? '' : 'socket'),
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
  // SNMP
  snmpCommunity: props.initialData?.snmpCommunity || props.initialData?.radiusPassword || '',
  snmpOid: props.initialData?.snmpOid || '',
  snmpVersion: props.initialData?.snmpVersion || '2c',
  // DNS
  dnsResolveServer: props.initialData?.dnsResolveServer || props.initialData?.dns_resolve_server || '1.1.1.1',
  dnsPort: props.initialData?.dnsPort || props.initialData?.port || 53,
  dnsResolveType: props.initialData?.dnsResolveType || props.initialData?.dns_resolve_type || 'A',
  // Radius
  radiusUsername: props.initialData?.radiusUsername || '',
  radiusPassword: props.initialData?.radiusPassword || '',
  radiusSecret: props.initialData?.radiusSecret || '',
  radiusCalledStationId: props.initialData?.radiusCalledStationId || '',
  radiusCallingStationId: props.initialData?.radiusCallingStationId || '',
  // Ping
  pingCount: props.initialData?.pingCount || props.initialData?.ping_count || 4,
  packetSize: props.initialData?.packetSize || 56,
  pingNumeric: props.initialData?.pingNumeric || props.initialData?.ping_numeric || false,
  // Max Redirects
  maxRedirects: props.initialData?.maxRedirects ?? props.initialData?.maxredirects ?? 10,
  // Authentication
  authMethod: props.initialData?.authMethod || '',
  basicAuthUser: props.initialData?.basicAuthUser || props.initialData?.basic_auth_user || '',
  basicAuthPass: props.initialData?.basicAuthPass || props.initialData?.basic_auth_pass || '',
  authDomain: props.initialData?.authDomain || '',
  authWorkstation: props.initialData?.authWorkstation || '',
  // OAuth2
  oauthTokenUrl: props.initialData?.oauthTokenUrl || props.initialData?.oauth_token_url || '',
  oauthClientId: props.initialData?.oauthClientId || props.initialData?.oauth_client_id || '',
  oauthClientSecret: props.initialData?.oauthClientSecret || props.initialData?.oauth_client_secret || '',
  oauthScopes: props.initialData?.oauthScopes || props.initialData?.oauth_scopes || '',
  oauthAudience: props.initialData?.oauthAudience || props.initialData?.oauth_audience || '',
  // mTLS
  tlsCert: props.initialData?.tlsCert || '',
  tlsKey: props.initialData?.tlsKey || '',
  tlsCa: props.initialData?.tlsCa || '',
  // Cache Bust
  cacheBust: props.initialData?.cacheBust || false,
  // Remote Browser
  useRemoteBrowser: !!props.initialData?.remoteBrowserId,
  remoteBrowser: props.initialData?.remoteBrowserId ?? null,
  // Monitor Conditions
  conditions: props.initialData?.conditions || [],
  // Node Assignment (Cluster Mode)
  nodeId: props.initialData?.node_id || props.initialData?.nodeId || null,
  assignedNode: props.initialData?.assigned_node || props.initialData?.assignedNode || null,
})

const monitorTypes = [
  { value: 'http', label: 'HTTP(s)' },
  { value: 'keyword', label: 'HTTP(s) - Keyword' },
  { value: 'json-query', label: 'HTTP(s) - JSON Query' },
  { value: 'bruno', label: 'Bruno (.bru request)' },
  { value: 'grpc-keyword', label: 'gRPC(s) - Keyword' },
  { value: 'tcp', label: 'TCP Port' },
  { value: 'ping', label: 'Ping' },
  { value: 'dns', label: 'DNS' },
  { value: 'push', label: 'Push' },
  { value: 'snmp', label: 'SNMP' },
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

// Monitor types that support conditions
const supportsConditions = computed(() => 
  ['grpc-keyword', 'tcp', 'dns', 'mqtt', 'snmp'].includes(form.type)
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

// Notification selection methods
const isNotificationSelected = (id: number) => {
  return !!form.notificationIDList[id]
}

const toggleNotification = (id: number) => {
  if (form.notificationIDList[id]) {
    delete form.notificationIDList[id]
  } else {
    form.notificationIDList[id] = true
  }
}

// Tag selection methods
const isTagSelected = (id: number) => {
  return form.selectedTags.includes(id)
}

const toggleTag = (id: number) => {
  const index = form.selectedTags.indexOf(id)
  if (index > -1) {
    form.selectedTags.splice(index, 1)
  } else {
    form.selectedTags.push(id)
  }
}

// HTTP Headers management
const addHeader = () => {
  form.headers.push({ key: '', value: '' })
}

const removeHeader = (index: number) => {
  form.headers.splice(index, 1)
}

// Available groups for parent selection
const availableGroups = ref<{ id: number; name: string }[]>([])
onMounted(async () => {
  try {
    const result = await $fetch<any>('/api/v1/groups')
    availableGroups.value = (result?.data || []).map((group: any) => ({ id: Number(group.id), name: String(group.name || group.id) }))
  } catch {
    availableGroups.value = []
  }
})

// Cluster nodes for node assignment
const clusterNodes = computed(() => {
  // Return nodes fetched from /api/cluster/nodes
  return nodesData.value
})

const handleSubmit = async (trial=false) => {
  if (!canEdit.value || !assertionsValid.value) return
  const data: any = {
    type: form.type,
    name: form.name,
    interval: form.interval,
    timeout: form.timeout,
    responseTimeThreshold: form.responseTimeThreshold && form.responseTimeThreshold > 0 ? Number(form.responseTimeThreshold) : null,
    retryInterval: form.retryInterval,
    maxretries: form.maxretries,
    description: form.description || null,
    upsideDown: form.upsideDown,
  }

  // HTTP-based monitors
  if (showUrlField.value) {
    data.url = form.url
    data.method = form.method
    data.keyword = form.keyword || null
    data.invertKeyword = form.invertKeyword
    data.ignoreTls = form.ignoreTls
    
    // Proxy
    data.proxyId = form.proxyId
    
    // Accepted status codes - parse the comma-separated string
    {
      data.acceptedStatuscodes = form.acceptedStatuscodes
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s)
    }
    
    // HTTP Headers - convert array to object
    if (form.headers.length > 0) {
      const headersObj: Record<string, string> = {}
      form.headers.forEach((h: { key: string; value: string }) => {
        if (h.key) {
          headersObj[h.key] = h.value
        }
      })
      if (Object.keys(headersObj).length > 0) {
        data.headers = headersObj
      }
    }
    
    // Request body
    if (form.type === 'bruno') {
      data.body = form.body
    } else if (form.body && ['POST', 'PUT', 'PATCH'].includes(form.method)) {
      data.body = form.body
    }

    // An explicit None selection must disable existing credentials.
    data.authMethod=form.authMethod||'none'
    if (form.authMethod) {
      data.authMethod = form.authMethod
      
      // Basic Auth / NTLM
      if (form.authMethod === 'basic' || form.authMethod === 'ntlm') {
        data.basicAuthUser = form.basicAuthUser || undefined
        data.basicAuthPass = form.basicAuthPass || undefined
        
        if (form.authMethod === 'ntlm') {
          data.authDomain = form.authDomain || undefined
          data.authWorkstation = form.authWorkstation || undefined
        }
      }
      
      // OAuth2
      if (form.authMethod === 'oauth2-cc') {
        if(form.oauthTokenUrl || form.oauthClientId || form.oauthClientSecret) data.authConfig={tokenUrl:form.oauthTokenUrl,clientId:form.oauthClientId,clientSecret:form.oauthClientSecret,scopes:form.oauthScopes||undefined,audience:form.oauthAudience||undefined}
      }
      
      // mTLS
      if (form.authMethod === 'mtls') {
        data.tlsCert = form.tlsCert
        data.tlsKey = form.tlsKey
        data.tlsCa = form.tlsCa || undefined
      }
    }
  }

  // JSON Query specific
  if (form.type === 'json-query') {
    data.jsonPath = form.jsonPath
    data.expectedValue = form.expectedValue
  }

  // gRPC specific
  if (form.type === 'grpc-keyword') {
    data.grpcUrl = form.grpcUrl
    data.grpcServiceName = form.grpcServiceName
    data.grpcMethod = form.grpcMethod
    data.grpcProtoContent = form.grpcProtoContent || undefined
    data.grpcBody = form.grpcBody || undefined
    data.grpcEnableTls = form.grpcEnableTls
    data.keyword = form.keyword || null
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

  // SNMP specific
  if (form.type === 'snmp') {
    data.radiusPassword = form.snmpCommunity // Community string stored in radiusPassword field
    data.snmpOid = form.snmpOid
    data.snmpVersion = form.snmpVersion
    data.expectedValue = form.expectedValue
  }

  // DNS specific
  if (form.type === 'dns') {
    data.dnsResolver = form.dnsResolveServer
    data.port = form.dnsPort
    data.dnsRecordType = form.dnsResolveType
  }

  // Radius specific
  if (form.type === 'radius') {
    data.radiusUsername = form.radiusUsername
    data.radiusPassword = form.radiusPassword
    data.radiusSecret = form.radiusSecret
    data.radiusCalledStationId = form.radiusCalledStationId || undefined
    data.radiusCallingStationId = form.radiusCallingStationId || undefined
  }

  // Max redirects for HTTP
  if (showHttpSettings.value) {
    data.maxRedirects = form.maxRedirects
    data.cacheBust = form.cacheBust
    
    // Remote Browser (for keyword monitoring)
    if (form.type === 'keyword' && form.useRemoteBrowser) {
      data.remoteBrowserId = form.remoteBrowser == null ? null : Number(form.remoteBrowser)
    }
  }

  data.notifications=Object.keys(form.notificationIDList).filter(id=>form.notificationIDList[Number(id)]).map(Number)
  data.tags=[...form.selectedTags]

  // Certificate expiry notification
  if (showHttpSettings.value && !form.ignoreTls) {
    data.expiryNotification = form.expiryNotification
  }

  // Resend notification interval
  data.resendInterval = form.resendInterval || 0

  // Parent group
  if (form.parent) {
    data.parent = form.parent
  }

  // Node assignment (Cluster Mode)
  if (form.nodeId) {
    data.nodeId = form.nodeId
  }
  if (form.assignedNode) {
    data.assignedNode = form.assignedNode
  }

  if(showHttpSettings.value)data.assertions=assertions.value
  if(props.initialData?.id){
    data.clearSecrets=[...clearSecrets.value]
    for(const key of secretFieldNames)if(data[key]===''||data[key]===undefined)delete data[key]
  }
  if(trial){
    trialLoading.value=true;trialError.value='';trialResult.value=null
    try{const response=await $fetch<any>(props.initialData?.id?`/api/v1/monitors/${props.initialData.id}/test`:'/api/v1/monitors/test',{method:'POST',body:data});trialResult.value=response.data}
    catch(error:any){trialError.value=error.data?.message||'Trial failed'}
    finally{trialLoading.value=false}
    return
  }
  emit('submit', data)
}
</script>

<style scoped>
.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.form-group {
  margin-bottom: 0;
}

.input-label {
  display: block;
  font-weight: 500;
  margin-bottom: 0.5rem;
  color: var(--text-secondary);
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
