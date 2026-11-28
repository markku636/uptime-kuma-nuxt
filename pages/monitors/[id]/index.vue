<template>
  <div class="page-container max-w-6xl">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center min-h-[400px]">
      <div class="spinner w-10 h-10"></div>
    </div>

    <Transition name="slide-fade">
    <div v-if="monitor && !loading">
      <!-- Header -->
      <div class="mb-6">
        <NuxtLink to="/dashboard" class="link inline-flex items-center mb-3 group">
          <UIcon name="i-heroicons-arrow-left" class="w-4 h-4 mr-1 transition-transform group-hover:-translate-x-1" />
          Back to Dashboard
        </NuxtLink>
        
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div class="flex items-center gap-3">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">{{ monitor.name }}</h1>
              <span class="text-gray-500 text-sm">#{{ monitor.id }}</span>
              <span 
                :class="[statusBadgeClass, latestStatus === 1 ? 'status-up' : latestStatus === 0 ? 'status-down' : '']" 
                class="badge text-sm px-3 py-1"
              >
                {{ statusText }}
              </span>
            </div>
            <p v-if="monitor.description" class="text-gray-600 dark:text-gray-400 mt-1">{{ monitor.description }}</p>
            <div class="flex items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
              <span class="uppercase font-medium text-gray-700 dark:text-gray-300">{{ monitor.type }}</span>
              <span>|</span>
              <a v-if="monitor.url" :href="monitor.url" target="_blank" class="link truncate max-w-md">
                {{ monitor.url }}
              </a>
              <span v-else-if="monitor.hostname">{{ monitor.hostname }}{{ monitor.port ? `:${monitor.port}` : '' }}</span>
            </div>
            <div v-if="monitor.groupId || monitor.bruno" class="flex items-center gap-2 mt-2 text-sm flex-wrap">
              <NuxtLink v-if="monitor.groupId" to="/monitors/groups" class="origin-chip" :title="'Group: ' + pathOf(monitor.groupId)">
                <UIcon name="i-heroicons-folder" class="w-4 h-4" />{{ pathOf(monitor.groupId) || 'Group' }}
              </NuxtLink>
              <span v-if="monitor.bruno" class="origin-chip" :title="`Imported from Bruno collection ${monitor.bruno.collectionId}`">
                <UIcon name="i-heroicons-arrow-path-rounded-square" class="w-4 h-4" />Bruno · {{ monitor.bruno.path }}
              </span>
              <span v-if="monitor.bruno?.ignoredBlocks?.length" class="origin-chip warning" role="note">
                <UIcon name="i-heroicons-exclamation-triangle" class="w-4 h-4" />Not executed: {{ monitor.bruno.ignoredBlocks.join(', ') }}
              </span>
            </div>
          </div>
          
          <!-- Actions -->
          <div v-if="canEdit" class="flex items-center gap-2 flex-wrap">
            <button @click="openInvestigation" :disabled="loadingInvestigation" class="btn btn-secondary">
              <UIcon name="i-heroicons-magnifying-glass-circle" class="w-4 h-4 mr-1" />
              {{ loadingInvestigation ? 'Loading…' : 'Investigate' }}
            </button>
            <button @click="checkNow" :disabled="checkingNow" class="btn btn-secondary">
              <UIcon name="i-heroicons-arrow-path" class="w-4 h-4 mr-1" />
              {{ checkingNow ? $t('Queuing…') : $t('Check now') }}
            </button>
            <button v-if="monitor.active" @click="pauseMonitor" class="btn btn-secondary">
              <UIcon name="i-heroicons-pause" class="w-4 h-4 mr-1" />
              Pause
            </button>
            <button v-else @click="resumeMonitor" class="btn btn-primary">
              <UIcon name="i-heroicons-play" class="w-4 h-4 mr-1" />
              Resume
            </button>
            <NuxtLink :to="`/monitors/${monitorId}/edit`" class="btn btn-secondary">
              <UIcon name="i-heroicons-pencil" class="w-4 h-4 mr-1" />
              Edit
            </NuxtLink>
            <button @click="cloneMonitor" class="btn btn-secondary" :disabled="cloning">
              <UIcon name="i-heroicons-document-duplicate" class="w-4 h-4 mr-1" />
              {{ cloning ? "Cloning..." : "Clone" }}
            </button>
            <button v-if="canManage && ['http', 'keyword', 'json-query'].includes(monitor.type)" class="btn btn-secondary" :disabled="exportingBruno" title="Download this monitor as a Bruno request" @click="exportToBruno">
              <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4 mr-1" />
              Export .bru
            </button>
            <a :href="`/api/v1/monitors/${monitorId}/export-heartbeats`" class="btn btn-secondary" download>
              <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-1" />
              Export CSV
            </a>
            <!-- Badge Generator -->
            <button @click="showBadgeGenerator = true" class="btn btn-secondary">
              <UIcon name="i-heroicons-rectangle-stack" class="w-4 h-4 mr-1" />
              Badge
            </button>
            <button @click="showDeleteConfirm = true" class="btn btn-danger">
              <UIcon name="i-heroicons-trash" class="w-4 h-4 mr-1" />
              Delete
            </button>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <Transition name="fade">
      <div v-if="monitor.tags?.length" class="flex flex-wrap gap-2 mb-6">
        <span 
          v-for="mt in monitor.tags" 
          :key="mt.tag?.id || mt.id" 
          class="px-2 py-1 rounded text-xs font-medium text-white transition-transform hover:scale-105"
          :style="{ backgroundColor: mt.tag?.color || mt.color }"
        >
          {{ mt.tag?.name || mt.name }}
        </span>
      </div>
      </Transition>

      <div v-if="lastHeartbeat?.assertionResults" class="section-card"><MonitorAssertionResults :result="lastHeartbeat.assertionResults" /></div>

      <!-- Visual diff：每個 viewport 最近一次的差異證據與基準接受 -->
      <div v-if="showVisualPanel" class="section-card space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="section-title">{{ monitor.type === 'browser-flow' ? '瀏覽器流程失敗證據（最近一次）' : '視覺跑版（每個 viewport 最近一次）' }}</h3>
          <button class="text-sm underline" :disabled="loadingVisual" @click="loadVisualArtifacts">重新整理</button>
        </div>
        <p v-if="loadingVisual" class="text-sm text-secondary">載入中…</p>
        <p v-else-if="!latestVisualByViewport.length" class="text-sm text-secondary">尚無檢查結果。</p>
        <div v-for="item in latestVisualByViewport" :key="item.viewportLabel" class="border rounded-lg p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="font-medium">{{ item.viewportLabel === 'flow-fail' ? '最近失敗' : item.viewportLabel === 'flow-trace' ? '最近成功' : item.viewportLabel }}</span>
              <span class="ml-2 text-sm" :class="item.status === 1 ? 'text-emerald-400' : 'text-red-400'">
                {{ item.status === 1 ? '正常' : monitor.type === 'browser-flow' ? '失敗' : '跑版' }}
                <template v-if="item.diffRatio != null"> · {{ (item.diffRatio * 100).toFixed(2) }}%（{{ item.diffPixels }}px）</template>
                <template v-if="item.baseline?.stale"> · 基準已失效</template>
              </span>
            </div>
            <button
              v-if="item.currentImage && monitor.type === 'visual-diff'"
              class="btn btn-secondary text-sm"
              :disabled="acceptingViewport === item.viewportLabel"
              @click="acceptBaseline(item.viewportLabel)"
            >
              {{ acceptingViewport === item.viewportLabel ? '處理中…' : '接受為新基準' }}
            </button>
          </div>
          <p v-if="item.metrics" class="text-xs text-secondary break-all">{{ visualMetricsText(item.metrics) }}</p>
          <div class="grid gap-3 md:grid-cols-3">
            <figure v-if="item.baseline?.image">
              <figcaption class="text-xs text-secondary mb-1">基準</figcaption>
              <img :src="`data:image/png;base64,${item.baseline.image}`" class="w-full border rounded" alt="baseline" />
            </figure>
            <figure v-if="item.currentImage">
              <figcaption class="text-xs text-secondary mb-1">本次</figcaption>
              <img :src="`data:image/png;base64,${item.currentImage}`" class="w-full border rounded" alt="current" />
            </figure>
            <figure v-if="item.diffImage">
              <figcaption class="text-xs text-secondary mb-1">差異</figcaption>
              <img :src="`data:image/png;base64,${item.diffImage}`" class="w-full border rounded" alt="diff" />
            </figure>
          </div>
        </div>
      </div>

      <!-- Site audit：最近 20 次去敏感健檢報告 -->
      <div v-if="showAuditReports" class="section-card space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="section-title">Website audit reports</h3>
          <div class="flex gap-3">
            <button class="text-sm underline" :disabled="runningAudit" @click="runAuditNow">{{ runningAudit ? '執行中…' : 'Run audit now' }}</button>
            <button class="text-sm underline" :disabled="loadingAuditReports" @click="loadAuditReports">重新整理</button>
          </div>
        </div>
        <p v-if="auditTrial" class="text-sm text-secondary">上次試跑：{{ auditTrial }}</p>
        <p v-if="loadingAuditReports" class="text-sm text-secondary">載入中…</p>
        <p v-else-if="!auditReports.length" class="text-sm text-secondary">尚無報告。</p>
        <div v-for="(item, index) in auditReports" :key="item.id" class="border rounded-lg p-3 text-sm">
          <div class="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <span class="font-semibold">{{ item.score }}/100</span>
              <span v-if="auditDelta(index) !== null" class="ml-1 text-xs" :class="auditDelta(index)! >= 0 ? 'text-emerald-400' : 'text-red-400'">
                {{ auditDelta(index)! >= 0 ? '▲' : '▼' }} {{ Math.abs(auditDelta(index)!) }}
              </span>
              <span class="badge ml-2" :class="gradeClass(item.grade)">{{ item.grade }}</span>
              <span class="text-secondary ml-2">{{ formatDateTime(item.checkedAt) }}</span>
            </div>
            <button class="text-sm underline" @click="downloadAuditReport(item)">Download JSON</button>
          </div>
          <details class="mt-2">
            <summary class="cursor-pointer text-secondary">檢查項目 ({{ item.report?.checks?.length || 0 }})</summary>
            <ul class="mt-2 space-y-1">
              <li v-for="check in item.report?.checks || []" :key="check.id" class="flex flex-wrap gap-2">
                <span class="font-medium">{{ check.label }}</span>
                <span class="text-tertiary">{{ check.status }}</span>
                <span class="text-secondary">{{ check.summary }}</span>
              </li>
            </ul>
          </details>
        </div>
      </div>

      <!-- Security scan：最近 20 次去敏感弱點報告 -->
      <div v-if="showSecurityReports" class="section-card space-y-3">
        <div class="flex items-center justify-between gap-3">
          <h3 class="section-title">Security scan reports</h3>
          <div class="flex gap-3">
            <button class="text-sm underline" :disabled="runningSecurityScan" @click="runSecurityNow">{{ runningSecurityScan ? '執行中…' : 'Run scan now' }}</button>
            <button class="text-sm underline" :disabled="loadingSecurityReports" @click="loadSecurityReports">重新整理</button>
          </div>
        </div>
        <p v-if="securityTrial" class="text-sm text-secondary">上次試跑：{{ securityTrial }}</p>
        <p v-if="loadingSecurityReports" class="text-sm text-secondary">載入中…</p>
        <p v-else-if="!securityReports.length" class="text-sm text-secondary">尚無報告。</p>
        <div v-for="(item, index) in securityReports" :key="item.id" class="border rounded-lg p-3 text-sm">
          <div class="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <span class="font-semibold">{{ item.score }}/100</span>
              <span v-if="securityDelta(index) !== null" class="ml-1 text-xs" :class="securityDelta(index)! >= 0 ? 'text-emerald-400' : 'text-red-400'">
                {{ securityDelta(index)! >= 0 ? '▲' : '▼' }} {{ Math.abs(securityDelta(index)!) }}
              </span>
              <span class="badge ml-2" :class="gradeClass(item.grade)">{{ item.grade }}</span>
              <span class="badge badge-danger ml-2">{{ item.riskLevel }}</span>
              <span class="text-secondary ml-2">{{ formatDateTime(item.checkedAt) }}</span>
            </div>
            <button class="text-sm underline" @click="downloadSecurityReport(item)">Download JSON</button>
          </div>
          <details class="mt-2">
            <summary class="cursor-pointer text-secondary">Findings ({{ item.report?.findings?.length || 0 }})</summary>
            <ul class="mt-2 space-y-1">
              <li v-for="finding in item.report?.findings || []" :key="finding.key" class="flex flex-wrap gap-2">
                <span class="badge badge-danger">{{ finding.severity }}</span>
                <span class="font-medium">{{ finding.title }}</span>
                <span class="text-secondary">{{ finding.detail }}</span>
              </li>
            </ul>
          </details>
        </div>
      </div>

      <!-- Status & Heartbeat Bar -->
      <div class="card card-body mb-6 card-interactive">
        <div class="flex flex-col lg:flex-row lg:items-center gap-6">
          <div class="flex-1">
            <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Heartbeat History</h3>
            <div class="flex items-center gap-0.5">
              <div
                v-for="(beat, i) in displayHeartbeats"
                :key="i"
                class="heartbeat-bar h-8 w-1.5 rounded-full cursor-pointer"
                :class="[getHeartbeatClass(beat), i === displayHeartbeats.length - 1 && beat?.status === 1 ? 'pulse' : '']"
                :style="{ animationDelay: `${i * 20}ms` }"
                :title="beat ? `${formatDateTime(beat.time)} - ${isScoreMonitor ? `${beat.ping || 0}/100` : `${beat.ping || 0}ms`}` : 'No data'"
              ></div>
            </div>
            <p class="text-xs text-gray-500 mt-2">Check every {{ monitor.interval }} seconds</p>
          </div>
          <div class="text-center lg:text-right">
            <div 
              class="text-5xl font-bold transition-all duration-300" 
              :class="[statusColorClass, latestStatus === 1 ? 'glow-green' : latestStatus === 0 ? 'glow-red' : '']"
            >
              {{ statusText }}
            </div>
            <p v-if="lastHeartbeat" class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Last check: {{ formatDateTime(lastHeartbeat.time) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Statistics Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-600 dark:text-gray-400 mb-1">{{ isScoreMonitor ? 'Audit score' : 'Response Time' }}</div>
          <div class="stat-value text-2xl font-bold text-emerald-400" :key="lastPing">
            <span class="tabular-nums">{{ lastPing === null ? 'N/A' : animatedPing }}</span><span v-if="lastPing !== null" class="text-lg">{{ isScoreMonitor ? '/100' : 'ms' }}</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">Current</div>
        </div>
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-600 dark:text-gray-400 mb-1">{{ isScoreMonitor ? 'Avg score' : 'Avg Response' }}</div>
          <div class="stat-value text-2xl font-bold text-blue-400">
            <span class="tabular-nums">{{ avgPing ?? 'N/A' }}</span><span v-if="avgPing !== null" class="text-lg">{{ isScoreMonitor ? '/100' : 'ms' }}</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">24-hour</div>
        </div>
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-600 dark:text-gray-400 mb-1">Uptime</div>
          <div class="stat-value text-2xl font-bold" :class="uptime24hColor">
            <span class="tabular-nums">{{ uptime24h }}</span><span v-if="uptime24h !== 'N/A'" class="text-lg">%</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">24-hour</div>
        </div>
        <div class="stat-card card-interactive">
          <div class="stat-label text-sm text-gray-600 dark:text-gray-400 mb-1">Uptime</div>
          <div class="stat-value text-2xl font-bold" :class="uptime30dColor">
            <span class="tabular-nums">{{ uptime30d }}</span><span v-if="uptime30d !== 'N/A'" class="text-lg">%</span>
          </div>
          <div class="text-xs text-gray-500 mt-1">30-day</div>
        </div>
      </div>

      <!-- Push endpoint -->
      <div v-if="monitor?.type === 'push'" class="card card-body mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Push URL</h3>
            <p class="text-sm text-gray-500 mt-1">Send GET or POST requests here to record a heartbeat. Treat this URL as a secret.</p>
          </div>
          <button v-if="canEdit" class="btn btn-secondary" @click="copyPushUrl">{{ $t('Copy URL') }}</button>
        </div>
        <p v-if="pushUrlLoading" class="text-sm text-secondary mt-3">Loading…</p>
        <code v-else-if="pushUrl" class="block break-all text-sm text-primary mt-3">{{ pushUrl }}</code>
        <p v-else-if="pushUrlError" role="alert" class="text-sm text-red-400 mt-3">{{ pushUrlError }}</p>
      </div>

      <!-- Response Time Chart -->
      <div class="card card-body mb-6">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ isScoreMonitor ? 'Audit score' : 'Response Time' }} ({{ chartPeriodLabel }})</h3>
          <div class="flex gap-1">
            <button v-for="p in chartPeriods" :key="p.value" class="btn btn-secondary text-xs" :class="chartPeriod===p.value?'ring-2 ring-primary':''" @click="chartPeriod=p.value">{{ p.label }}</button>
          </div>
        </div>
        <div v-if="chartPoints" class="relative pl-14">
          <svg viewBox="0 0 800 180" preserveAspectRatio="none" class="w-full h-48 overflow-visible" role="img" aria-label="Response time chart">
            <defs>
              <linearGradient id="responseTimeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#5cdd8b" stop-opacity="0.35" />
                <stop offset="100%" stop-color="#5cdd8b" stop-opacity="0" />
              </linearGradient>
            </defs>
            <line v-for="y in [20, 65, 110, 155]" :key="y" x1="0" :y1="y" x2="800" :y2="y" stroke="currentColor" stroke-opacity="0.12" stroke-width="1" />
            <path :d="chartPoints.area" fill="url(#responseTimeFill)" />
            <path :d="chartPoints.line" fill="none" stroke="#5cdd8b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
            <circle v-for="(point, i) in chartPoints.points" :key="i" :cx="point.x" :cy="point.y" r="3.5" :fill="point.down ? '#f87171' : '#5cdd8b'" stroke="#0b1622" stroke-width="1.5">
              <title>{{ point.label }}: {{ point.ping }}{{ isScoreMonitor ? '/100' : 'ms' }}</title>
            </circle>
          </svg>
          <div class="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-500 pointer-events-none">
            <span>{{ maxPing }}{{ isScoreMonitor ? '/100' : 'ms' }}</span>
            <span>{{ Math.round(maxPing / 2) }}{{ isScoreMonitor ? '/100' : 'ms' }}</span>
            <span>{{ isScoreMonitor ? '0/100' : '0ms' }}</span>
          </div>
        </div>
        <div v-else class="h-48 flex items-center justify-center text-sm text-secondary">
          No response data in this period.
        </div>
        <div v-if="chartPoints" class="flex justify-between text-xs text-gray-500 pl-14 mt-1">
          <span>{{ chartPoints.startLabel }}</span>
          <span>{{ chartPoints.endLabel }}</span>
        </div>
      </div>

      <!-- TLS Certificate Info (for HTTPS monitors) -->
      <div v-if="showTlsInfo" class="card card-body mb-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">TLS/SSL Certificate</h3>
          <button @click="refreshCertInfo" class="btn btn-secondary btn-sm" :disabled="loadingCert">
            <UIcon name="i-heroicons-arrow-path" class="w-4 h-4" :class="{ 'animate-spin': loadingCert }" />
          </button>
        </div>
        
        <div v-if="loadingCert" class="flex items-center justify-center py-8">
          <div class="spinner w-6 h-6"></div>
        </div>
        
        <div v-else-if="certInfo && certInfo.hasCertificate" class="space-y-4">
          <!-- Certificate Status -->
          <div class="flex items-center gap-3">
            <div class="p-3 rounded-lg" :class="certStatusClass">
              <UIcon :name="certStatusIcon" class="w-8 h-8" />
            </div>
            <div>
              <div class="font-medium text-gray-900 dark:text-gray-100">
                {{ certInfo.certificate.valid ? 'Valid Certificate' : 'Invalid Certificate' }}
              </div>
              <div class="text-sm" :class="certDaysClass">
                {{ certDaysMessage }}
              </div>
            </div>
          </div>

          <!-- Certificate Details -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-700">
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Subject</div>
              <div class="text-sm text-gray-700 dark:text-gray-300 font-mono break-all">{{ certInfo.certificate.subject }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Issuer</div>
              <div class="text-sm text-gray-700 dark:text-gray-300 font-mono break-all">{{ certInfo.certificate.issuer }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Valid From</div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ formatDate(certInfo.certificate.validFrom) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Valid To</div>
              <div class="text-sm text-gray-700 dark:text-gray-300">{{ formatDate(certInfo.certificate.validTo) }}</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Days Remaining</div>
              <div class="text-sm font-bold" :class="certDaysClass">{{ certInfo.certificate.daysRemaining }} days</div>
            </div>
            <div>
              <div class="text-xs text-gray-500 uppercase mb-1">Fingerprint</div>
              <div class="text-sm text-gray-700 dark:text-gray-300 font-mono truncate">{{ certInfo.certificate.fingerprint }}</div>
            </div>
          </div>

          <!-- Subject Alt Names -->
          <div v-if="certInfo.certificate.subjectAltName?.length" class="pt-4 border-t border-gray-700">
            <div class="text-xs text-gray-500 uppercase mb-2">Subject Alternative Names</div>
            <div class="flex flex-wrap gap-2">
              <span 
                v-for="(san, idx) in certInfo.certificate.subjectAltName" 
                :key="idx"
                class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 font-mono"
              >
                {{ san }}
              </span>
            </div>
          </div>
        </div>
        
        <div v-else class="text-center py-8 text-gray-500">
          <UIcon name="i-heroicons-shield-exclamation" class="w-8 h-8 mx-auto mb-2" />
          <p>{{ certInfo?.message || 'Unable to retrieve certificate information' }}</p>
        </div>
      </div>

      <button v-if="historyCursor" class="btn btn-secondary mb-4" :disabled="loadingHistory" @click="loadMoreHistory">Load older heartbeats</button>
      <!-- Important Events Table -->
      <div class="card mb-6">
        <div class="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Important Events</h3>
          <span class="text-sm text-gray-400">{{ importantHeartbeats.length }} events</span>
        </div>
        <div class="overflow-x-auto">
          <table class="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>DateTime</th>
                <th>Response</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(beat, index) in paginatedHeartbeats" :key="index" class="hover:bg-gray-100 dark:hover:bg-gray-700/50">
                <td>
                  <span :class="getStatusBadgeClass(beat.status)" class="badge">
                    {{ getStatusText(beat.status) }}
                  </span>
                </td>
                <td class="text-gray-600 dark:text-gray-400">{{ formatDateTime(beat.time) }}</td>
                <td class="text-gray-600 dark:text-gray-400">{{ beat.ping ? `${beat.ping}ms` : '-' }}</td>
                <td class="text-gray-600 dark:text-gray-400 max-w-xs truncate">{{ beat.msg || '-' }}</td>
              </tr>
              <tr v-if="importantHeartbeats.length === 0">
                <td colspan="4" class="text-center text-gray-500 py-8">
                  <UIcon name="i-heroicons-check-circle" class="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  <p>No important events</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex items-center justify-center gap-4 p-4 border-t border-gray-700">
          <button 
            @click="currentPage--" 
            :disabled="currentPage <= 1"
            class="btn btn-secondary btn-sm"
          >
            Previous
          </button>
          <span class="text-sm text-gray-400">Page {{ currentPage }} of {{ totalPages }}</span>
          <button 
            @click="currentPage++" 
            :disabled="currentPage >= totalPages"
            class="btn btn-secondary btn-sm"
          >
            Next
          </button>
        </div>
      </div>
    </div>
    </Transition>

    <!-- Delete Confirmation Modal -->
    <Transition name="fade">
    <div v-if="showDeleteConfirm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="showDeleteConfirm = false">
      <Transition name="scale">
      <div class="card card-body max-w-md w-full mx-4">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Delete Monitor</h3>
        <p class="text-gray-400 mb-6">Are you sure you want to delete "{{ monitor?.name }}"? This action cannot be undone.</p>
        <div class="flex justify-end gap-3">
          <button @click="showDeleteConfirm = false" class="btn btn-secondary">Cancel</button>
          <button @click="confirmDelete" :disabled="deleting" class="btn btn-danger">
            {{ deleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
      </Transition>
    </div>
    </Transition>

    <!-- Investigation evidence bundle -->
    <div v-if="investigationOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" @click.self="investigationOpen = false">
      <div class="card w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 class="text-lg font-semibold text-highlighted">Investigation bundle</h2>
            <p class="text-sm text-toned mt-1">Evidence from heartbeats, TLS, audit reports and alert delivery. No secrets included.</p>
          </div>
          <button class="text-toned hover:text-highlighted text-xl leading-none" aria-label="Close" @click="investigationOpen = false">&times;</button>
        </div>
        <p v-if="investigationError" role="alert" class="text-sm text-red-400">{{ investigationError }}</p>
        <template v-if="investigation">
          <pre class="text-xs text-toned whitespace-pre-wrap break-all bg-[var(--bg-secondary)] rounded p-3 max-h-64 overflow-auto">{{ investigation.agentHint }}</pre>
          <div class="grid gap-3 md:grid-cols-3 mt-4 text-sm">
            <div class="card card-body !p-3">
              <div class="text-xs text-tertiary">Latest</div>
              <div class="font-medium text-highlighted">{{ investigation.latest?.checkCode || '—' }}</div>
              <div class="text-xs text-toned">{{ investigation.latest?.time || '' }}</div>
            </div>
            <div class="card card-body !p-3">
              <div class="text-xs text-tertiary">Recent DOWN</div>
              <div class="font-medium text-highlighted">{{ investigation.heartbeats.filter((beat: any) => beat.status === 0).length }} / {{ investigation.heartbeats.length }}</div>
            </div>
            <div class="card card-body !p-3">
              <div class="text-xs text-tertiary">TLS days left</div>
              <div class="font-medium text-highlighted">{{ investigation.tls?.daysRemaining ?? '—' }}</div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button class="btn btn-secondary" @click="downloadInvestigation">Download JSON</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Badge Generator Modal -->
    <MonitorBadgeGeneratorModal 
      v-if="monitor"
      v-model="showBadgeGenerator" 
      :monitor-id="monitorId" 
      :monitor-name="monitor.name" 
    />

  </div>
</template>

<script setup lang="ts">
const { canEdit, canManage } = useWorkspace()
const { pathOf, load: loadGroups } = useMonitorGroups()

definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { t } = (useI18n as any)()
const { $socket } = useNuxtApp()

const monitorId = computed(() => Number(route.params.id))
const monitor = ref<any>(null)
const exportingBruno = ref(false)

async function exportToBruno() {
  exportingBruno.value = true
  try {
    const result = await downloadBruno({ ids: monitor.value.id })
    toast.add({ title: `Downloaded ${result.name}`, description: result.secretNames.length ? `Set these secrets in Bruno: ${result.secretNames.join(', ')}.` : undefined, color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Export failed', description: error.message, color: 'error' })
  } finally {
    exportingBruno.value = false
  }
}

onMounted(() => { loadGroups().catch(() => {}) })
const heartbeats = ref<any[]>([])
const loading = ref(true)
const deleting = ref(false)
const cloning = ref(false)
const checkingNow = ref(false)
const pushUrl = ref('')
const pushUrlLoading = ref(false)
const pushUrlError = ref('')
const showDeleteConfirm = ref(false)
const showBadgeGenerator = ref(false)
const currentPage = ref(1)
const perPage = 25

// Visual diff 證據
const visualArtifacts = ref<any[]>([])
const loadingVisual = ref(false)
const acceptingViewport = ref('')
const investigationOpen = ref(false)
const investigation = ref<any>(null)
const loadingInvestigation = ref(false)
const investigationError = ref('')
async function openInvestigation(): Promise<void> {
  investigationOpen.value = true
  investigation.value = null
  investigationError.value = ''
  loadingInvestigation.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/investigation`)
    investigation.value = res.data
  } catch (error: any) {
    investigationError.value = error?.data?.message || error?.message || 'Failed to load investigation.'
  } finally {
    loadingInvestigation.value = false
  }
}
function downloadInvestigation(): void {
  if (!investigation.value) return
  const blob = new Blob([JSON.stringify(investigation.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `investigation-${monitorId.value}-${Date.now()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

const showVisualPanel = computed(() => ['visual-diff', 'browser-flow'].includes(monitor.value?.type))
// site-audit 的心跳 ping 是 0–100 分數，不是毫秒。
const isScoreMonitor = computed(() => ['site-audit', 'security-scan'].includes(monitor.value?.type || ''))
const showAuditReports = computed(() => monitor.value?.type === 'site-audit')
const showSecurityReports = computed(() => monitor.value?.type === 'security-scan')
const securityReports = ref<any[]>([])
const loadingSecurityReports = ref(false)
const runningSecurityScan = ref(false)
const securityTrial = ref('')
const auditReports = ref<any[]>([])
const loadingAuditReports = ref(false)
const runningAudit = ref(false)
const auditTrial = ref('')
async function runAuditNow() {
  if (!monitor.value || runningAudit.value) return
  runningAudit.value = true
  auditTrial.value = ''
  try {
    let config: any = {}
    try { config = JSON.parse(monitor.value.body || '{}') } catch { config = {} }
    const res = await $fetch<any>('/api/v1/monitors/test', {
      method: 'POST',
      body: { ...monitor.value, url: config.url || monitor.value.url, type: 'site-audit' },
    })
    auditTrial.value = `${res.data?.msg || 'done'} · ${res.data?.code || ''} (score ${res.data?.ping ?? '—'})`
  } catch (error: any) {
    auditTrial.value = error?.data?.message || error?.message || 'Audit failed.'
  } finally {
    runningAudit.value = false
  }
}
async function loadAuditReports() {
  if (!showAuditReports.value) return
  loadingAuditReports.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/audit-reports`, { query: { limit: 20 } })
    auditReports.value = res?.data || []
  } catch {
    auditReports.value = []
  } finally {
    loadingAuditReports.value = false
  }
}
function auditDelta(index: number): number | null {
  const current = auditReports.value[index], previous = auditReports.value[index + 1]
  if (!current || !previous || typeof current.score !== 'number' || typeof previous.score !== 'number') return null
  return current.score - previous.score
}
function gradeClass(grade: string | null): string {
  return grade === 'A' ? 'badge-success' : grade === 'B' ? 'badge-info' : grade === 'C' ? 'badge-warning' : 'badge-danger'
}
function downloadAuditReport(item: any) {
  const blob = new Blob([JSON.stringify(item.report ?? item, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `audit-${monitorId.value}-${item.id}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
async function runSecurityNow() {
  if (!monitor.value || runningSecurityScan.value) return
  runningSecurityScan.value = true
  securityTrial.value = ''
  try {
    let config: any = {}
    try { config = JSON.parse(monitor.value.body || '{}') } catch { config = {} }
    const res = await $fetch<any>('/api/v1/monitors/test', {
      method: 'POST',
      body: { ...monitor.value, url: config.url || monitor.value.url, type: 'security-scan' },
    })
    securityTrial.value = `${res.data?.msg || 'done'} · ${res.data?.code || ''} · ${res.data?.detail || ''}`
    void loadSecurityReports()
  } catch (error: any) {
    securityTrial.value = error?.data?.message || error?.message || 'Scan failed.'
  } finally {
    runningSecurityScan.value = false
  }
}
async function loadSecurityReports() {
  if (!showSecurityReports.value) return
  loadingSecurityReports.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/security-reports`, { query: { limit: 20 } })
    securityReports.value = res?.data || []
  } catch {
    securityReports.value = []
  } finally {
    loadingSecurityReports.value = false
  }
}
function securityDelta(index: number): number | null {
  const current = securityReports.value[index], previous = securityReports.value[index + 1]
  if (!current || !previous || typeof current.score !== 'number' || typeof previous.score !== 'number') return null
  return current.score - previous.score
}
function downloadSecurityReport(item: any) {
  const blob = new Blob([JSON.stringify(item.report ?? item, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `security-${monitorId.value}-${item.id}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
const latestVisualByViewport = computed(() => {
  const seen = new Set<string>()
  return visualArtifacts.value.filter((item) => {
    const label = String(item.viewportLabel || '')
    if (!label || seen.has(label)) return false
    seen.add(label)
    return true
  })
})
const visualMetricsText = (metrics: any) => {
  if (!metrics) return ''
  if (Array.isArray(metrics.flowSteps)) {
    const steps = metrics.flowSteps.map((step: any) => `#${step.index} ${step.action}:${step.status}${step.detail ? `(${step.detail})` : ''}`)
    return `${metrics.code || 'FLOW_FAILED'} · ${steps.join(' · ')}`.slice(0, 500)
  }
  const parts = [
    `HTTP ${metrics.httpStatus ?? '?'}`,
    `水平溢出 ${metrics.overflow ?? 0}px`,
    ...(metrics.brokenImages?.length ? [`破圖 ${metrics.brokenImages.length}`] : []),
    ...(metrics.pageErrors?.length ? [`JS 錯誤 ${metrics.pageErrors.length}`] : []),
  ]
  const required = (metrics.required || []).map((rule: any) => `${rule.selector}: ${rule.visibleCount}/${rule.count}`)
  if (required.length) parts.push(required.join(', '))
  return parts.join(' · ')
}
async function loadVisualArtifacts() {
  if (!showVisualPanel.value) return
  loadingVisual.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/visual-artifacts`, { query: { limit: 20 } })
    visualArtifacts.value = res?.data || []
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || '無法載入視覺差異', color: 'error' })
  } finally {
    loadingVisual.value = false
  }
}
async function acceptBaseline(viewportLabel: string) {
  acceptingViewport.value = viewportLabel
  try {
    await $fetch(`/api/v1/monitors/${monitorId.value}/visual-baselines/accept`, {
      method: 'POST',
      body: { viewportLabel },
    })
    toast.add({ title: '已接受新基準', description: `${viewportLabel} 的基準已更新`, color: 'success' })
    await loadVisualArtifacts()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || '接受基準失敗', color: 'error' })
  } finally {
    acceptingViewport.value = ''
  }
}

// TLS Certificate info
const certInfo = ref<any>(null)
const loadingCert = ref(false)

// Show TLS info only for HTTPS monitors
const showTlsInfo = computed(() => {
  return monitor.value?.tlsConfigured
})

// Cert status classes
const certStatusClass = computed(() => {
  if (!certInfo.value?.certificate) return 'bg-gray-700'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0) return 'bg-red-600/20 text-red-400'
  if (days <= 7) return 'bg-red-600/20 text-red-400'
  if (days <= 14) return 'bg-orange-600/20 text-orange-400'
  if (days <= 30) return 'bg-yellow-600/20 text-yellow-400'
  return 'bg-emerald-600/20 text-emerald-400'
})

const certStatusIcon = computed(() => {
  if (!certInfo.value?.certificate) return 'i-heroicons-shield-exclamation'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0 || !certInfo.value.certificate.valid) return 'i-heroicons-x-circle'
  if (days <= 14) return 'i-heroicons-exclamation-triangle'
  return 'i-heroicons-shield-check'
})

const certDaysClass = computed(() => {
  if (!certInfo.value?.certificate) return 'text-gray-400'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0) return 'text-red-400'
  if (days <= 7) return 'text-red-400'
  if (days <= 14) return 'text-orange-400'
  if (days <= 30) return 'text-yellow-400'
  return 'text-emerald-400'
})

const certDaysMessage = computed(() => {
  if (!certInfo.value?.certificate) return 'Unknown'
  const days = certInfo.value.certificate.daysRemaining
  if (days < 0) return `Expired ${Math.abs(days)} days ago`
  if (days === 0) return 'Expires today!'
  if (days === 1) return 'Expires tomorrow'
  return `Expires in ${days} days`
})

const refreshCertInfo = async () => {
  if (!showTlsInfo.value) return
  loadingCert.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/certificate`)
    certInfo.value = res
  } catch (error) {
    console.error('Failed to fetch certificate info:', error)
  } finally {
    loadingCert.value = false
  }
}

const formatDate = (date: string | Date | null) => {
  if (!date) return 'N/A'
  return formatInTimezone(date)
}

const uptimeData=ref<any>(null),historyCursor=ref<string|null>(null),loadingHistory=ref(false)
async function loadMoreHistory(){if(!historyCursor.value||loadingHistory.value)return;loadingHistory.value=true;try{const result=await $fetch<any>(`/api/v1/monitors/${monitorId.value}/heartbeats`,{query:{cursor:historyCursor.value}});const seen=new Set(heartbeats.value.map((beat:any)=>beat.id));heartbeats.value.push(...result.data.filter((beat:any)=>!seen.has(beat.id)));historyCursor.value=result.page.nextCursor}finally{loadingHistory.value=false}}
// Fetch data
onMounted(async () => {
  try {
    const [monitorRes,heartbeatsRes,uptimeRes]=await Promise.all([
      $fetch<any>(`/api/v1/monitors/${monitorId.value}`),
      $fetch<any>(`/api/v1/monitors/${monitorId.value}/heartbeats?limit=50`),
      $fetch<any>(`/api/v1/monitors/${monitorId.value}/uptime`)
    ])
    uptimeData.value=uptimeRes.data.uptime
    historyCursor.value=heartbeatsRes.page.nextCursor
    monitor.value = monitorRes.data || monitorRes
    heartbeats.value = heartbeatsRes.data || heartbeatsRes || []
    void loadPushUrl()
    void loadPingSeries()
    void loadVisualArtifacts()
    void loadAuditReports()
    void loadSecurityReports()

    // Fetch certificate info for HTTPS monitors
    if (monitor.value?.tlsConfigured) {
      refreshCertInfo()
    }
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to load monitor', color: 'error' })
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
  
  // WebSocket subscription
  if ($socket) {
    const socket = $socket.connect()
    socket?.emit('subscribe_monitor', monitorId.value)
    
    socket?.on('heartbeat', (data: any) => {
      if (data.monitorId === monitorId.value) {
        try{if(heartbeats.value[0]?.id&&BigInt(data.heartbeat.id)<=BigInt(heartbeats.value[0].id))return}catch{}
        // Add new heartbeat with animation flag
        const newHeartbeat = { ...data.heartbeat, isNew: true }
        heartbeats.value.unshift(newHeartbeat)
        
        // Remove animation flag after animation completes
        setTimeout(() => {
          if (heartbeats.value[0]?.id === newHeartbeat.id) {
            heartbeats.value[0].isNew = false
          }
        }, 500)
        
        // Keep max 1000 heartbeats
        if (heartbeats.value.length > 1000) {
          heartbeats.value = heartbeats.value.slice(0, 1000)
        }
        
        console.log(`[Socket] Received heartbeat for monitor ${data.monitorId}: status=${data.heartbeat.status}`)
      }
    })
    
    socket?.on('connect', () => {
      console.log('[Socket] Connected, subscribing to monitor', monitorId.value)
      socket?.emit('subscribe_monitor', monitorId.value)
    })
  }
})

onUnmounted(() => {
  if ($socket) {
    const socket = $socket.getSocket()
    socket?.emit('unsubscribe_monitor', monitorId.value)
  }
})

// Computed
const lastHeartbeat = computed(() => heartbeats.value[0])

// Latest status for animation classes
const latestStatus = computed(() => lastHeartbeat.value?.status ?? null)

// Animated ping value with transition effect
const animatedPing = ref(0)
watch(() => lastHeartbeat.value?.ping, (newPing) => {
  if (newPing !== undefined && newPing !== null) {
    // Animate the ping value
    const start = animatedPing.value
    const end = newPing
    const duration = 300
    const startTime = Date.now()
    
    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      animatedPing.value = Math.round(start + (end - start) * progress)
      
      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }
    animate()
  }
}, { immediate: true })

const statusText = computed(() => {
  if (!monitor.value?.active) return 'PAUSED'
  if (!lastHeartbeat.value) return 'PENDING'
  switch (lastHeartbeat.value.status) {
    case 1: return 'UP'
    case 0: return 'DOWN'
    case 3: return 'MAINTENANCE'
    default: return 'UNKNOWN'
  }
})

const statusBadgeClass = computed(() => {
  if (!monitor.value?.active) return 'bg-gray-600 text-white'
  if (!lastHeartbeat.value) return 'bg-yellow-600 text-white'
  switch (lastHeartbeat.value.status) {
    case 1: return 'badge-success'
    case 0: return 'badge-danger'
    case 3: return 'badge-info'
    default: return 'bg-gray-600 text-white'
  }
})

const statusColorClass = computed(() => {
  if (!monitor.value?.active) return 'text-gray-400'
  if (!lastHeartbeat.value) return 'text-yellow-400'
  switch (lastHeartbeat.value.status) {
    case 1: return 'text-emerald-400'
    case 0: return 'text-red-400'
    case 3: return 'text-blue-400'
    default: return 'text-gray-400'
  }
})

const lastPing = computed(() => lastHeartbeat.value?.ping ?? null)
const avgPing = computed(() => uptimeData.value?.['24h']?.avgPing ?? null)

const maxPing = computed(() => {
  const source = pingSeries.value.length ? pingSeries.value : heartbeats.value
  const max = Math.max(...source.map((h: any) => h.ping || 0), 100)
  return Math.ceil(max / 100) * 100
})

const uptime24h=computed(()=>uptimeData.value?.['24h']?.uptime?.toFixed(2)??'N/A')
const uptime30d=computed(()=>uptimeData.value?.['30d']?.uptime?.toFixed(2)??'N/A')
const uptime24hColor = computed(() => {
  const val = parseFloat(uptime24h.value)
  if(!Number.isFinite(val))return 'text-gray-400'
  if (val >= 99) return 'text-emerald-400'
  if (val >= 95) return 'text-yellow-400'
  return 'text-red-400'
})

const uptime30dColor = computed(() => {
  const val = parseFloat(uptime30d.value)
  if(!Number.isFinite(val))return 'text-gray-400'
  if (val >= 99) return 'text-emerald-400'
  if (val >= 95) return 'text-yellow-400'
  return 'text-red-400'
})

const displayHeartbeats = computed(() => {
  const result = []
  for (let i = 0; i < 50; i++) {
    result.push(heartbeats.value[i] || null)
  }
  return result.reverse()
})

const chartHeartbeats = computed(() => {
  if (pingSeries.value.length) {
    return pingSeries.value.map(row => ({ time: row.time, ping: row.ping, status: row.down > 0 ? 0 : 1 }))
  }
  const result = []
  for (let i = 0; i < 100; i++) {
    result.push(heartbeats.value[i] || null)
  }
  return result.reverse()
})

const chartPeriods = [
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
] as const
const chartPeriod = ref<'24h' | '7d' | '30d'>('24h')
const chartPeriodLabel = computed(() => chartPeriod.value === '24h' ? 'Last 24 Hours' : chartPeriod.value === '7d' ? 'Last 7 Days' : 'Last 30 Days')
const pingSeries = ref<Array<{ time: string; ping: number; count: number; down: number }>>([])

async function loadPingSeries() {
  try {
    const result = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/ping-series`, { query: { period: chartPeriod.value } })
    pingSeries.value = result?.data || []
  } catch {
    pingSeries.value = []
  }
}
watch(chartPeriod, loadPingSeries)

const chartPoints = computed(() => {
  const beats = chartHeartbeats.value.filter((beat: any) => beat && Number.isFinite(Number(beat.ping)))
  if (!beats.length) return null
  const max = Math.max(maxPing.value, 1)
  const top = 14, bottom = 158
  const xOf = (index: number) => beats.length === 1 ? 400 : (index / (beats.length - 1)) * 800
  const yOf = (value: number) => top + (1 - Math.min(value, max) / max) * (bottom - top)
  const points = beats.map((beat: any, index: number) => ({
    x: xOf(index),
    y: yOf(Number(beat.ping)),
    ping: Math.round(Number(beat.ping)),
    down: beat.status === 0,
    label: formatDateTime(beat.time),
  }))
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')
  const area = `${line} L800,${bottom} L0,${bottom} Z`
  return {
    points,
    line,
    area,
    startLabel: points[0]?.label || '',
    endLabel: points[points.length - 1]?.label || '',
  }
})

const importantHeartbeats = computed(() => {
  return heartbeats.value.filter(h => h.important || h.status === 0 || h.status === 3)
})

const totalPages = computed(() => Math.ceil(importantHeartbeats.value.length / perPage))

const paginatedHeartbeats = computed(() => {
  const start = (currentPage.value - 1) * perPage
  return importantHeartbeats.value.slice(start, start + perPage)
})

// Methods
const { format: formatInTimezone } = useDisplayTimezone()
const formatDateTime = (time: string) => formatInTimezone(time)

const getChartHeight = (beat: any) => {
  if (!beat || !beat.ping) return '5%'
  const percentage = Math.min((beat.ping / maxPing.value) * 100, 100)
  return `${Math.max(percentage, 5)}%`
}

const getHeartbeatClass = (beat: any) => {
  if (!beat) return 'bg-gray-700'
  switch (beat.status) {
    case 1: return 'bg-emerald-500'
    case 0: return 'bg-red-500'
    case 3: return 'bg-blue-500'
    default: return 'bg-gray-500'
  }
}

const getStatusBadgeClass = (status: number) => {
  switch (status) {
    case 1: return 'badge-success'
    case 0: return 'badge-danger'
    case 3: return 'badge-info'
    default: return 'bg-gray-600'
  }
}

const getStatusText = (status: number) => {
  switch (status) {
    case 1: return 'UP'
    case 0: return 'DOWN'
    case 3: return 'MAINTENANCE'
    default: return 'UNKNOWN'
  }
}

async function loadPushUrl() {
  if (monitor.value?.type !== 'push' || !canEdit.value) return
  pushUrlLoading.value = true
  pushUrlError.value = ''
  try {
    const result = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/push-url`)
    pushUrl.value = result?.url || ''
  } catch (e: any) {
    pushUrlError.value = e.data?.message || 'Unable to load push URL'
  } finally {
    pushUrlLoading.value = false
  }
}

async function copyPushUrl() {
  if (!pushUrl.value) await loadPushUrl()
  if (!pushUrl.value) return
  try {
    await navigator.clipboard.writeText(pushUrl.value)
    toast.add({ title: t('Push URL copied'), color: 'success' })
  } catch {
    toast.add({ title: 'Copy failed', description: 'Select the URL and copy it manually.', color: 'error' })
  }
}

const checkNow = async () => {
  checkingNow.value = true
  try {
    const result = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/check-now`, { method: 'POST' })
    toast.add({ title: result.message === 'Check queued' ? t('Check queued') : (result.message || t('Check queued')), description: result.data?.code, color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || t('A check is already running for this monitor'), color: 'error' })
  } finally {
    checkingNow.value = false
  }
}

const pauseMonitor = async () => {
  try {
    await $fetch(`/api/v1/monitors/${monitorId.value}/pause`, { method: 'POST' })
    monitor.value.active = false
    toast.add({ title: 'Monitor paused', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to pause', color: 'error' })
  }
}

const resumeMonitor = async () => {
  try {
    await $fetch(`/api/v1/monitors/${monitorId.value}/resume`, { method: 'POST' })
    monitor.value.active = true
    toast.add({ title: 'Monitor resumed', color: 'success' })
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to resume', color: 'error' })
  }
}

const cloneMonitor = async () => {
  cloning.value = true
  try {
    const res = await $fetch<any>(`/api/v1/monitors/${monitorId.value}/clone`, { method: 'POST' })
    toast.add({ title: 'Monitor cloned', description: 'Redirecting to cloned monitor...', color: 'success' })
    router.push(`/monitors/${res.data.id}`)
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to clone', color: 'error' })
  } finally {
    cloning.value = false
  }
}

const confirmDelete = async () => {
  deleting.value = true
  try {
    await $fetch(`/api/v1/monitors/${monitorId.value}`, { method: 'DELETE' })
    toast.add({ title: 'Monitor deleted', color: 'success' })
    router.push('/dashboard')
  } catch (e: any) {
    toast.add({ title: 'Error', description: e.data?.message || 'Failed to delete', color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

<style scoped>
.origin-chip { display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.1rem 0.55rem; border-radius: 999px; border: 1px solid var(--border-color); color: var(--text-secondary); }
.origin-chip.warning { border-color: rgba(245, 159, 11, 0.5); background: rgba(245, 159, 11, 0.1); color: var(--text-primary); }
</style>
