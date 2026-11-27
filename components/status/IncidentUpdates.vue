<script setup lang="ts">
/** Public timeline of incident progress updates. */
interface IncidentUpdate {
  id: number
  status: string
  message: string
  createdDate: string
}

const props = defineProps<{ updates?: IncidentUpdate[] | null; compact?: boolean }>()

const labels: Record<string, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
  update: 'Update',
}
const label = (status: string) => labels[status] || 'Update'
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : ''
}
const visible = computed(() => (props.updates || []).slice(0, props.compact ? 5 : 50))
</script>

<template>
  <ol v-if="visible.length" class="sw-timeline" :class="{ compact }">
    <li v-for="item in visible" :key="item.id" class="sw-item">
      <span class="sw-status" :class="`sw-${item.status}`">{{ label(item.status) }}</span>
      <span class="sw-message">{{ item.message }}</span>
      <time class="sw-time" :datetime="item.createdDate">{{ formatDate(item.createdDate) }}</time>
    </li>
  </ol>
</template>

<style scoped>
.sw-timeline { list-style: none; margin: 10px 0 0; padding: 0 0 0 10px; border-left: 2px solid rgba(127,127,127,.35); }
.sw-item { position: relative; padding: 4px 0 4px 12px; font-size: .8125rem; }
.sw-item::before { content: ''; position: absolute; left: -16px; top: 10px; width: 7px; height: 7px; border-radius: 50%; background: currentColor; opacity: .7; }
.sw-status { display: inline-block; font-weight: 600; margin-right: 6px; }
.sw-resolved { color: #047857; }
.sw-investigating, .sw-identified { color: #b45309; }
.sw-monitoring { color: #1d4ed8; }
.sw-message { opacity: .95; }
.sw-time { display: block; font-size: .7rem; opacity: .65; margin-top: 2px; }
.compact .sw-item { padding-top: 2px; padding-bottom: 2px; }
</style>
