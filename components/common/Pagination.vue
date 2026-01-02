<template>
  <div class="flex items-center gap-2">
    <UInput 
      :model-value="currentPage.toString()"
      type="number"
      :min="1"
      :max="totalPages"
      class="w-16"
      @update:model-value="handleInput"
    />
    <span class="text-sm text-gray-500">/ {{ totalPages }}</span>
    <div class="flex gap-1">
      <UButton 
        icon="i-heroicons-chevron-double-left" 
        variant="ghost" 
        size="sm"
        :disabled="currentPage <= 1"
        @click="goToPage(1)"
      />
      <UButton 
        icon="i-heroicons-chevron-left" 
        variant="ghost" 
        size="sm"
        :disabled="currentPage <= 1"
        @click="goToPage(currentPage - 1)"
      />
      <UButton 
        icon="i-heroicons-chevron-right" 
        variant="ghost" 
        size="sm"
        :disabled="currentPage >= totalPages"
        @click="goToPage(currentPage + 1)"
      />
      <UButton 
        icon="i-heroicons-chevron-double-right" 
        variant="ghost" 
        size="sm"
        :disabled="currentPage >= totalPages"
        @click="goToPage(totalPages)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  currentPage: number
  totalPages: number
  totalItems?: number
  itemsPerPage?: number
}

const props = withDefaults(defineProps<Props>(), {
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  itemsPerPage: 10
})

const emit = defineEmits<{
  'update:currentPage': [page: number]
  change: [page: number]
}>()

function goToPage(page: number) {
  const validPage = Math.max(1, Math.min(page, props.totalPages))
  emit('update:currentPage', validPage)
  emit('change', validPage)
}

function handleInput(value: string | number) {
  const page = parseInt(value.toString(), 10)
  if (!isNaN(page)) {
    goToPage(page)
  }
}
</script>
