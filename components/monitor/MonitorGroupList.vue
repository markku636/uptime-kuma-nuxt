<script setup lang="ts">
import type { MonitorGroup } from '~/composables/useWorkspaces'

// Groups with their members, plus the monitors that are in no group.
// Monitors can be moved by drag & drop, with the per-row menu, or in bulk
// through the selection (v-model:selected).

interface MonitorRow {
  id: number
  name: string
  type: string
  active: boolean
  parent?: number | null
  url?: string | null
  hostname?: string | null
  heartbeats?: { status: number }[]
}

interface GroupSection {
  group: MonitorGroup
  monitors: MonitorRow[]
  /** Nesting level (0 = top level) and full "Parent / Child" name */
  depth?: number
  label?: string
}

const props = defineProps<{
  sections: GroupSection[]
  ungrouped: MonitorRow[]
  /** Every group a monitor can be moved to */
  targets: MonitorGroup[]
  /** True while a search filter hides part of the list */
  filtered?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  addGroup: []
  editGroup: [group: MonitorGroup]
  deleteGroup: [group: MonitorGroup]
  /** groupId null = remove from its group */
  move: [monitorIds: number[], groupId: number | null]
}>()

const selected = defineModel<number[]>('selected', { default: () => [] })

const { t } = useI18n()

// ---------- Expand / collapse ----------
const collapsed = ref(new Set<number>())
function toggle(groupId: number) {
  const next = new Set(collapsed.value)
  if (next.has(groupId)) next.delete(groupId)
  else next.add(groupId)
  collapsed.value = next
}
const isOpen = (groupId: number) => props.filtered || !collapsed.value.has(groupId)

// ---------- Status ----------
type Tone = 'up' | 'down' | 'maintenance' | 'pending' | 'unknown'
function tone(monitor: MonitorRow): Tone {
  if (!monitor.active) return 'unknown'
  switch (monitor.heartbeats?.[0]?.status) {
    case 1: return 'up'
    case 0: return 'down'
    case 3: return 'maintenance'
    default: return 'pending'
  }
}
const dotClass: Record<Tone, string> = {
  up: 'bg-up',
  down: 'bg-down',
  maintenance: 'bg-maintenance',
  pending: 'bg-pending',
  unknown: 'bg-unknown',
}
function toneLabel(monitor: MonitorRow) {
  if (!monitor.active) return t('filterActivePaused')
  return { up: t('Up'), down: t('Down'), maintenance: t('Maintenance'), pending: t('Pending'), unknown: t('Unknown') }[tone(monitor)]
}
const downCount = (monitors: MonitorRow[]) => monitors.filter(m => tone(m) === 'down').length

// ---------- Selection ----------
// The model only reflects a change after the parent re-renders, so two quick
// clicks would both start from the old list. Keep the latest value until then.
let pendingSelection: number[] | null = null
const currentSelection = () => pendingSelection ?? selected.value
function setSelected(next: number[]) {
  pendingSelection = next
  selected.value = next
  nextTick(() => { pendingSelection = null })
}

function toggleSelected(id: number) {
  const list = currentSelection()
  setSelected(list.includes(id) ? list.filter(i => i !== id) : [...list, id])
}
function sectionState(monitors: MonitorRow[]) {
  const count = monitors.filter(m => selected.value.includes(m.id)).length
  return { checked: monitors.length > 0 && count === monitors.length, partial: count > 0 && count < monitors.length }
}
function toggleSection(monitors: MonitorRow[]) {
  const ids = monitors.map(m => m.id)
  const list = currentSelection()
  setSelected(ids.every(id => list.includes(id))
    ? list.filter(id => !ids.includes(id))
    : [...new Set([...list, ...ids])])
}

// ---------- Move (menu + drag & drop) ----------
function moveItems(monitor: MonitorRow) {
  const others = props.targets.filter(g => g.id !== monitor.parent)
  const items: any[][] = []
  if (others.length) {
    items.push(others.map(group => ({
      label: group.name,
      icon: 'i-heroicons-folder',
      onSelect: () => emit('move', [monitor.id], group.id),
    })))
  }
  if (monitor.parent != null) {
    items.push([{
      label: t('Remove from group'),
      icon: 'i-heroicons-arrow-up-on-square',
      onSelect: () => emit('move', [monitor.id], null),
    }])
  }
  return items
}

