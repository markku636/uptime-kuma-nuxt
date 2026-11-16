<script setup lang="ts">
import type { MonitorGroup, Workspace, WorkspaceFilter } from '~/composables/useWorkspaces'
import { matchesWorkspace, workspaceErrorMessage } from '~/composables/useWorkspaces'
import { orderAsTree } from '~/server/services/workspace/tree'

// Settings > Workspaces & Groups
// Left: workspaces (create / edit / delete, pick one to work in).
// Right: the groups of that workspace and their monitors (create / edit /
// delete groups, move monitors by drag & drop, row menu or bulk selection).

const { t } = useI18n()
const toast = useToast()
const {
  workspaces, groups, unassigned, loaded, error, current, currentWorkspace, defaultWorkspaceId,
  fetchAll, moveWorkspace, deleteWorkspace, setGroupActive, deleteGroup, organize,
} = useWorkspaces({ autoFetch: false })

// ---------- Data ----------
const monitors = ref<any[]>([])
const loadingMonitors = ref(true)
const busy = ref(false)

async function fetchMonitors() {
  try {
    const res = await $fetch<{ data: any[] }>('/api/v1/monitors?heartbeats=1')
    monitors.value = res.data || []
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to load')), color: 'error' })
  } finally {
    loadingMonitors.value = false
  }
}

const reload = () => Promise.all([fetchAll(), fetchMonitors()])
onMounted(reload)

// ---------- Current view ----------
const search = ref('')
const selected = ref<number[]>([])
watch(current, () => { selected.value = [] })

const totalMonitors = computed(() => monitors.value.filter(m => m.type !== 'group').length)
const hasUnassigned = computed(() => unassigned.value.monitorCount + unassigned.value.groupCount > 0)

const viewTitle = computed(() => {
  if (current.value === 'all') return t('All Workspaces')
  if (current.value === 'none') return t('No workspace')
  return currentWorkspace.value?.name ?? ''
})
const viewHint = computed(() => {
  if (current.value === 'all') return t('allWorkspacesHint')
  if (current.value === 'none') return t('noWorkspaceHint')
  return currentWorkspace.value?.description || ''
})

const matchesSearch = (m: any) => !search.value.trim() || m.name.toLowerCase().includes(search.value.trim().toLowerCase())

const visibleGroups = computed(() => groups.value.filter(g => matchesWorkspace(g, current.value)))

// Subgroups follow their parent, labelled with their full path
const sections = computed(() => {
  const list = orderAsTree(visibleGroups.value).map(({ item: group, depth, path }) => ({
    group,
    depth,
    label: path,
    monitors: monitors.value.filter(m => m.type !== 'group' && m.parent === group.id && matchesSearch(m)),
  }))
  // While searching, hide groups that neither match nor contain a match
  if (!search.value.trim()) return list
  return list.filter(s => s.monitors.length > 0 || matchesSearch(s.group))
})

const groupIds = computed(() => new Set(groups.value.map(g => g.id)))
const ungrouped = computed(() =>
  monitors.value.filter(m =>
    m.type !== 'group'
    && (m.parent == null || !groupIds.value.has(m.parent))
    && matchesWorkspace(m, current.value)
    && matchesSearch(m),
  ),
)

// Groups of other workspaces stay available as move targets, labelled with their workspace
const workspaceName = (id: number | null) => workspaces.value.find(w => w.id === id)?.name
const targets = computed<MonitorGroup[]>(() =>
  orderAsTree(groups.value).map(({ item: g, path }) => (
    current.value !== 'all' && !matchesWorkspace(g, current.value) && g.workspaceId != null
      ? { ...g, name: `${workspaceName(g.workspaceId)} / ${path}` }
      : { ...g, name: path }
  )),
)

// ---------- Workspace order ----------
async function reorder(id: number, direction: -1 | 1) {
  try {
    await moveWorkspace(id, direction)
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to save')), color: 'error' })
  }
}

