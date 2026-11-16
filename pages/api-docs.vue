<template>
  <div class="api-docs-container">
    <div class="header-bar">
      <h1 class="text-xl font-bold text-highlighted">API Documentation</h1>
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
    
    <div id="swagger-ui" class="swagger-wrapper"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'

// Define page meta
definePageMeta({
  layout: 'default'
})

// Use local proxy endpoint to avoid CORS issues
const swaggerJsonUrl = '/api/swagger-json'

let swaggerUIBundle: any = null

onMounted(async () => {
  // Dynamically load Swagger UI CSS
  const cssLink = document.createElement('link')
  cssLink.rel = 'stylesheet'
  cssLink.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css'
  document.head.appendChild(cssLink)

  // Dynamically load Swagger UI Bundle
  const script = document.createElement('script')
  script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js'
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
        (window as any).SwaggerUIBundle.presets.apis,
        (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      plugins: [
        (window as any).SwaggerUIBundle.plugins.DownloadUrl
      ],
      layout: 'BaseLayout',
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      showExtensions: true,
      tryItOutEnabled: true,
      supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch'],
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
  color: var(--uk-status-up-fg);
}

:deep(.swagger-ui .btn.authorize) {
  background-color: var(--uk-status-up);
  border-color: var(--uk-status-up);
  color: white;
}

:deep(.swagger-ui .btn.authorize:hover) {
  background-color: var(--uk-status-up);
  border-color: var(--uk-status-up);
}
</style>
