<script setup lang="ts">
import type { MonitorGroup } from '~/composables/useWorkspaces'
import { workspaceErrorMessage } from '~/composables/useWorkspaces'
import { descendantIds, orderAsTree } from '~/server/services/workspace/tree'

// Create (no `group` prop) or edit a monitor group
const props = defineProps<{
  group?: MonitorGroup | null
  /** Workspace pre-selected for a new group */
  defaultWorkspaceId?: number | null
}>()

const emit = defineEmits<{
  saved: [group: MonitorGroup]
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const { workspaces, groups, createGroup, updateGroup } = useWorkspaces()

const saving = ref(false)
const nameError = ref('')
const form = reactive({ name: '', description: '', workspaceId: null as number | null, parent: null as number | null })

const isEdit = computed(() => !!props.group)
const movesMembers = computed(() =>
  isEdit.value && (props.group?.monitorCount ?? 0) > 0 && form.workspaceId !== (props.group?.workspaceId ?? null),
)

// Possible parents: groups of the chosen workspace, never the group itself or one of its subgroups
const parentOptions = computed(() => {
  const excluded = new Set<number>()
  if (props.group) {
    excluded.add(props.group.id)
    for (const id of descendantIds(groups.value, props.group.id)) excluded.add(id)
  }
  const candidates = groups.value.filter(g => !excluded.has(g.id) && (g.workspaceId ?? null) === form.workspaceId)
  return orderAsTree(candidates).map(({ item, path }) => ({ id: item.id, label: path }))
})

watch(open, (isOpen) => {
  if (!isOpen) return
  nameError.value = ''
  form.name = props.group?.name ?? ''
  form.description = props.group?.description ?? ''
  form.workspaceId = props.group ? props.group.workspaceId : props.defaultWorkspaceId ?? null
  form.parent = props.group?.parent ?? null
}, { immediate: true }) // also when created already open

// A subgroup lives in the workspace of its parent
watch(() => form.parent, (parentId) => {
  const parent = groups.value.find(g => g.id === parentId)
  if (parent) form.workspaceId = parent.workspaceId
})
watch(() => form.workspaceId, (workspaceId) => {
  const parent = groups.value.find(g => g.id === form.parent)
  if (parent && (parent.workspaceId ?? null) !== workspaceId) form.parent = null
})

async function submit() {
  if (!form.name.trim()) {
    nameError.value = t('Name is required')
    return
  }

  saving.value = true
  try {
    const input = { name: form.name.trim(), description: form.description.trim() || null, workspaceId: form.workspaceId, parent: form.parent }
    const saved = props.group ? await updateGroup(props.group.id, input) : await createGroup(input)
    toast.add({ title: isEdit.value ? t('Group updated') : t('Group created'), color: 'success' })
    emit('saved', saved)
    open.value = false
  } catch (e) {
    toast.add({ title: workspaceErrorMessage(e, t('Failed to save')), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    :open="open"
    :title="isEdit ? t('Edit Group') : t('New Group')"
    :description="t('groupDialogHint')"
    :ui="{ footer: 'justify-end' }"
    @update:open="open = $event"
  >
    <template #default>
      <span class="hidden" />
    </template>

    <template #body>
      <form id="group-form" class="space-y-4" @submit.prevent="submit">
        <UFormField :label="t('Group Name')" required :error="nameError || undefined">
          <UInput
            v-model="form.name"
            autofocus
            maxlength="100"
            :placeholder="t('groupNamePlaceholder')"
            class="w-full"
            @update:model-value="nameError = ''"
          />
        </UFormField>

        <UFormField :label="t('Description')">
          <UTextarea v-model="form.description" :rows="2" maxlength="500" class="w-full" />
        </UFormField>

        <UFormField :label="t('Workspace')" :help="movesMembers ? t('groupMoveMembersHint', [group?.monitorCount]) : undefined">
          <select v-model="form.workspaceId" class="select-field">
            <option :value="null">{{ t('No workspace') }}</option>
            <option v-for="workspace in workspaces" :key="workspace.id" :value="workspace.id">
              {{ workspace.name }}
            </option>
          </select>
        </UFormField>

        <UFormField :label="t('Parent group')" :help="t('parentGroupHint')">
          <select v-model="form.parent" class="select-field">
            <option :value="null">{{ t('None (top level)') }}</option>
            <option v-for="option in parentOptions" :key="option.id" :value="option.id">
              {{ option.label }}
            </option>
          </select>
        </UFormField>
      </form>
    </template>

    <template #footer>
      <UButton variant="ghost" color="neutral" :disabled="saving" @click="open = false">
        {{ t('Cancel') }}
      </UButton>
      <UButton type="submit" form="group-form" :loading="saving">
        {{ isEdit ? t('Save') : t('Create') }}
      </UButton>
    </template>
  </UModal>
</template>