// ---------- Workspace dialogs ----------
const workspaceDialogOpen = ref(false)
const editingWorkspace = ref<Workspace | null>(null)
function openWorkspaceDialog(workspace: Workspace | null = null) {
  editingWorkspace.value = workspace
  workspaceDialogOpen.value = true
}
function onWorkspaceSaved(workspace: Workspace) {
  if (!editingWorkspace.value) current.value = workspace.id
}

// ---------- Group dialogs ----------
const groupDialogOpen = ref(false)
const editingGroup = ref<MonitorGroup | null>(null)
function openGroupDialog(group: MonitorGroup | null = null) {
  // `targets` may carry a prefixed name, always edit the real record
  editingGroup.value = group ? groups.value.find(g => g.id === group.id) ?? group : null
  groupDialogOpen.value = true
}

// ---------- Delete ----------
const pendingDelete = ref<{ kind: 'workspace'; item: Workspace } | { kind: 'group'; item: MonitorGroup } | null>(null)
const confirmOpen = computed({
  get: () => pendingDelete.value !== null,
  set: (v: boolean) => { if (!v) pendingDelete.value = null },
})

// Say what the delete touches: counts of what is inside, and that it is kept
const deleteMessage = computed(() => {
  const pending = pendingDelete.value
  if (!pending) return ''
  if (pending.kind === 'workspace') {
    const { groupCount, monitorCount } = pending.item
    const inside = groupCount + monitorCount > 0 ? t('workspaceContains', { groups: groupCount, monitors: monitorCount }) + ' ' : ''
    return inside + t('deleteWorkspaceMsg')
  }
  const subgroups = groups.value.filter(g => g.parent === pending.item.id).length
  const members = pending.item.monitorCount
  const inside = members > 0 ? t('groupContains', { count: members, subgroups }) + ' ' : ''
  return inside + t('deleteGroupMsg')
})

async function confirmDelete() {
  const pending = pendingDelete.value
  if (!pending) return
  busy.value = true
  try {
    if (pending.kind === 'workspace') {
      await deleteWorkspace(pending.item.id)
      toast.add({ title: t('Workspace deleted'), color: 'success' })
    } else {
      await deleteGroup(pending.item.id)
      toast.add({ title: t('Group deleted'), color: 'success' })
    }
    pendingDelete.value = null
    await fetchMonitors()
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to delete')), color: 'error' })
  } finally {
    busy.value = false
  }
}

// ---------- Pause / resume a group ----------
async function toggleGroup(group: MonitorGroup, active: boolean) {
  busy.value = true
  try {
    await setGroupActive(group.id, active)
    await fetchMonitors()
    toast.add({ title: active ? t('Group resumed') : t('Group paused'), color: 'success' })
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to save')), color: 'error' })
  } finally {
    busy.value = false
  }
}

// ---------- Move ----------
async function move(monitorIds: number[], target: { parent?: number | null; workspaceId?: number | null }) {
  if (!monitorIds.length) return
  busy.value = true
  try {
    await organize(monitorIds, target)
    await fetchMonitors()
    selected.value = selected.value.filter(id => !monitorIds.includes(id))
    toast.add({ title: t('monitorsMoved', monitorIds.length), color: 'success' })
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to move')), color: 'error' })
  } finally {
    busy.value = false
  }
}

const bulkGroupItems = computed(() => [
  targets.value.map(group => ({
    label: group.name,
    icon: 'i-heroicons-folder',
    onSelect: () => move(selected.value, { parent: group.id }),
  })),
  [{ label: t('Remove from group'), icon: 'i-heroicons-arrow-up-on-square', onSelect: () => move(selected.value, { parent: null }) }],
].filter(section => section.length))

const bulkWorkspaceItems = computed(() => [
  workspaces.value.map(workspace => ({
    label: workspace.name,
    icon: 'i-heroicons-rectangle-stack',
    onSelect: () => move(selected.value, { workspaceId: workspace.id }),
  })),
  [{ label: t('No workspace'), icon: 'i-heroicons-minus-circle', onSelect: () => move(selected.value, { workspaceId: null }) }],
].filter(section => section.length))

