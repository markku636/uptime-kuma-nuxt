<script setup lang="ts">
import type {GroupNode} from '~/composables/useBruno'

definePageMeta({middleware: ['auth']})

interface GroupMonitor {id: number; name: string; type: string; active: boolean; viewStatus: string; groupId: number | null}
type GroupKey = number | 'none'

const toast = useToast()
const {current, environment, canEdit, canManage, load: loadWorkspaces} = useWorkspace()
const {tree, flat, ungrouped, loading, load, pathOf} = useMonitorGroups()

const expanded = ref(new Set<GroupKey>())
const monitorsByGroup = ref(new Map<GroupKey, GroupMonitor[]>())
const loadingGroup = ref(new Set<GroupKey>())
const selected = ref(new Set<number>())
const moveTarget = ref<string>('')
const busy = ref(false)
const menuFor = ref<number | null>(null)

const form = ref<{open: boolean; id: number | null; name: string; parentId: number | null}>({open: false, id: null, name: '', parentId: null})
const removal = ref<{group: GroupNode | null; monitors: 'keep' | 'delete'}>({group: null, monitors: 'keep'})

onMounted(async () => {
  if (!current.value) await loadWorkspaces()
  await load()
})

function errorText(error: any, fallback: string) {
  return error?.data?.message || error?.message || fallback
}

async function loadMonitors(key: GroupKey) {
  loadingGroup.value = new Set(loadingGroup.value).add(key)
  try {
    const response = await $fetch<{data: GroupMonitor[]}>('/api/v1/monitors', {query: {groupId: key, limit: 200}})
    monitorsByGroup.value = new Map(monitorsByGroup.value).set(key, response.data)
  } catch (error) {
    toast.add({title: 'Could not load monitors', description: errorText(error, ''), color: 'error'})
  } finally {
    const next = new Set(loadingGroup.value); next.delete(key); loadingGroup.value = next
  }
}

function toggle(key: GroupKey) {
  const next = new Set(expanded.value)
  if (next.has(key)) next.delete(key)
  else { next.add(key); loadMonitors(key) }
  expanded.value = next
}

async function refresh() {
  await load()
  await Promise.all([...expanded.value].map(loadMonitors))
}

function toggleMonitor(id: number) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAllIn(key: GroupKey) {
  const ids = (monitorsByGroup.value.get(key) || []).map(monitor => monitor.id)
  const allSelected = ids.every(id => selected.value.has(id))
  const next = new Set(selected.value)
  ids.forEach(id => allSelected ? next.delete(id) : next.add(id))
  selected.value = next
}

/** Groups that cannot be a parent of `id`: itself and its subtree. */
function blockedParents(id: number | null) {
  const blocked = new Set<number>()
  if (id === null) return blocked
  const walk = (node: GroupNode) => { blocked.add(node.id); node.children.forEach(walk) }
  const node = flat.value.find(item => item.id === id)
  if (node) walk(node)
  return blocked
}

function openCreate(parentId: number | null = null) {
  menuFor.value = null
  form.value = {open: true, id: null, name: '', parentId}
}

function openEdit(group: GroupNode) {
  menuFor.value = null
  form.value = {open: true, id: group.id, name: group.name, parentId: group.parentId}
}

async function saveGroup() {
  busy.value = true
  try {
    const body = {name: form.value.name, parentId: form.value.parentId}
    if (form.value.id === null) await $fetch('/api/v1/groups', {method: 'POST', body})
    else await $fetch(`/api/v1/groups/${form.value.id}`, {method: 'PUT', body})
    form.value.open = false
    if (body.parentId !== null) expanded.value = new Set(expanded.value).add(body.parentId)
    await refresh()
  } catch (error) {
    toast.add({title: 'Could not save group', description: errorText(error, ''), color: 'error'})
  } finally {
    busy.value = false
  }
}

async function confirmRemove() {
  const group = removal.value.group
  if (!group) return
  busy.value = true
  try {
    await $fetch(`/api/v1/groups/${group.id}`, {method: 'DELETE', query: {monitors: removal.value.monitors}})
    removal.value.group = null
    selected.value = new Set()
    await refresh()
  } catch (error) {
    toast.add({title: 'Could not delete group', description: errorText(error, ''), color: 'error'})
  } finally {
    busy.value = false
  }
}

