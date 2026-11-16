<template>
  <div class="monitor-summary grid grid-cols-2 lg:grid-cols-4 gap-4">
    <!-- Total Monitors -->
    <div class="summary-card p-4 bg-default rounded-lg shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-muted">{{ $t('Total') }}</p>
          <p class="text-2xl font-bold text-highlighted">{{ stats.total }}</p>
        </div>
        <div class="p-3 bg-elevated rounded-full">
          <UIcon name="i-heroicons-server" class="w-6 h-6 text-toned" />
        </div>
      </div>
    </div>

    <!-- Up Monitors -->
    <div class="summary-card p-4 bg-default rounded-lg shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-muted">{{ $t('Up') }}</p>
          <p class="text-2xl font-bold text-up-fg">{{ stats.up }}</p>
        </div>
        <div class="p-3 bg-up-subtle rounded-full">
          <UIcon name="i-heroicons-check-circle" class="w-6 h-6 text-up-fg" />
        </div>
      </div>
      <div v-if="showPercentage && stats.total > 0" class="mt-2">
        <div class="h-1 bg-accented rounded-full overflow-hidden">
          <div 
            class="h-full bg-up rounded-full transition-all duration-300"
            :style="{ width: `${(stats.up / stats.total) * 100}%` }"
          />
        </div>
        <p class="text-xs text-muted mt-1">{{ ((stats.up / stats.total) * 100).toFixed(1) }}%</p>
      </div>
    </div>

    <!-- Down Monitors -->
    <div class="summary-card p-4 bg-default rounded-lg shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-muted">{{ $t('Down') }}</p>
          <p class="text-2xl font-bold text-down-fg">{{ stats.down }}</p>
        </div>
        <div class="p-3 bg-down-subtle rounded-full">
          <UIcon name="i-heroicons-x-circle" class="w-6 h-6 text-down-fg" />
        </div>
      </div>
      <div v-if="showPercentage && stats.total > 0" class="mt-2">
        <div class="h-1 bg-accented rounded-full overflow-hidden">
          <div 
            class="h-full bg-down rounded-full transition-all duration-300"
            :style="{ width: `${(stats.down / stats.total) * 100}%` }"
          />
        </div>
        <p class="text-xs text-muted mt-1">{{ ((stats.down / stats.total) * 100).toFixed(1) }}%</p>
      </div>
    </div>

    <!-- Paused/Maintenance -->
    <div class="summary-card p-4 bg-default rounded-lg shadow-sm">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-muted">{{ $t('Paused') }}</p>
          <p class="text-2xl font-bold text-pending-fg">{{ stats.paused }}</p>
        </div>
        <div class="p-3 bg-pending-subtle rounded-full">
          <UIcon name="i-heroicons-pause-circle" class="w-6 h-6 text-pending-fg" />
        </div>
      </div>
      <div v-if="stats.maintenance > 0" class="mt-2 flex items-center gap-1 text-xs text-maintenance-fg">
        <UIcon name="i-heroicons-wrench-screwdriver" class="w-3 h-3" />
        <span>{{ stats.maintenance }} {{ $t('in maintenance') }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface MonitorStats {
  total: number
  up: number
  down: number
  paused: number
  pending?: number
  maintenance?: number
}

const props = withDefaults(defineProps<{
  stats: MonitorStats
  showPercentage?: boolean
}>(), {
  showPercentage: true,
})

// Provide default values
const stats = computed(() => ({
  total: props.stats.total || 0,
  up: props.stats.up || 0,
  down: props.stats.down || 0,
  paused: props.stats.paused || 0,
  pending: props.stats.pending || 0,
  maintenance: props.stats.maintenance || 0,
}))
</script>

<style scoped>
.summary-card {
  transition: transform 0.2s ease;
}

.summary-card:hover {
  transform: translateY(-2px);
}
</style>
