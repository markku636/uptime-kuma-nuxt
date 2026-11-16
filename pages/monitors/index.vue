<template>
  <div class="page-container">
    <div class="flex flex-wrap justify-between items-center gap-3 mb-4">
      <div>
        <h1 class="text-2xl font-bold text-highlighted">Monitors</h1>
        <p class="text-toned">Manage your monitors</p>
      </div>
      <div class="flex gap-2">
        <UButton variant="outline" color="neutral" icon="i-heroicons-folder-plus" @click="openGroupDialog()">
          {{ t('New Group') }}
        </UButton>
        <NuxtLink :to="addMonitorLink()" class="btn btn-primary">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
          Add Monitor
        </NuxtLink>
      </div>
    </div>

    <!-- Workspace -->
    <WorkspaceSwitcher class="mb-4" />

    <div class="card card-body">
      <div v-if="pending || !loaded" class="text-center py-12">
        <div class="spinner w-8 h-8 mx-auto"></div>
        <p class="text-toned mt-2">Loading monitors...</p>
      </div>

      <div v-else-if="monitors.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-server" class="w-12 h-12 mx-auto text-muted mb-3" />
        <p class="text-toned mb-4">No monitors yet</p>
        <NuxtLink to="/monitors/add" class="btn btn-primary">
          Add your first monitor
        </NuxtLink>
      </div>

      <div v-else-if="sections.length === 0" class="text-center py-12">
        <UIcon name="i-heroicons-rectangle-group" class="w-12 h-12 mx-auto text-muted mb-3" />
        <p class="text-toned mb-4">{{ t('workspaceEmpty') }}</p>
        <div class="flex justify-center gap-2">
          <NuxtLink :to="addMonitorLink()" class="btn btn-primary">Add Monitor</NuxtLink>
          <button type="button" class="btn btn-secondary" @click="current = 'all'">{{ t('All Workspaces') }}</button>
        </div>
      </div>

      <div v-else class="space-y-5">
        <section v-for="section in sections" :key="section.key">
          <!-- Section header: a group (with shortcuts) or the ungrouped monitors -->
          <header v-if="section.group || hasGroups" class="flex items-center gap-2 mb-2">
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-2 text-left"
              :aria-expanded="!collapsed.has(section.key)"
              @click="toggle(section.key)"
            >
              <UIcon
                name="i-heroicons-chevron-right"
                class="w-4 h-4 shrink-0 text-muted transition-transform"
                :class="{ 'rotate-90': !collapsed.has(section.key) }"
              />
              <UIcon :name="section.group ? 'i-heroicons-folder' : 'i-heroicons-inbox'" class="w-4 h-4 shrink-0 text-muted" />
              <span class="truncate font-semibold text-highlighted">{{ section.group ? section.group.name : t('Ungrouped') }}</span>
              <span class="text-sm text-muted">{{ section.monitors.length }}</span>
              <span v-if="section.group" :class="getStatusBadgeClass(section.status)" class="badge">
                {{ getStatusText(section.status) }}
              </span>
              <span v-if="section.workspace" class="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted">
                <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: section.workspace.color }"></span>
                {{ section.workspace.name }}
              </span>
            </button>
            <template v-if="section.group">
              <UButton
                :to="addMonitorLink(section.group)"
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-heroicons-plus"
                :aria-label="t('addMonitorToGroup', [section.group.name])"
                :title="t('addMonitorToGroup', [section.group.name])"
              />
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-heroicons-pencil-square"
                :aria-label="`${t('Edit Group')}: ${section.group.name}`"
                :title="t('Edit Group')"
                @click="openGroupDialog(section.group)"
              />
            </template>
          </header>

          <div v-if="!collapsed.has(section.key)" class="space-y-3" :class="{ 'ml-6': section.group || hasGroups }">
            <p v-if="section.monitors.length === 0" class="text-sm text-muted py-2">
              {{ t('groupEmptyHint') }}
            </p>
            <NuxtLink
              v-for="monitor in section.monitors"
              :key="monitor.id"
              :to="`/monitors/${monitor.id}`"
              class="block p-4 bg-elevated rounded-lg hover:bg-accented transition-colors"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 min-w-0">
                  <span :class="getStatusDotClass(statusOf(monitor))" class="w-3 h-3 rounded-full shrink-0"></span>
                  <span class="font-semibold text-highlighted truncate">{{ monitor.name }}</span>
                  <span class="text-muted text-sm uppercase">{{ monitor.type }}</span>
                </div>
                <span :class="getStatusBadgeClass(statusOf(monitor))" class="badge">
                  {{ getStatusText(statusOf(monitor)) }}
                </span>
              </div>
              <div v-if="monitor.url" class="text-toned text-sm mt-1 ml-6 truncate">
                {{ monitor.url }}
              </div>
            </NuxtLink>
          </div>
        </section>
      </div>
    </div>

    <GroupDialog
      v-model:open="groupDialogOpen"
      :group="editingGroup"
      :default-workspace-id="defaultWorkspaceId"
      @saved="refresh()"
    />
  </div>
