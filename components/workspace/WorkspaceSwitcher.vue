<script setup lang="ts">
import type { WorkspaceFilter } from '~/composables/useWorkspaces'

// Chip row to switch the workspace shown on the dashboard / monitor list.
// The choice is shared (cookie) through useWorkspaces().current.

const props = withDefaults(defineProps<{
  /** Show the shortcut to the management page */
  manage?: boolean
  /** Monitors the page already loaded; used to flag workspaces with monitors down */
  monitors?: { type: string; active: boolean; workspaceId?: number | null; heartbeats?: { status: number }[] }[]
}>(), { manage: true, monitors: () => [] })

const { t } = useI18n()
const { workspaces, unassigned, current, loaded } = useWorkspaces()

const createOpen = ref(false)

const hasUnassigned = computed(() => unassigned.value.monitorCount + unassigned.value.groupCount > 0)

// Monitors currently DOWN per workspace ('none' = without workspace)
const downCount = computed(() => {
  const counts = new Map<number | 'none', number>()
  for (const m of props.monitors) {
    if (m.type === 'group' || !m.active || m.heartbeats?.[0]?.status !== 0) continue
    const key = m.workspaceId ?? 'none'
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
})

function select(value: WorkspaceFilter) {
  current.value = value
}
</script>

<template>
  <div v-if="loaded" class="flex flex-wrap items-center gap-2" role="group" :aria-label="t('Workspace')">
    <template v-if="workspaces.length">
      <button type="button" class="ws-chip" :class="{ 'ws-chip-active': current === 'all' }" :aria-pressed="current === 'all'" @click="select('all')">
        {{ t('All Workspaces') }}
      </button>
      <button
        v-for="workspace in workspaces"
        :key="workspace.id"
        type="button"
        class="ws-chip"
        :class="{ 'ws-chip-active': current === workspace.id }"
        :aria-pressed="current === workspace.id"
        :title="workspace.description || undefined"
        @click="select(workspace.id)"
      >
        <span class="size-2.5 rounded-full" :style="{ backgroundColor: workspace.color }" aria-hidden="true" />
        <span class="max-w-40 truncate">{{ workspace.name }}</span>
        <span class="ws-chip-count">{{ workspace.monitorCount }}</span>
        <span v-if="downCount.get(workspace.id)" class="ws-chip-down" :title="t('monitorsDown', [downCount.get(workspace.id)])">
          {{ downCount.get(workspace.id) }}<span class="sr-only"> {{ t('Down') }}</span>
        </span>
      </button>
      <button
        v-if="hasUnassigned"
        type="button"
        class="ws-chip"
        :class="{ 'ws-chip-active': current === 'none' }"
        :aria-pressed="current === 'none'"
        @click="select('none')"
      >
        {{ t('No workspace') }}
        <span class="ws-chip-count">{{ unassigned.monitorCount }}</span>
        <span v-if="downCount.get('none')" class="ws-chip-down" :title="t('monitorsDown', [downCount.get('none')])">
          {{ downCount.get('none') }}<span class="sr-only"> {{ t('Down') }}</span>
        </span>
      </button>
    </template>

    <UButton variant="ghost" color="neutral" size="sm" icon="i-heroicons-plus" @click="createOpen = true">
      {{ workspaces.length ? t('Workspace') : t('New Workspace') }}
    </UButton>
    <UButton
      v-if="manage"
      to="/settings/workspaces"
      variant="ghost"
      color="neutral"
      size="sm"
      icon="i-heroicons-rectangle-group"
    >
      {{ t('Manage groups') }}
    </UButton>

    <WorkspaceDialog v-model:open="createOpen" @saved="select($event.id)" />
  </div>
</template>

<style scoped>
.ws-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid var(--uk-border);
  font-size: 0.875rem;
  color: var(--uk-text-muted);
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}

.ws-chip:hover {
  color: var(--uk-text);
  border-color: var(--uk-border-strong);
}

.ws-chip-active {
  color: var(--uk-text);
  border-color: var(--uk-primary);
  background-color: color-mix(in srgb, var(--uk-primary) 14%, transparent);
}

.ws-chip-down {
  min-width: 1.25rem;
  padding: 0 0.35rem;
  border-radius: 9999px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 1.25rem;
  text-align: center;
  color: var(--uk-status-down-fg);
  background-color: color-mix(in srgb, var(--uk-status-down) 18%, transparent);
}

.ws-chip-count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}
</style>
