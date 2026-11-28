<template>
  <div class="api-docs-container">
    <div class="header-bar">
      <h1 class="text-xl font-bold text-gray-900 dark:text-white">API Documentation</h1>
      <div class="flex items-center gap-4">
        <a 
          :href="swaggerJsonUrl" 
          target="_blank" 
          class="btn btn-secondary text-sm"
        >
          Download OpenAPI JSON
        </a>
      </div>
    </div>
    
    <div v-if="loadError" class="card p-5">
      <p role="alert" class="text-amber-500 mb-4">
        Interactive UI could not load from the CDN. Showing the embedded endpoint list; the
        <a :href="swaggerJsonUrl" class="link">full OpenAPI JSON</a> is also available.
      </p>
      <div class="flex items-center gap-3 mb-3">
        <input v-model="endpointSearch" class="input-field max-w-sm" placeholder="Filter endpoints by path, method or summary" aria-label="Filter endpoints" />
        <span class="text-xs text-secondary">{{ filteredEndpoints.length }} / {{ endpoints.length }} endpoints</span>
      </div>
      <div class="overflow-x-auto">
        <table class="table">
          <thead><tr><th>Method</th><th>Path</th><th>Summary</th></tr></thead>
          <tbody>
            <tr v-for="endpoint in filteredEndpoints" :key="endpoint.method + endpoint.path">
              <td><span class="uppercase text-xs font-semibold text-primary">{{ endpoint.method }}</span></td>
              <td class="font-mono text-sm">{{ endpoint.path }}</td>
              <td class="text-secondary">{{ endpoint.summary }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div id="swagger-ui" class="swagger-wrapper"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

// Define page meta
definePageMeta({
  layout: 'default', middleware: ['auth']
})

// Use local proxy endpoint to avoid CORS issues
const swaggerJsonUrl = '/api/swagger-json'

const loadError=ref(false)
const endpoints=ref<{ method: string; path: string; summary: string }[]>([])
const endpointSearch=ref('')
const filteredEndpoints=computed(()=>{
  const term=endpointSearch.value.trim().toLowerCase()
  if(!term)return endpoints.value
  return endpoints.value.filter(row=>[row.method,row.path,row.summary].join(' ').toLowerCase().includes(term))
})
let swaggerUIBundle: any = null

const methods = ['get', 'post', 'put', 'patch', 'delete']

async function loadFallbackEndpoints() {
  try {
    const spec = await $fetch<any>(swaggerJsonUrl)
    endpoints.value = Object.entries(spec?.paths || {}).flatMap(([path, operations]: [string, any]) =>
      methods.filter(method => operations?.[method]).map(method => ({
        method,
        path,
        summary: operations[method]?.summary || '',
      })))
  } catch {
    endpoints.value = []
  }
}

onMounted(async () => {
  void loadFallbackEndpoints()
  // Dynamically load Swagger UI CSS
  const cssLink = document.createElement('link')
  cssLink.rel = 'stylesheet'
  cssLink.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css'
  document.head.appendChild(cssLink)

  // Dynamically load Swagger UI Bundle
  const script = document.createElement('script')
  script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js'
  script.onerror=()=>{loadError.value=true}
  script.onload = () => {
    initSwaggerUI()
  }
  document.head.appendChild(script)
})

function initSwaggerUI() {
  if (typeof (window as any).SwaggerUIBundle !== 'undefined') {
    swaggerUIBundle = (window as any).SwaggerUIBundle({
      url: swaggerJsonUrl,
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [
        (window as any).SwaggerUIBundle.presets.apis
      ],
      plugins: [
        (window as any).SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: 'BaseLayout',
      persistAuthorization: false,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      tryItOutEnabled: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
      requestInterceptor:(request:any)=>{if(new URL(request.url,window.location.origin).origin!==window.location.origin)throw new Error("Only current-origin API requests are permitted");return request},
      validatorUrl: null
    })
  }
}

onUnmounted(() => {
  swaggerUIBundle = null
})
</script>

<style scoped>
.api-docs-container {
  min-height: calc(100vh - 80px);
  background-color: var(--bg-primary);
}

.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.swagger-wrapper {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  min-height: 600px;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background-color: var(--hover-bg);
}

/* Override Swagger UI styles for dark mode compatibility */
:deep(.swagger-ui) {
  font-family: inherit;
}

:deep(.swagger-ui .topbar) {
  display: none;
}

:deep(.swagger-ui .info .title) {
  color: #10b981;
}

:deep(.swagger-ui .btn.authorize) {
  background-color: #10b981;
  border-color: #10b981;
  color: white;
}

:deep(.swagger-ui .btn.authorize:hover) {
  background-color: #059669;
  border-color: #059669;
}
</style>