</template>

<script setup lang="ts">
import type { MonitorGroup, Workspace } from '~/composables/useWorkspaces'
import { matchesWorkspace } from '~/composables/useWorkspaces'

definePageMeta({
  middleware: ['auth']
})

const { t } = useI18n()
const { workspaces, groups, current, loaded, defaultWorkspaceId } = useWorkspaces()

const { data, pending, refresh } = await useFetch('/api/v1/monitors', {
  headers: useRequestHeaders(['cookie'])
})

const monitors = computed<any[]>(() => data.value?.data || [])

// ---------- Sections: one per group of the selected workspace, then ungrouped ----------
type StatusKey = 'up' | 'down' | 'maintenance' | 'pending' | 'paused'

interface Section {
  key: string
  group: MonitorGroup | null
  workspace: Workspace | null
  status: StatusKey
  monitors: any[]
}

const hasGroups = computed(() => groups.value.some(g => matchesWorkspace(g, current.value)))

const sections = computed<Section[]>(() => {
  const groupIds = new Set(groups.value.map(g => g.id))
  const byId = new Map(monitors.value.map(m => [m.id, m]))
  const showWorkspace = current.value === 'all'
  const workspaceOf = (id: number | null) => (showWorkspace ? workspaces.value.find(w => w.id === id) ?? null : null)

  const result: Section[] = groups.value
    .filter(g => matchesWorkspace(g, current.value))
    .map(group => ({
      key: `group-${group.id}`,
      group,
      workspace: workspaceOf(group.workspaceId),
      // The group itself is a monitor whose status is aggregated from its members
      status: byId.has(group.id) ? statusOf(byId.get(group.id)) : 'pending',
      monitors: monitors.value.filter(m => m.type !== 'group' && m.parent === group.id),
    }))

  const ungrouped = monitors.value.filter(m =>
    m.type !== 'group'
    && (m.parent == null || !groupIds.has(m.parent))
    && matchesWorkspace(m, current.value),
  )
  if (ungrouped.length) {
    result.push({ key: 'ungrouped', group: null, workspace: null, status: 'pending', monitors: ungrouped })
  }
  return result
})

const collapsed = ref(new Set<string>())
function toggle(key: string) {
  const next = new Set(collapsed.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsed.value = next
}

// ---------- Shortcuts ----------
const groupDialogOpen = ref(false)
const editingGroup = ref<MonitorGroup | null>(null)
function openGroupDialog(group: MonitorGroup | null = null) {
  editingGroup.value = group
  groupDialogOpen.value = true
}

function addMonitorLink(group?: MonitorGroup) {
  if (group) return { path: '/monitors/add', query: { group: group.id } }
  return defaultWorkspaceId.value
    ? { path: '/monitors/add', query: { workspace: defaultWorkspaceId.value } }
    : { path: '/monitors/add' }
}

// ---------- Status ----------
function statusOf(monitor: any): StatusKey {
  if (!monitor.active) return 'paused'
  switch (monitor.heartbeats?.[0]?.status) {
    case 1: return 'up'
    case 0: return 'down'
    case 3: return 'maintenance'
    default: return 'pending'
  }
}

function getStatusText(status: StatusKey) {
  return status.toUpperCase()
}

function getStatusDotClass(status: StatusKey) {
  switch (status) {
    case 'up': return 'bg-up'
    case 'down': return 'bg-down'
    case 'maintenance': return 'bg-maintenance'
    default: return 'bg-unknown'
  }
}

function getStatusBadgeClass(status: StatusKey) {
  switch (status) {
    case 'up': return 'badge-success'
    case 'down': return 'badge-danger'
    case 'maintenance': return 'badge-info'
    default: return 'bg-unknown-subtle text-unknown-fg'
  }
}
</script>
