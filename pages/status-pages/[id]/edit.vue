<script setup lang="ts">
import type { StatusPage } from '~/types'

definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

const isEdit = computed(() => !!route.params.id)
const statusPageId = computed(() => route.params.id as string)

const { data: statusPage, pending: loadingStatusPage } = useFetch<StatusPage>(
  () => `/api/v1/status-pages/${statusPageId.value}`,
  {
    immediate: isEdit.value,
    headers: useRequestHeaders(['cookie'])
  }
)

const { data: monitors } = useFetch('/api/v1/monitors', {
  headers: useRequestHeaders(['cookie'])
})

// Form state
const form = ref({
  title: '',
  slug: '',
  description: '',
  icon: '',
  theme: 'auto' as 'light' | 'dark' | 'auto',
  published: true,
  showTags: false,
  domainNameList: [] as string[],
  customCss: '',
  footerText: '',
  showPoweredBy: true,
  googleAnalyticsId: '',
  monitors: [] as number[]
})

const loading = ref(false)
const newDomain = ref('')

// Initialize form with status page data
watch(statusPage, (val) => {
  if (val) {
    form.value = {
      title: val.title,
      slug: val.slug,
      description: val.description || '',
      icon: val.icon || '',
      theme: val.theme || 'auto',
      published: val.published,
      showTags: val.showTags || false,
      domainNameList: val.domainNameList || [],
      customCss: val.customCss || '',
      footerText: val.footerText || '',
      showPoweredBy: val.showPoweredBy ?? true,
      googleAnalyticsId: val.googleAnalyticsId || '',
      monitors: val.monitors?.map((m: any) => m.id) || []
    }
  }
}, { immediate: true })

// Auto-generate slug from title
watch(() => form.value.title, (title) => {
  if (!isEdit.value && title) {
    form.value.slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
})

const themeOptions = [
  { value: 'auto', label: 'Auto (System)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

function addDomain() {
  if (newDomain.value && !form.value.domainNameList.includes(newDomain.value)) {
    form.value.domainNameList.push(newDomain.value)
    newDomain.value = ''
  }
}

function removeDomain(index: number) {
  form.value.domainNameList.splice(index, 1)
}

async function handleSubmit() {
  loading.value = true
  try {
    if (isEdit.value) {
      await $fetch(`/api/v1/status-pages/${statusPageId.value}`, {
        method: 'PUT',
        body: form.value
      })
      toast.add({
        title: 'Success',
        description: 'Status page updated successfully',
        color: 'green'
      })
    } else {
      await $fetch('/api/v1/status-pages', {
        method: 'POST',
        body: form.value
      })
      toast.add({
        title: 'Success',
        description: 'Status page created successfully',
        color: 'green'
      })
    }
    router.push('/status-pages')
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save status page',
      color: 'red'
    })
  } finally {
    loading.value = false
  }
}

const previewUrl = computed(() => {
  return `/status/${form.value.slug}`
})
</script>

<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <div class="mb-6">
      <NuxtLink
        to="/status-pages"
        class="inline-flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
      >
        <UIcon name="i-heroicons-arrow-left" class="w-4 h-4" />
        Back to Status Pages
      </NuxtLink>
    </div>

    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      <div class="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ isEdit ? 'Edit Status Page' : 'New Status Page' }}
        </h1>
        <UButton
          v-if="form.slug"
          variant="outline"
          icon="i-heroicons-eye"
          :to="previewUrl"
          target="_blank"
        >
          Preview
        </UButton>
      </div>

      <form class="p-6 space-y-6" @submit.prevent="handleSubmit">
        <!-- Basic Info -->
        <div class="space-y-4">
          <UFormField label="Title" required>
            <UInput v-model="form.title" placeholder="My Status Page" />
          </UFormField>

          <UFormField label="Slug (URL)" required>
            <div class="flex items-center gap-2">
              <span class="text-gray-500 dark:text-gray-400">/status/</span>
              <UInput
                v-model="form.slug"
                placeholder="my-status-page"
                class="flex-1"
                :disabled="isEdit"
              />
            </div>
          </UFormField>

          <UFormField label="Description">
            <UTextarea
              v-model="form.description"
              placeholder="Describe your status page..."
              :rows="3"
            />
          </UFormField>

          <UFormField label="Icon / Logo URL">
            <UInput
              v-model="form.icon"
              placeholder="https://example.com/logo.png"
            />
          </UFormField>
        </div>

        <!-- Monitors -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Monitors</h3>
          
          <UFormField label="Select Monitors to Display">
            <USelectMenu
              v-model="form.monitors"
              :items="(monitors || []).map((m: any) => ({ label: m.name, value: m.id }))"
              multiple
              placeholder="Select monitors..."
            />
          </UFormField>

          <UCheckbox v-model="form.showTags" label="Show tags on status page" />
        </div>

        <!-- Appearance -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Appearance</h3>
          
          <UFormField label="Theme">
            <USelect
              v-model="form.theme"
              :items="themeOptions.map(t => ({ label: t.label, value: t.value }))"
            />
          </UFormField>

          <UFormField label="Custom CSS">
            <UTextarea
              v-model="form.customCss"
              placeholder=".status-page { ... }"
              :rows="4"
              class="font-mono text-sm"
            />
          </UFormField>

          <UFormField label="Footer Text">
            <UInput
              v-model="form.footerText"
              placeholder="© 2024 My Company"
            />
          </UFormField>

          <UCheckbox v-model="form.showPoweredBy" label="Show 'Powered by Uptime Kuma'" />
        </div>

        <!-- Custom Domains -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Custom Domains</h3>
          
          <div class="flex items-center gap-2">
            <UInput
              v-model="newDomain"
              placeholder="status.example.com"
              class="flex-1"
              @keyup.enter="addDomain"
            />
            <UButton @click="addDomain">Add</UButton>
          </div>

          <div v-if="form.domainNameList.length" class="space-y-2">
            <div
              v-for="(domain, index) in form.domainNameList"
              :key="index"
              class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg"
            >
              <span class="text-gray-900 dark:text-white">{{ domain }}</span>
              <UButton
                variant="ghost"
                color="red"
                icon="i-heroicons-trash"
                size="xs"
                @click="removeDomain(index)"
              />
            </div>
          </div>
        </div>

        <!-- Analytics -->
        <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 class="text-lg font-medium text-gray-900 dark:text-white">Analytics</h3>
          
          <UFormField label="Google Analytics ID">
            <UInput
              v-model="form.googleAnalyticsId"
              placeholder="G-XXXXXXXXXX"
            />
          </UFormField>
        </div>

        <!-- Publishing -->
        <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
          <UCheckbox v-model="form.published" label="Publish this status page" />
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <UButton variant="ghost" @click="router.push('/status-pages')">
            Cancel
          </UButton>
          <UButton type="submit" :loading="loading">
            {{ isEdit ? 'Update' : 'Create' }} Status Page
          </UButton>
        </div>
      </form>
    </div>
  </div>
</template>