const dragging = ref<number[]>([])
const dropTarget = ref<number | 'ungrouped' | null>(null)

function onDragStart(event: DragEvent, monitor: MonitorRow) {
  // Dragging a selected row carries the whole selection
  dragging.value = selected.value.includes(monitor.id) ? [...selected.value] : [monitor.id]
  event.dataTransfer?.setData('text/plain', dragging.value.join(','))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function onDragEnd() {
  dragging.value = []
  dropTarget.value = null
}
function onDragOver(event: DragEvent, target: number | 'ungrouped') {
  if (!dragging.value.length) return
  event.preventDefault()
  dropTarget.value = target
}
function onDrop(target: number | 'ungrouped') {
  const ids = dragging.value
  onDragEnd()
  if (ids.length) emit('move', ids, target === 'ungrouped' ? null : target)
}
</script>

<template>
  <div class="space-y-3" :class="{ 'pointer-events-none opacity-60': busy }" :aria-busy="busy">
    <!-- Groups -->
    <section
      v-for="{ group, monitors, depth, label } in sections"
      :key="group.id"
      class="overflow-hidden rounded-lg border transition-colors"
      :class="dropTarget === group.id ? 'border-primary bg-primary/5' : 'border-default'"
      :style="depth ? { marginLeft: `${Math.min(depth, 4) * 1.5}rem` } : undefined"
      @dragover="onDragOver($event, group.id)"
      @dragleave="dropTarget = null"
      @drop.prevent="onDrop(group.id)"
    >
      <header class="flex items-center gap-2 bg-muted px-3 py-2">
        <input
          type="checkbox"
          class="checkbox"
          :checked="sectionState(monitors).checked"
          :indeterminate="sectionState(monitors).partial"
          :disabled="!monitors.length"
          :aria-label="t('Select all in', [group.name])"
          @change="toggleSection(monitors)"
        >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 text-left"
          :aria-expanded="isOpen(group.id)"
          @click="toggle(group.id)"
        >
          <UIcon
            name="i-heroicons-chevron-right"
            class="size-4 shrink-0 text-muted transition-transform"
            :class="{ 'rotate-90': isOpen(group.id) }"
          />
          <UIcon name="i-heroicons-folder" class="size-4 shrink-0 text-muted" />
          <span class="truncate font-medium text-highlighted" :title="label">{{ label ?? group.name }}</span>
          <UBadge variant="subtle" color="neutral" size="sm">{{ monitors.length }}</UBadge>
          <UBadge v-if="downCount(monitors) > 0" variant="subtle" color="error" size="sm">
            {{ downCount(monitors) }} {{ t('Down') }}
          </UBadge>
          <span v-if="group.description" class="hidden truncate text-sm text-muted md:inline">{{ group.description }}</span>
        </button>
        <UButton
          variant="ghost"
          color="neutral"
          size="xs"
          icon="i-heroicons-pencil-square"
          :aria-label="t('Edit Group')"
          :title="t('Edit Group')"
          @click="emit('editGroup', group)"
        />
        <UButton
          variant="ghost"
          color="error"
          size="xs"
          icon="i-heroicons-trash"
          :aria-label="t('Delete Group')"
          :title="t('Delete Group')"
          @click="emit('deleteGroup', group)"
        />
      </header>

      <div v-if="isOpen(group.id)">
        <p v-if="!monitors.length" class="px-4 py-5 text-center text-sm text-muted">
          {{ filtered ? t('No monitors match your search') : t('groupEmptyHint') }}
        </p>
        <ul v-else class="divide-y divide-(--uk-border)">
          <li
            v-for="monitor in monitors"
            :key="monitor.id"
            class="flex items-center gap-3 px-3 py-2 hover:bg-elevated"
            :class="{ 'opacity-50': dragging.includes(monitor.id) }"
            draggable="true"
            @dragstart="onDragStart($event, monitor)"
            @dragend="onDragEnd"
          >
            <input
              type="checkbox"
              class="checkbox"
              :checked="selected.includes(monitor.id)"
              :aria-label="monitor.name"
              @change="toggleSelected(monitor.id)"
            >
            <span class="size-2.5 shrink-0 rounded-full" :class="dotClass[tone(monitor)]" :title="toneLabel(monitor)" />
            <NuxtLink :to="`/monitors/${monitor.id}`" class="min-w-0 flex-1 truncate text-sm text-default hover:text-highlighted" draggable="false">
              {{ monitor.name }}
              <span class="sr-only">({{ toneLabel(monitor) }})</span>
            </NuxtLink>
            <span class="hidden text-xs uppercase text-muted sm:inline">{{ monitor.type }}</span>
            <UDropdownMenu :items="moveItems(monitor)" :content="{ align: 'end' }">
              <UButton variant="ghost" color="neutral" size="xs" icon="i-heroicons-arrows-right-left" :aria-label="t('Move to')" :title="t('Move to')" />
            </UDropdownMenu>
            <UIcon name="i-heroicons-bars-2" class="hidden size-4 cursor-grab text-dimmed sm:block" aria-hidden="true" />
          </li>
        </ul>
      </div>
    </section>

    <!-- No groups yet -->
    <div v-if="!sections.length && !filtered" class="rounded-lg border border-dashed border-default px-6 py-8 text-center">
      <UIcon name="i-heroicons-folder-plus" class="mx-auto size-10 text-dimmed" />
      <p class="mt-2 font-medium text-highlighted">{{ t('No groups yet') }}</p>
      <p class="mt-1 text-sm text-muted">{{ t('groupsIntro') }}</p>
      <UButton class="mt-4" icon="i-heroicons-plus" @click="emit('addGroup')">{{ t('New Group') }}</UButton>
    </div>

    <!-- Monitors without a group (also the drop zone to take a monitor out of its group) -->
    <section
      v-if="ungrouped.length || sections.length"
      class="overflow-hidden rounded-lg border border-dashed transition-colors"
      :class="dropTarget === 'ungrouped' ? 'border-primary bg-primary/5' : 'border-default'"
      @dragover="onDragOver($event, 'ungrouped')"
      @dragleave="dropTarget = null"
      @drop.prevent="onDrop('ungrouped')"
    >
      <header class="flex items-center gap-2 px-3 py-2">
        <input
          type="checkbox"
          class="checkbox"
          :checked="sectionState(ungrouped).checked"
          :indeterminate="sectionState(ungrouped).partial"
          :disabled="!ungrouped.length"
          :aria-label="t('Select all in', [t('Ungrouped')])"
          @change="toggleSection(ungrouped)"
        >
        <UIcon name="i-heroicons-inbox" class="size-4 text-muted" />
        <span class="font-medium text-highlighted">{{ t('Ungrouped') }}</span>
        <UBadge variant="subtle" color="neutral" size="sm">{{ ungrouped.length }}</UBadge>
      </header>

      <p v-if="!ungrouped.length" class="px-4 pb-4 text-center text-sm text-muted">
        {{ filtered ? t('No monitors match your search') : t('ungroupedEmptyHint') }}
      </p>
      <ul v-else class="divide-y divide-(--uk-border) border-t border-default">
        <li
          v-for="monitor in ungrouped"
          :key="monitor.id"
          class="flex items-center gap-3 px-3 py-2 hover:bg-elevated"
          :class="{ 'opacity-50': dragging.includes(monitor.id) }"
          draggable="true"
          @dragstart="onDragStart($event, monitor)"
          @dragend="onDragEnd"
        >
          <input
            type="checkbox"
            class="checkbox"
            :checked="selected.includes(monitor.id)"
            :aria-label="monitor.name"
            @change="toggleSelected(monitor.id)"
          >
          <span class="size-2.5 shrink-0 rounded-full" :class="dotClass[tone(monitor)]" :title="toneLabel(monitor)" />
          <NuxtLink :to="`/monitors/${monitor.id}`" class="min-w-0 flex-1 truncate text-sm text-default hover:text-highlighted" draggable="false">
            {{ monitor.name }}
            <span class="sr-only">({{ toneLabel(monitor) }})</span>
          </NuxtLink>
          <span class="hidden text-xs uppercase text-muted sm:inline">{{ monitor.type }}</span>
          <UDropdownMenu v-if="targets.length" :items="moveItems(monitor)" :content="{ align: 'end' }">
            <UButton variant="ghost" color="neutral" size="xs" icon="i-heroicons-arrows-right-left" :aria-label="t('Move to')" :title="t('Move to')" />
          </UDropdownMenu>
          <UIcon name="i-heroicons-bars-2" class="hidden size-4 cursor-grab text-dimmed sm:block" aria-hidden="true" />
        </li>
      </ul>
    </section>
  </div>
</template>
