<script setup lang="ts">
import type { MonitorGroup } from '~/composables/useWorkspaces'
import { workspaceErrorMessage } from '~/composables/useWorkspaces'

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
const { workspaces, createGroup, updateGroup } = useWorkspaces()

const saving = ref(false)
const nameError = ref('')
const form = reactive({ name: '', description: '', workspaceId: null as number | null })

const isEdit = computed(() => !!props.group)
const movesMembers = computed(() =>
  isEdit.value && (props.group?.monitorCount ?? 0) > 0 && form.workspaceId !== (props.group?.workspaceId ?? null),
)

watch(open, (isOpen) => {
  if (!isOpen) return
  nameError.value = ''
  form.name = props.group?.name ?? ''
  form.description = props.group?.description ?? ''
  form.workspaceId = props.group ? props.group.workspaceId : props.defaultWorkspaceId ?? null
})

async function submit() {
  if (!form.name.trim()) {
    nameError.value = t('Name is required')
    return
  }

  saving.value = true
  try {
    const input = { name: form.name.trim(), description: form.description.trim() || null, workspaceId: form.workspaceId }
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
