<script setup lang="ts">
interface CertificateInfo {
  valid: boolean
  validFrom: string
  validTo: string
  daysRemaining: number
  issuer: string
  subject: string
  fingerprint?: string
}

interface Props {
  certificate: CertificateInfo | null
}

const props = defineProps<Props>()

const expiryStatus = computed(() => {
  if (!props.certificate) return null
  
  const days = props.certificate.daysRemaining
  if (days < 0) return { label: 'Expired', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' }
  if (days <= 7) return { label: `Expires in ${days} days`, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' }
  if (days <= 30) return { label: `Expires in ${days} days`, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30' }
  return { label: `${days} days remaining`, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' }
})

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <div v-if="certificate" class="space-y-4">
    <!-- Expiry Status Banner -->
    <div
      v-if="expiryStatus"
      :class="['p-3 rounded-lg flex items-center gap-2', expiryStatus.bg]"
    >
      <UIcon
        :name="certificate.daysRemaining <= 7 ? 'i-heroicons-exclamation-triangle' : 'i-heroicons-shield-check'"
        :class="['w-5 h-5', expiryStatus.color]"
      />
      <span :class="['font-medium', expiryStatus.color]">
        {{ expiryStatus.label }}
      </span>
    </div>

    <!-- Certificate Details -->
    <div class="grid gap-3">
      <!-- Subject -->
      <div class="flex items-start gap-3">
        <div class="w-32 text-sm text-gray-500 dark:text-gray-400">Subject</div>
        <div class="flex-1 font-mono text-sm break-all">{{ certificate.subject }}</div>
      </div>

      <!-- Issuer -->
      <div class="flex items-start gap-3">
        <div class="w-32 text-sm text-gray-500 dark:text-gray-400">Issuer</div>
        <div class="flex-1 font-mono text-sm break-all">{{ certificate.issuer }}</div>
      </div>

      <!-- Valid From -->
      <div class="flex items-start gap-3">
        <div class="w-32 text-sm text-gray-500 dark:text-gray-400">Valid From</div>
        <div class="flex-1 text-sm">{{ formatDate(certificate.validFrom) }}</div>
      </div>

      <!-- Valid To -->
      <div class="flex items-start gap-3">
        <div class="w-32 text-sm text-gray-500 dark:text-gray-400">Valid To</div>
        <div class="flex-1 text-sm">{{ formatDate(certificate.validTo) }}</div>
      </div>

      <!-- Fingerprint -->
      <div v-if="certificate.fingerprint" class="flex items-start gap-3">
        <div class="w-32 text-sm text-gray-500 dark:text-gray-400">Fingerprint</div>
        <div class="flex-1 font-mono text-xs break-all text-gray-600 dark:text-gray-400">
          {{ certificate.fingerprint }}
        </div>
      </div>
    </div>
  </div>

  <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
    <UIcon name="i-heroicons-shield-exclamation" class="w-12 h-12 mx-auto mb-2 opacity-50" />
    <p>No certificate information available</p>
  </div>
</template>
