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
  if (days < 0) return { label: 'Expired', color: 'text-down-fg', bg: 'bg-down-subtle' }
  if (days <= 7) return { label: `Expires in ${days} days`, color: 'text-down-fg', bg: 'bg-down-subtle' }
  if (days <= 30) return { label: `Expires in ${days} days`, color: 'text-pending-fg', bg: 'bg-pending-subtle' }
  return { label: `${days} days remaining`, color: 'text-up-fg', bg: 'bg-up-subtle' }
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
        <div class="w-32 text-sm text-muted">Subject</div>
        <div class="flex-1 font-mono text-sm break-all">{{ certificate.subject }}</div>
      </div>

      <!-- Issuer -->
      <div class="flex items-start gap-3">
        <div class="w-32 text-sm text-muted">Issuer</div>
        <div class="flex-1 font-mono text-sm break-all">{{ certificate.issuer }}</div>
      </div>

      <!-- Valid From -->
      <div class="flex items-start gap-3">
        <div class="w-32 text-sm text-muted">Valid From</div>
        <div class="flex-1 text-sm">{{ formatDate(certificate.validFrom) }}</div>
      </div>

      <!-- Valid To -->
      <div class="flex items-start gap-3">
        <div class="w-32 text-sm text-muted">Valid To</div>
        <div class="flex-1 text-sm">{{ formatDate(certificate.validTo) }}</div>
      </div>

      <!-- Fingerprint -->
      <div v-if="certificate.fingerprint" class="flex items-start gap-3">
        <div class="w-32 text-sm text-muted">Fingerprint</div>
        <div class="flex-1 font-mono text-xs break-all text-toned">
          {{ certificate.fingerprint }}
        </div>
      </div>
    </div>
  </div>

  <div v-else class="text-center py-8 text-muted">
    <UIcon name="i-heroicons-shield-exclamation" class="w-12 h-12 mx-auto mb-2 opacity-50" />
    <p>No certificate information available</p>
  </div>
</template>