async function moveSelected() {
  if (!selected.value.size || moveTarget.value === '') return
  busy.value = true
  try {
    const groupId = moveTarget.value === 'none' ? null : Number(moveTarget.value)
    await $fetch('/api/v1/groups/move', {method: 'POST', body: {monitorIds: [...selected.value], groupId}})
    toast.add({title: `Moved ${selected.value.size} monitor${selected.value.size === 1 ? '' : 's'}`, color: 'success'})
    selected.value = new Set()
    moveTarget.value = ''
    await refresh()
  } catch (error) {
    toast.add({title: 'Could not move monitors', description: errorText(error, ''), color: 'error'})
  } finally {
    busy.value = false
  }
}

async function exportBruno(query: Record<string, string | number>) {
  menuFor.value = null
  busy.value = true
  try {
    const result = await downloadBruno(query)
    const notes = [result.skipped ? `${result.skipped} monitor(s) cannot be expressed in Bruno and were left out.` : '',
      result.secretNames.length ? `Set these secrets in Bruno: ${result.secretNames.join(', ')}.` : ''].filter(Boolean)
    toast.add({title: `Downloaded ${result.name}`, description: notes.join(' ') || undefined, color: result.skipped ? 'warning' : 'success'})
  } catch (error) {
    toast.add({title: 'Export failed', description: errorText(error, ''), color: 'error'})
  } finally {
    busy.value = false
  }
}

function statusClass(status: string) {
  return ({up: 'dot-up', down: 'dot-down', maintenance: 'dot-maintenance', paused: 'dot-paused'} as Record<string, string>)[status] || 'dot-pending'
}

const visibleRows = computed(() => {
  const rows: GroupNode[] = []
  const walk = (list: GroupNode[]) => list.forEach(node => { rows.push(node); if (expanded.value.has(node.id)) walk(node.children) })
  walk(tree.value)
  return rows
})

if (import.meta.client) useEventListener(document, 'click', event => {
  if (!(event.target as HTMLElement).closest('.group-menu')) menuFor.value = null
})
</script>