const select = (value: WorkspaceFilter) => { current.value = value }
</script>

<template>
  <div>
    <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
      <p class="max-w-2xl text-sm text-muted">{{ t('workspacesIntro') }}</p>
      <div class="flex shrink-0 gap-2">
        <UButton variant="outline" color="neutral" icon="i-heroicons-plus" @click="openWorkspaceDialog()">
          {{ t('New Workspace') }}
        </UButton>
        <UButton icon="i-heroicons-folder-plus" @click="openGroupDialog()">
          {{ t('New Group') }}
        </UButton>
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" :title="error" class="mb-4" />

    <div v-if="!loaded || loadingMonitors" class="flex justify-center py-16">
      <div class="spinner size-8" />
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <!-- Workspaces -->
      <nav :aria-label="t('Workspaces')">
        <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{{ t('Workspaces') }}</h3>
        <ul class="space-y-1">
          <li>
            <button type="button" class="ws-item" :class="{ 'ws-item-active': current === 'all' }" :aria-current="current === 'all' || undefined" @click="select('all')">
              <UIcon name="i-heroicons-squares-2x2" class="size-4 shrink-0" />
              <span class="flex-1 truncate text-left">{{ t('All Workspaces') }}</span>
              <span class="ws-count">{{ totalMonitors }}</span>
            </button>
          </li>
          <li v-for="(workspace, index) in workspaces" :key="workspace.id" class="group/ws relative">
            <button
              type="button"
              class="ws-item pr-28"
              :class="{ 'ws-item-active': current === workspace.id }"
              :aria-current="current === workspace.id || undefined"
              @click="select(workspace.id)"
            >
              <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: workspace.color }" aria-hidden="true" />
              <span class="flex-1 truncate text-left">{{ workspace.name }}</span>
              <span class="ws-count group-hover/ws:invisible group-focus-within/ws:invisible">{{ workspace.monitorCount }}</span>
            </button>
            <div class="absolute inset-y-0 right-1 flex items-center opacity-0 transition-opacity group-hover/ws:opacity-100 group-focus-within/ws:opacity-100">
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-heroicons-chevron-up"
                :disabled="index === 0"
                :aria-label="`${t('Move up')}: ${workspace.name}`"
                :title="t('Move up')"
                @click="reorder(workspace.id, -1)"
              />
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-heroicons-chevron-down"
                :disabled="index === workspaces.length - 1"
                :aria-label="`${t('Move down')}: ${workspace.name}`"
                :title="t('Move down')"
                @click="reorder(workspace.id, 1)"
              />
              <UButton
                variant="ghost"
                color="neutral"
                size="xs"
                icon="i-heroicons-pencil-square"
                :aria-label="`${t('Edit Workspace')}: ${workspace.name}`"
                :title="t('Edit Workspace')"
                @click="openWorkspaceDialog(workspace)"
              />
              <UButton
                variant="ghost"
                color="error"
                size="xs"
                icon="i-heroicons-trash"
                :aria-label="`${t('Delete Workspace')}: ${workspace.name}`"
                :title="t('Delete Workspace')"
                @click="pendingDelete = { kind: 'workspace', item: workspace }"
              />
            </div>
          </li>
          <li v-if="hasUnassigned && workspaces.length">
            <button type="button" class="ws-item" :class="{ 'ws-item-active': current === 'none' }" :aria-current="current === 'none' || undefined" @click="select('none')">
              <UIcon name="i-heroicons-inbox" class="size-4 shrink-0" />
              <span class="flex-1 truncate text-left">{{ t('No workspace') }}</span>
              <span class="ws-count">{{ unassigned.monitorCount }}</span>
            </button>
          </li>
        </ul>

        <p v-if="!workspaces.length" class="mt-3 text-sm text-muted">{{ t('noWorkspacesYet') }}</p>
      </nav>

      <!-- Groups and monitors of the selected workspace -->
      <div class="min-w-0">
        <div class="mb-3 flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <h3 class="flex items-center gap-2 text-lg font-semibold text-highlighted">
              <span v-if="currentWorkspace" class="size-3 rounded-full" :style="{ backgroundColor: currentWorkspace.color }" aria-hidden="true" />
              <span class="truncate">{{ viewTitle }}</span>
            </h3>
            <p v-if="viewHint" class="text-sm text-muted">{{ viewHint }}</p>
          </div>
          <div class="relative w-full sm:w-56">
            <UIcon name="i-heroicons-magnifying-glass" class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <input v-model="search" type="search" class="input-field pl-9" :placeholder="t('Search monitors')" :aria-label="t('Search monitors')">
          </div>
        </div>

        <!-- Bulk actions -->
        <div
          v-if="selected.length"
          class="sticky top-20 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-default bg-elevated px-3 py-2 shadow-sm"
          role="region"
          :aria-label="t('Bulk actions')"
        >
          <span class="text-sm font-medium text-highlighted">{{ t('selectedMonitorCount', [selected.length]) }}</span>
          <span class="flex-1" />
          <UDropdownMenu :items="bulkGroupItems">
            <UButton size="sm" variant="outline" color="neutral" icon="i-heroicons-folder" trailing-icon="i-heroicons-chevron-down" :loading="busy">
              {{ t('Move to group') }}
            </UButton>
          </UDropdownMenu>
          <UDropdownMenu :items="bulkWorkspaceItems">
            <UButton size="sm" variant="outline" color="neutral" icon="i-heroicons-rectangle-stack" trailing-icon="i-heroicons-chevron-down" :loading="busy">
              {{ t('Move to workspace') }}
            </UButton>
          </UDropdownMenu>
          <UButton size="sm" variant="ghost" color="neutral" @click="selected = []">{{ t('Clear') }}</UButton>
        </div>

        <MonitorGroupList
          v-model:selected="selected"
          :sections="sections"
          :ungrouped="ungrouped"
          :targets="targets"
          :filtered="!!search.trim()"
          :busy="busy"
          @add-group="openGroupDialog()"
          @edit-group="openGroupDialog($event)"
          @set-group-active="toggleGroup"
          @delete-group="pendingDelete = { kind: 'group', item: $event }"
          @move="(ids, groupId) => move(ids, { parent: groupId })"
        />

        <p v-if="sections.length || ungrouped.length" class="mt-3 text-xs text-muted">{{ t('dragMonitorHint') }}</p>
      </div>
    </div>

    <WorkspaceDialog v-model:open="workspaceDialogOpen" :workspace="editingWorkspace" @saved="onWorkspaceSaved" />
    <GroupDialog
      v-model:open="groupDialogOpen"
      :group="editingGroup"
      :default-workspace-id="defaultWorkspaceId"
      @saved="fetchMonitors"
    />

    <CommonConfirmDialog
      v-model:open="confirmOpen"
      :title="pendingDelete ? `${t('Delete')}: ${pendingDelete.item.name}` : ''"
      :message="deleteMessage"
      type="danger"
      :confirm-text="t('Delete')"
      :cancel-text="t('Cancel')"
      :loading="busy"
      @confirm="confirmDelete"
    />
  </div>
</template>

<style scoped>
.ws-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  font-size: 0.875rem;
  color: var(--uk-text-secondary);
  transition: color 0.15s ease, background-color 0.15s ease;
}

.ws-item:hover {
  color: var(--uk-text);
  background-color: var(--uk-bg-hover);
}

.ws-item-active {
  color: var(--uk-text);
  border-color: color-mix(in srgb, var(--uk-primary) 40%, transparent);
  background-color: color-mix(in srgb, var(--uk-primary) 14%, transparent);
}

.ws-count {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--uk-text-muted);
}
</style>
