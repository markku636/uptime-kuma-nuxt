<script setup lang="ts">
// Workspace + group pickers for the monitor forms, with quick "new" buttons
// so a workspace or group can be created without leaving the form.
// A monitor inside a group always lives in the group's workspace.

import { orderAsTree } from '~/server/services/workspace/tree'

const props = defineProps<{
  /** Id of the monitor being edited (a group cannot be its own parent) */
  monitorId?: number | null
  disabled?: boolean
}>()

const workspaceId = defineModel<number | null>('workspaceId', { default: null })
const parent = defineModel<number | null>('parent', { default: null })

const { t } = useI18n()
const { workspaces, groups, loaded } = useWorkspaces()

const workspaceDialogOpen = ref(false)
const groupDialogOpen = ref(false)

const workspaceName = (id: number | null) => workspaces.value.find(w => w.id === id)?.name

// Groups of the chosen workspace first; with no workspace chosen, every group
const groupOptions = computed(() =>
  orderAsTree(groups.value)
    .filter(({ item: g }) => g.id !== props.monitorId)
    .filter(({ item: g }) => workspaceId.value == null || g.workspaceId === workspaceId.value || g.id === parent.value)
    .map(({ item: g, path }) => ({
      id: g.id,
      label: workspaceId.value == null && g.workspaceId != null ? `${workspaceName(g.workspaceId)} / ${path}` : path,
    })),
)

// Picking a group pulls the monitor into that group's workspace
// (also once the groups are loaded, e.g. when the form was opened with ?group=)
watch([parent, groups], () => {
  const group = groups.value.find(g => g.id === parent.value)
  if (group && workspaceId.value !== group.workspaceId) workspaceId.value = group.workspaceId
}, { immediate: true })

// Switching workspace drops a group that belongs to another one
watch(workspaceId, (id) => {
  const group = groups.value.find(g => g.id === parent.value)
  if (group && group.workspaceId !== id) parent.value = null
})
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2">
    <div class="form-group">
      <label class="input-label" for="placement-workspace">{{ t('Workspace') }}</label>
      <div class="flex gap-2">
        <select id="placement-workspace" v-model="workspaceId" class="select-field" :disabled="disabled || !loaded">
          <option :value="null">{{ t('No workspace') }}</option>
          <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">{{ workspace.name }}</option>
        </select>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-heroicons-plus"
          :disabled="disabled"
          :aria-label="t('New Workspace')"
          :title="t('New Workspace')"
          @click="workspaceDialogOpen = true"
        />
      </div>
    </div>

    <div class="form-group">
      <label class="input-label" for="placement-group">{{ t('Group') }}</label>
      <div class="flex gap-2">
        <select id="placement-group" v-model="parent" class="select-field" :disabled="disabled || !loaded">
          <option :value="null">{{ t('No group') }}</option>
          <option v-for="group in groupOptions" :key="group.id" :value="group.id">{{ group.label }}</option>
        </select>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-heroicons-plus"
          :disabled="disabled"
          :aria-label="t('New Group')"
          :title="t('New Group')"
          @click="groupDialogOpen = true"
        />
      </div>
    </div>

    <p class="text-xs text-dimmed md:col-span-2">
      {{ t('placementHint') }}
      <NuxtLink to="/settings/workspaces" class="link">{{ t('Manage groups') }}</NuxtLink>
    </p>

    <WorkspaceDialog v-model:open="workspaceDialogOpen" @saved="workspaceId = $event.id" />
    <GroupDialog v-model:open="groupDialogOpen" :default-workspace-id="workspaceId" @saved="parent = $event.id" />
  </div>
</template>
