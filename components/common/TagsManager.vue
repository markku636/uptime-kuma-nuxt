<script setup lang="ts">
import type { Tag } from '~/types'

interface Props {
  modelValue: Tag[]
  availableTags?: Tag[]
  editable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  availableTags: () => [],
  editable: true
})

const emit = defineEmits<{
  (e: 'update:modelValue', tags: Tag[]): void
  (e: 'create', name: string, color: string): void
}>()

const showAddDialog = ref(false)
const newTagName = ref('')
const newTagColor = ref('#6366f1')
const newTagValue = ref('')

const selectedTags = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const availableTagsFiltered = computed(() => {
  const selectedIds = new Set(selectedTags.value.map(t => t.id))
  return props.availableTags.filter(t => !selectedIds.has(t.id))
})

function addTag(tag: Tag) {
  const tagWithValue = { ...tag, value: newTagValue.value || null }
  emit('update:modelValue', [...selectedTags.value, tagWithValue])
  newTagValue.value = ''
}

function removeTag(tagId: number) {
  emit('update:modelValue', selectedTags.value.filter(t => t.id !== tagId))
}

function createTag() {
  if (newTagName.value.trim()) {
    emit('create', newTagName.value.trim(), newTagColor.value)
    newTagName.value = ''
    newTagColor.value = '#6366f1'
    showAddDialog.value = false
  }
}

const predefinedColors = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280'  // gray
]
</script>

<template>
  <div class="space-y-3">
    <!-- Selected Tags -->
    <div v-if="selectedTags.length > 0" class="flex flex-wrap gap-2">
      <div
        v-for="tag in selectedTags"
        :key="tag.id"
        class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm"
        :style="{
          backgroundColor: tag.color + '20',
          color: tag.color,
          border: `1px solid ${tag.color}`
        }"
      >
        <span>{{ tag.name }}</span>
        <span v-if="tag.value" class="opacity-75">: {{ tag.value }}</span>
        <button
          v-if="editable"
          class="ml-1 hover:opacity-70"
          @click="removeTag(tag.id)"
        >
          <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Add Tag Dropdown -->
    <div v-if="editable" class="flex items-center gap-2">
      <UPopover v-if="availableTagsFiltered.length > 0">
        <UButton
          variant="outline"
          size="sm"
          icon="i-heroicons-plus"
        >
          Add Tag
        </UButton>

        <template #content>
          <div class="p-2 w-64 max-h-64 overflow-y-auto">
            <div class="space-y-1">
              <div
                v-for="tag in availableTagsFiltered"
                :key="tag.id"
                class="flex items-center gap-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                @click="addTag(tag)"
              >
                <span
                  class="w-3 h-3 rounded-full"
                  :style="{ backgroundColor: tag.color }"
                />
                <span>{{ tag.name }}</span>
              </div>
            </div>
          </div>
        </template>
      </UPopover>

      <UButton
        variant="ghost"
        size="sm"
        icon="i-heroicons-tag"
        @click="showAddDialog = true"
      >
        Create New
      </UButton>
    </div>

    <!-- Create Tag Dialog -->
    <UModal v-model:open="showAddDialog">
      <template #header>
        <h3 class="text-lg font-semibold">Create New Tag</h3>
      </template>

      <div class="p-4 space-y-4">
        <UFormField label="Tag Name" required>
          <UInput
            v-model="newTagName"
            placeholder="e.g., Production"
          />
        </UFormField>

        <UFormField label="Color">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in predefinedColors"
              :key="color"
              class="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
              :class="newTagColor === color ? 'border-gray-900 dark:border-white' : 'border-transparent'"
              :style="{ backgroundColor: color }"
              @click="newTagColor = color"
            />
          </div>
          <UInput
            v-model="newTagColor"
            type="color"
            class="mt-2 w-full h-10"
          />
        </UFormField>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" @click="showAddDialog = false">
            Cancel
          </UButton>
          <UButton @click="createTag">
            Create Tag
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