<template>
  <div class="page-container groups-page">
    <div class="page-head">
      <div>
        <h1 class="text-2xl font-bold text-primary">Groups</h1>
        <p class="text-secondary mt-1">
          Organise monitors like Bruno collections and folders. Groups are shared by every environment of
          <strong>{{ current?.name }}</strong>; counts show <strong>{{ environment?.name }}</strong>.
        </p>
      </div>
      <div class="head-actions">
        <NuxtLink v-if="canEdit" to="/settings/bruno" class="btn btn-secondary">
          <UIcon name="i-heroicons-arrow-down-tray" class="w-4 h-4 mr-2" />Import from Bruno
        </NuxtLink>
        <button v-if="canManage" class="btn btn-secondary" :disabled="busy" @click="exportBruno({all: 1})">
          <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4 mr-2" />Export environment
        </button>
        <button v-if="canEdit" class="btn btn-primary" @click="openCreate()">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />New group
        </button>
      </div>
    </div>

    <div class="card groups-card">
      <p v-if="loading && !tree.length" class="empty">Loading groups…</p>
      <div v-else-if="!tree.length && !ungrouped" class="empty">
        <p>No groups or monitors yet.</p>
        <p class="text-sm mt-1">Import a Bruno collection to create groups from its folders, or create a group yourself.</p>
      </div>

      <ul class="group-list" role="tree" aria-label="Monitor groups">
        <li v-for="group in visibleRows" :key="group.id" role="treeitem" :aria-expanded="expanded.has(group.id)">
          <div class="group-row" :style="{paddingLeft: `${0.75 + group.depth * 1.5}rem`}">
            <button class="toggle" :aria-label="`${expanded.has(group.id) ? 'Collapse' : 'Expand'} ${group.name}`" @click="toggle(group.id)">
              <UIcon :name="expanded.has(group.id) ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" class="w-4 h-4" />
            </button>
            <UIcon :name="expanded.has(group.id) ? 'i-heroicons-folder-open' : 'i-heroicons-folder'" class="w-5 h-5 folder-icon" />
            <button class="group-name" @click="toggle(group.id)">{{ group.name }}</button>
            <span v-if="group.sourceKind === 'bruno'" class="source-tag" :title="`Bruno collection ${group.collectionId}${group.sourcePath ? ' / ' + group.sourcePath : ''}`">Bruno</span>
            <span class="count" :title="`${group.monitorCount} directly in this group, ${group.total} including subgroups`">{{ group.total }}</span>
            <div class="row-actions group-menu">
              <button v-if="canManage" class="icon-btn" :disabled="busy || !group.total" :title="`Export ${group.name} to Bruno`" :aria-label="`Export ${group.name} to Bruno`" @click="exportBruno({groupId: group.id})">
                <UIcon name="i-heroicons-arrow-up-tray" class="w-4 h-4" />
              </button>
              <button v-if="canEdit" class="icon-btn" :aria-label="`More actions for ${group.name}`" :aria-expanded="menuFor === group.id" @click.stop="menuFor = menuFor === group.id ? null : group.id">
                <UIcon name="i-heroicons-ellipsis-horizontal" class="w-4 h-4" />
              </button>
              <div v-if="menuFor === group.id" class="menu" role="menu">
                <button role="menuitem" @click="openCreate(group.id)">New subgroup</button>
                <button role="menuitem" @click="openEdit(group)">Rename or move</button>
                <NuxtLink role="menuitem" :to="`/settings/bruno?targetGroup=${group.id}`">Import Bruno files here</NuxtLink>
                <button role="menuitem" class="danger" @click="menuFor = null; removal = {group, monitors: 'keep'}">Delete group</button>
              </div>
            </div>
          </div>

          <div v-if="expanded.has(group.id)" class="monitors" :style="{paddingLeft: `${2.75 + group.depth * 1.5}rem`}">
            <p v-if="loadingGroup.has(group.id) && !monitorsByGroup.get(group.id)" class="hint">Loading…</p>
            <template v-else-if="monitorsByGroup.get(group.id)?.length">
              <label v-if="canEdit" class="select-all"><input type="checkbox" class="checkbox" :checked="monitorsByGroup.get(group.id)!.every(m => selected.has(m.id))" @change="toggleAllIn(group.id)"> Select all {{ monitorsByGroup.get(group.id)!.length }}</label>
              <div v-for="monitor in monitorsByGroup.get(group.id)" :key="monitor.id" class="monitor-row">
                <input v-if="canEdit" type="checkbox" class="checkbox" :checked="selected.has(monitor.id)" :aria-label="`Select ${monitor.name}`" @change="toggleMonitor(monitor.id)">
                <span class="dot" :class="statusClass(monitor.viewStatus)" :title="monitor.viewStatus" />
                <NuxtLink :to="`/monitors/${monitor.id}`" class="monitor-name">{{ monitor.name }}</NuxtLink>
                <span class="monitor-type">{{ monitor.type }}</span>
              </div>
            </template>
            <p v-else-if="!group.children.length" class="hint">No monitors in {{ environment?.name }}.</p>
          </div>
        </li>

        <li v-if="ungrouped" role="treeitem" :aria-expanded="expanded.has('none')">
          <div class="group-row" style="padding-left: 0.75rem">
            <button class="toggle" :aria-label="`${expanded.has('none') ? 'Collapse' : 'Expand'} ungrouped monitors`" @click="toggle('none')">
              <UIcon :name="expanded.has('none') ? 'i-heroicons-chevron-down' : 'i-heroicons-chevron-right'" class="w-4 h-4" />
            </button>
            <UIcon name="i-heroicons-inbox" class="w-5 h-5 folder-icon" />
            <button class="group-name muted" @click="toggle('none')">Ungrouped</button>
            <span class="count">{{ ungrouped }}</span>
          </div>
          <div v-if="expanded.has('none')" class="monitors" style="padding-left: 2.75rem">
            <p v-if="loadingGroup.has('none') && !monitorsByGroup.get('none')" class="hint">Loading…</p>
            <template v-else>
              <label v-if="canEdit && monitorsByGroup.get('none')?.length" class="select-all"><input type="checkbox" class="checkbox" :checked="monitorsByGroup.get('none')!.every(m => selected.has(m.id))" @change="toggleAllIn('none')"> Select all {{ monitorsByGroup.get('none')!.length }}</label>
              <div v-for="monitor in monitorsByGroup.get('none')" :key="monitor.id" class="monitor-row">
                <input v-if="canEdit" type="checkbox" class="checkbox" :checked="selected.has(monitor.id)" :aria-label="`Select ${monitor.name}`" @change="toggleMonitor(monitor.id)">
                <span class="dot" :class="statusClass(monitor.viewStatus)" :title="monitor.viewStatus" />
                <NuxtLink :to="`/monitors/${monitor.id}`" class="monitor-name">{{ monitor.name }}</NuxtLink>
                <span class="monitor-type">{{ monitor.type }}</span>
              </div>
            </template>
          </div>
        </li>
      </ul>
    </div>

    <div v-if="selected.size" class="selection-bar" role="region" aria-label="Selected monitors">
      <strong>{{ selected.size }} selected</strong>
      <template v-if="canEdit">
        <select v-model="moveTarget" class="select-field move-select" aria-label="Move selected monitors to">
          <option value="" disabled>Move to…</option>
          <option value="none">Ungrouped</option>
          <option v-for="group in flat" :key="group.id" :value="String(group.id)">{{ ' '.repeat(group.depth) }}{{ group.name }}</option>
        </select>
        <button class="btn btn-secondary" :disabled="busy || moveTarget === ''" @click="moveSelected">Move</button>
      </template>
      <button v-if="canManage" class="btn btn-primary" :disabled="busy" @click="exportBruno({ids: [...selected].join(',')})">
        Export {{ selected.size === 1 ? '.bru' : 'to Bruno (.zip)' }}
      </button>
      <button class="btn btn-outline" @click="selected = new Set()">Clear</button>
    </div>

    <div v-if="form.open" class="modal-backdrop" @click.self="form.open = false">
      <form class="modal" role="dialog" aria-modal="true" aria-labelledby="group-form-title" @submit.prevent="saveGroup">
        <h3 id="group-form-title" class="modal-title">{{ form.id === null ? 'New group' : 'Rename or move group' }}</h3>
        <label class="input-label" for="group-name">Name</label>
        <input id="group-name" v-model="form.name" class="input-field" maxlength="150" required autofocus>
        <label class="input-label mt-4" for="group-parent">Inside</label>
        <select id="group-parent" v-model="form.parentId" class="select-field">
          <option :value="null">Top level</option>
          <option v-for="group in flat" :key="group.id" :value="group.id" :disabled="blockedParents(form.id).has(group.id)">{{ ' '.repeat(group.depth) }}{{ group.name }}</option>
        </select>
        <p v-if="form.id !== null && flat.find(g => g.id === form.id)?.sourceKind === 'bruno'" class="hint mt-3">
          Renaming or moving does not affect re-imports: Bruno files are matched by their folder path, not by the group name.
        </p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" @click="form.open = false">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="busy || !form.name.trim()">{{ form.id === null ? 'Create' : 'Save' }}</button>
        </div>
      </form>
    </div>

    <div v-if="removal.group" class="modal-backdrop" @click.self="removal.group = null">
      <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="group-delete-title">
        <h3 id="group-delete-title" class="modal-title">Delete “{{ removal.group.name }}”?</h3>
        <p class="text-secondary">Its subgroups are deleted too ({{ removal.group.total }} monitor{{ removal.group.total === 1 ? '' : 's' }} in {{ environment?.name }}).</p>
        <label class="radio"><input v-model="removal.monitors" type="radio" value="keep"> Keep the monitors — move them to {{ removal.group.parentId ? pathOf(removal.group.parentId) : 'Ungrouped' }}</label>
        <label class="radio"><input v-model="removal.monitors" type="radio" value="delete"> Delete the monitors in {{ environment?.name }} as well (cannot be undone)</label>
        <p class="hint">Monitors of other environments are never deleted here; they move up a level.</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="removal.group = null">Cancel</button>
          <button class="btn btn-danger" :disabled="busy" @click="confirmRemove">{{ removal.monitors === 'delete' ? 'Delete group and monitors' : 'Delete group' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem; }
.head-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.groups-card { padding: 0.5rem 0; overflow: visible; }
.empty { padding: 2.5rem 1rem; text-align: center; color: var(--text-tertiary); }
.group-list { list-style: none; margin: 0; padding: 0; }
.group-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--border-color); position: relative; }
.group-row:hover { background: var(--hover-bg); }
.toggle, .icon-btn { display: inline-flex; align-items: center; justify-content: center; width: 1.75rem; height: 1.75rem; border-radius: 0.375rem; color: var(--text-tertiary); }
.toggle:hover, .icon-btn:hover { background: var(--hover-bg); color: var(--text-primary); }
.icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.folder-icon { color: var(--uk-primary-text); flex-shrink: 0; }
.group-name { font-weight: 600; color: var(--text-primary); text-align: left; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-name.muted { color: var(--text-secondary); font-weight: 500; }
.source-tag { font-size: 0.7rem; padding: 0.05rem 0.45rem; border-radius: 999px; background: var(--uk-primary-soft); color: var(--uk-primary-text); }
.count { font-size: 0.75rem; padding: 0 0.5rem; border-radius: 999px; background: var(--bg-tertiary); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.row-actions { margin-left: auto; display: flex; gap: 0.25rem; position: relative; }
.menu { position: absolute; right: 0; top: 2rem; z-index: 20; min-width: 13rem; padding: 0.35rem; border: 1px solid var(--border-color); border-radius: 0.5rem; background: var(--bg-secondary); box-shadow: 0 12px 24px -8px var(--shadow-color); display: flex; flex-direction: column; }
.menu > * { text-align: left; padding: 0.45rem 0.65rem; border-radius: 0.35rem; font-size: 0.875rem; color: var(--text-primary); }
.menu > *:hover { background: var(--hover-bg); }
.menu .danger { color: var(--uk-danger); }
.monitors { padding-top: 0.35rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--border-color); }
.monitor-row, .select-all { display: flex; align-items: center; gap: 0.6rem; padding: 0.3rem 0.75rem 0.3rem 0; font-size: 0.9rem; }
.select-all { font-size: 0.8rem; color: var(--text-tertiary); }
.monitor-name { color: var(--text-primary); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.monitor-name:hover { color: var(--uk-primary-text); text-decoration: underline; }
.monitor-type { margin-left: auto; font-size: 0.75rem; color: var(--text-tertiary); }
.hint { font-size: 0.85rem; color: var(--text-tertiary); padding: 0.25rem 0; }
.dot { width: 0.6rem; height: 0.6rem; border-radius: 999px; flex-shrink: 0; }
.dot-up { background: #16a34a; } .dot-down { background: var(--uk-danger); } .dot-maintenance { background: var(--uk-maintenance); }
.dot-paused { background: #94a3b8; } .dot-pending { background: var(--uk-warning); }
.selection-bar { position: sticky; bottom: 1rem; margin-top: 1rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; padding: 0.75rem 1rem; border: 1px solid var(--border-color); border-radius: 0.75rem; background: var(--bg-secondary); box-shadow: 0 12px 28px -10px var(--shadow-color); color: var(--text-primary); }
.move-select { width: auto !important; min-width: 12rem; }
.modal-backdrop { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 1rem; background: rgba(0, 0, 0, 0.5); }
.modal { width: 100%; max-width: 28rem; padding: 1.5rem; border-radius: 0.75rem; background: var(--bg-secondary); border: 1px solid var(--border-color); color: var(--text-primary); }
.modal-title { font-size: 1.15rem; font-weight: 600; margin-bottom: 1rem; }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem; }
.radio { display: flex; gap: 0.5rem; align-items: flex-start; margin-top: 0.75rem; font-size: 0.9rem; }
</style>
