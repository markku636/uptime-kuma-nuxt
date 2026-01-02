<script setup lang="ts">
interface StatusPage {
  id?: number
  slug: string
  title: string
  description: string | null
  theme: string
  published: boolean
  showTags: boolean
  customCSS: string | null
  googleAnalyticsId: string | null
  monitorIds?: number[]
}

interface Props {
  statusPage?: StatusPage | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  statusPage: null,
  loading: false
})

const emit = defineEmits<{
  (e: 'submit', data: any): void
  (e: 'cancel'): void
}>()

// Theme options
const themeOptions = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'auto', label: 'Auto (System)' }
]

// Fetch available monitors
const { data: monitors } = await useFetch<any[]>('/api/v1/monitors')

// Form data
const form = ref<StatusPage>({
  slug: '',
  title: '',
  description: '',
  theme: 'auto',
  published: false,
  showTags: true,
  customCSS: '',
  googleAnalyticsId: '',
  monitorIds: []
})

// Initialize form with existing data
onMounted(() => {
  if (props.statusPage) {
    form.value = {
      slug: props.statusPage.slug,
      title: props.statusPage.title,
      description: props.statusPage.description || '',
      theme: props.statusPage.theme,
      published: props.statusPage.published,
      showTags: props.statusPage.showTags,
      customCSS: props.statusPage.customCSS || '',
      googleAnalyticsId: props.statusPage.googleAnalyticsId || '',
      monitorIds: props.statusPage.monitorIds || []
    }
  }
})

// Auto-generate slug from title
watch(() => form.value.title, (newTitle) => {
  if (!props.statusPage) {
    form.value.slug = newTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }
})

function handleSubmit() {
  emit('submit', { ...form.value })
}

// Monitor selection
const monitorOptions = computed(() => {
  return (monitors.value || []).map((m: any) => ({
    value: m.id,
    label: m.name
  }))
})
</script>

<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <!-- Basic Info -->
    <div class="space-y-4">
      <UFormField label="Page Title" required>
        <UInput
          v-model="form.title"
          placeholder="e.g., Service Status"
          required
        />
      </UFormField>

      <UFormField label="Slug (URL Path)" required>
        <UInput
          v-model="form.slug"
          placeholder="e.g., service-status"
          :disabled="!!statusPage"
          required
        >
          <template #leading>
            <span class="text-gray-400 text-sm">/status/</span>
          </template>
        </UInput>
        <template #hint>
          <span class="text-xs text-gray-500">
            This will be the URL path: /status/{{ form.slug || 'your-slug' }}
          </span>
        </template>
      </UFormField>

      <UFormField label="Description">
        <UTextarea
          v-model="form.description"
          placeholder="Optional description shown on the status page"
          :rows="2"
        />
      </UFormField>
    </div>

    <!-- Monitors Selection -->
    <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        Select Monitors to Display
      </h3>
      
      <div v-if="!monitors?.length" class="text-sm text-gray-500">
        No monitors available. Create monitors first.
      </div>
      
      <div v-else class="space-y-2 max-h-48 overflow-y-auto">
        <UCheckbox
          v-for="monitor in monitors"
          :key="monitor.id"
          :model-value="form.monitorIds?.includes(monitor.id)"
          :label="monitor.name"
          @update:model-value="(checked: boolean) => {
            if (checked) {
              form.monitorIds = [...(form.monitorIds || []), monitor.id]
            } else {
              form.monitorIds = form.monitorIds?.filter(id => id !== monitor.id)
            }
          }"
        />
      </div>
    </div>

    <!-- Appearance -->
    <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        Appearance
      </h3>
      
      <div class="space-y-4">
        <UFormField label="Theme">
          <USelect
            v-model="form.theme"
            :items="themeOptions.map(t => ({ label: t.label, value: t.value }))"
          />
        </UFormField>

        <UCheckbox
          v-model="form.showTags"
          label="Show monitor tags"
        />

        <UFormField label="Custom CSS">
          <UTextarea
            v-model="form.customCSS"
            placeholder="/* Your custom CSS */"
            :rows="3"
            class="font-mono text-sm"
          />
        </UFormField>
      </div>
    </div>

    <!-- Analytics -->
    <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        Analytics
      </h3>
      
      <UFormField label="Google Analytics ID">
        <UInput
          v-model="form.googleAnalyticsId"
          placeholder="e.g., G-XXXXXXXXXX"
        />
      </UFormField>
    </div>

    <!-- Publish Status -->
    <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
      <UCheckbox
        v-model="form.published"
        label="Publish this status page (make it publicly accessible)"
      />
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-4">
      <UButton variant="ghost" @click="emit('cancel')">
        Cancel
      </UButton>
      <UButton type="submit" :loading="loading">
        {{ statusPage ? 'Update' : 'Create' }}
      </UButton>
    </div>
  </form>
</template>
