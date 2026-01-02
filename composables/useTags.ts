// Tags composable for managing monitor tags
import type { Ref } from 'vue'

interface Tag {
  id: number
  name: string
  color: string
  createdAt?: string
  updatedAt?: string
}

interface UseTagsOptions {
  autoFetch?: boolean
}

export function useTags(options: UseTagsOptions = {}) {
  const { autoFetch = true } = options

  // State
  const tags: Ref<Tag[]> = ref([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Methods
  async function fetchTags() {
    try {
      isLoading.value = true
      error.value = null
      
      const data = await $fetch<Tag[]>('/api/v1/tags')
      tags.value = data
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch tags'
      console.error('Failed to fetch tags:', e)
    } finally {
      isLoading.value = false
    }
  }

  async function createTag(tagData: { name: string; color: string }) {
    try {
      isLoading.value = true
      const data = await $fetch<Tag>('/api/v1/tags', {
        method: 'POST',
        body: tagData
      })
      
      tags.value.push(data)
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to create tag'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateTag(id: number, tagData: { name?: string; color?: string }) {
    try {
      isLoading.value = true
      const data = await $fetch<Tag>(`/api/v1/tags/${id}`, {
        method: 'PUT',
        body: tagData
      })
      
      // Update in list
      const index = tags.value.findIndex(t => t.id === id)
      if (index !== -1) {
        tags.value[index] = data
      }
      
      return data
    } catch (e: any) {
      error.value = e.message || 'Failed to update tag'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteTag(id: number) {
    try {
      isLoading.value = true
      await $fetch(`/api/v1/tags/${id}`, {
        method: 'DELETE'
      })
      
      // Remove from list
      tags.value = tags.value.filter(t => t.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to delete tag'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function getTag(id: number): Tag | undefined {
    return tags.value.find(t => t.id === id)
  }

  function getTagByName(name: string): Tag | undefined {
    return tags.value.find(t => t.name.toLowerCase() === name.toLowerCase())
  }

  // Auto fetch on mount
  if (autoFetch) {
    onMounted(() => {
      fetchTags()
    })
  }

  return {
    // State
    tags,
    isLoading,
    error,

    // Methods
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    getTag,
    getTagByName,
  }
}
