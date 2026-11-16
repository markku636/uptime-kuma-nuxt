<script setup lang="ts">
import type { WorkspaceFilter } from '~/composables/useWorkspaces'

// Chip row to switch the workspace shown on the dashboard / monitor list.
// The choice is shared (cookie) through useWorkspaces().current.

withDefaults(defineProps<{
  /** Show the shortcut to the management page */
  manage?: boolean
}>(), { manage: true })

const { t } = useI18n()
const { workspaces, unassigned, current, loaded } = useWorkspaces()

const createOpen = ref(false)

const hasUnassigned = computed(() => unassigned.value.monitorCount + unassigned.value.groupCount > 0)

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

.ws-chip-count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  opacity: 0.7;
}
</style>
