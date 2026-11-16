<script setup lang="ts">
import type { Workspace } from '~/composables/useWorkspaces'
import { WORKSPACE_COLORS, workspaceErrorMessage } from '~/composables/useWorkspaces'

// Create (no `workspace` prop) or edit a workspace
const props = defineProps<{
  workspace?: Workspace | null
}>()

const emit = defineEmits<{
  saved: [workspace: Workspace]
}>()

const open = defineModel<boolean>('open', { default: false })

const { t } = useI18n()
const toast = useToast()
const { createWorkspace, updateWorkspace } = useWorkspaces({ autoFetch: false })

const saving = ref(false)
const nameError = ref('')
const form = reactive({ name: '', description: '', color: WORKSPACE_COLORS[0] })

const isEdit = computed(() => !!props.workspace)

watch(open, (isOpen) => {
  if (!isOpen) return
  nameError.value = ''
  form.name = props.workspace?.name ?? ''
  form.description = props.workspace?.description ?? ''
  form.color = props.workspace?.color ?? WORKSPACE_COLORS[0]
}, { immediate: true }) // also when created already open

async function submit() {
  if (!form.name.trim()) {
    nameError.value = t('Name is required')
    return
  }

  saving.value = true
  try {
    const input = { name: form.name.trim(), description: form.description.trim() || null, color: form.color }
    const saved = props.workspace
      ? await updateWorkspace(props.workspace.id, input)
      : await createWorkspace(input)
    toast.add({ title: isEdit.value ? t('Workspace updated') : t('Workspace created'), color: 'success' })
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
    :title="isEdit ? t('Edit Workspace') : t('New Workspace')"
    :description="t('workspaceDialogHint')"
    :ui="{ footer: 'justify-end' }"
    @update:open="open = $event"
  >
    <template #default>
      <span class="hidden" />
    </template>

    <template #body>
      <form id="workspace-form" class="space-y-4" @submit.prevent="submit">
        <UFormField :label="t('Name')" required :error="nameError || undefined">
          <UInput
            v-model="form.name"
            autofocus
            maxlength="100"
            :placeholder="t('workspaceNamePlaceholder')"
            class="w-full"
            @update:model-value="nameError = ''"
          />
        </UFormField>

        <UFormField :label="t('Description')">
          <UTextarea v-model="form.description" :rows="2" maxlength="500" class="w-full" />
        </UFormField>

        <UFormField :label="t('Color')">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in WORKSPACE_COLORS"
              :key="color"
              type="button"
              class="size-8 rounded-full border-2 transition-transform"
              :class="form.color === color ? 'border-inverted scale-110' : 'border-transparent'"
              :style="{ backgroundColor: color }"
              :aria-label="color"
              :aria-pressed="form.color === color"
              @click="form.color = color"
            />
          </div>
        </UFormField>
      </form>
    </template>

    <template #footer>
      <UButton variant="ghost" color="neutral" :disabled="saving" @click="open = false">
        {{ t('Cancel') }}
      </UButton>
      <UButton type="submit" form="workspace-form" :loading="saving">
        {{ isEdit ? t('Save') : t('Create') }}
      </UButton>
    </template>
  </UModal>
</template>
