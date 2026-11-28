<script setup lang="ts">
import type { StatusPage } from '~/types'

definePageMeta({
  middleware: ['auth']
})

const route = useRoute()
const router = useRouter()
const toast = useToast()

// /status-pages/new/edit is the create mode of this shared editor.
const isEdit = computed(() => !!route.params.id && route.params.id !== 'new')
const statusPageId = computed(() => route.params.id as string)

const { data: statusPage, pending: loadingStatusPage } = useFetch<any>(
  () => `/api/v1/status-pages/${statusPageId.value}/config`,
  {
    immediate: isEdit.value,
    headers: useRequestHeaders(['cookie'])
  }
)



// Form state
const form = ref({
  title: '',
  slug: '',
  description: '',
  icon: '',
  theme: 'auto' as 'light' | 'dark' | 'auto',
  published: true,
  password: '' as string | null,
  showTags: false,
  noIndex: false,
  domainNameList: [] as string[],
  customCss: '',
  footerText: '',
  showPoweredBy: true,
  googleAnalyticsId: '',
  monitors: [] as number[]
})

const originalGroups=ref<any[]>([]),selectedMetadata=ref<any[]>([])
const passwordProtected=ref(false)
const clearPassword=ref(false)
const loading = ref(false)
const newDomain = ref('')

// Email subscribers (loaded only for saved pages)
const subscribers = ref<any[]>([])
const outboxRows = ref<any[]>([])
const loadingSubscribers = ref(false)
async function loadSubscribers(): Promise<void> {
  if (!isEdit.value || !form.value.slug) return
  loadingSubscribers.value = true
  try {
    const [res, outbox] = await Promise.all([
      $fetch<any>(`/api/v1/status-pages/${form.value.slug}/subscribers`),
      $fetch<any>(`/api/v1/status-pages/${form.value.slug}/subscribers/outbox`, { query: { limit: 20 } }),
    ])
    subscribers.value = res?.data || []
    outboxRows.value = outbox?.data || []
  } catch { subscribers.value = []; outboxRows.value = [] } finally { loadingSubscribers.value = false }
}
async function verifySubscriber(id: number): Promise<void> {
  await $fetch(`/api/v1/status-pages/${form.value.slug}/subscribers/${id}/verify`, { method: 'POST' })
  toast.add({ title: 'Subscriber verified', color: 'success' })
  await loadSubscribers()
}
async function deleteSubscriber(id: number): Promise<void> {
  await $fetch(`/api/v1/status-pages/${form.value.slug}/subscribers/${id}`, { method: 'DELETE' })
  toast.add({ title: 'Subscriber removed', color: 'success' })
  await loadSubscribers()
}
onMounted(loadSubscribers)

// Initialize form with status page data
watch(statusPage, (response) => {
  const val=response?.data
  if (val) {
    originalGroups.value=val.publicGroupList||[];selectedMetadata.value=originalGroups.value.flatMap(group=>group.monitorList)
    passwordProtected.value=!!val.passwordProtected
    form.value = {
      title: val.title,
      slug: val.slug,
      description: val.description || '',
      icon: val.icon || '',
      theme: val.theme || 'auto',
      published: val.published,
      password: '',
      showTags: val.showTags || false,
      noIndex: !!val.noIndex,
      domainNameList: val.domainNameList || [],
      customCss: val.customCss || '',
      footerText: val.footerText || '',
      showPoweredBy: val.showPoweredBy ?? true,
      googleAnalyticsId: val.googleAnalyticsId || '',
      monitors: [...new Set(selectedMetadata.value.map((m:any)=>m.id))]
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

function statusPagePayload(){const selected=new Set(form.value.monitors),known=new Set(originalGroups.value.flatMap(group=>group.monitorList.map((monitor:any)=>monitor.id))),groups=originalGroups.value.map(group=>({...group,monitorList:group.monitorList.filter((monitor:any)=>selected.has(monitor.id)).map((monitor:any)=>({id:monitor.id}))}));if(!groups.length)groups.push({id:0,name:'Monitors',weight:1,monitorList:[]});groups[0].monitorList.push(...form.value.monitors.filter(id=>!known.has(id)).map(id=>({id})));const {monitors,password,domainNameList:_domains,...metadata}=form.value;const payload:any={...metadata,publicGroupList:groups};if(password)payload.password=password;else if(clearPassword.value&&passwordProtected.value)payload.password=null;return payload}
async function handleSubmit() {
  loading.value = true
  try {
    if (isEdit.value) {
      await $fetch(`/api/v1/status-pages/${statusPageId.value}`, {
        method: 'PUT',
        body: statusPagePayload()
      })
      toast.add({
        title: 'Success',
        description: 'Status page updated successfully',
        color: 'success'
      })
    } else {
      await $fetch('/api/v1/status-pages', {
        method: 'POST',
        body: form.value
      })
      toast.add({
        title: 'Success',
        description: 'Status page created successfully',
        color: 'success'
      })
    }
    router.push('/status-pages')
  } catch (error: any) {
    toast.add({
      title: 'Error',
      description: error.data?.message || 'Failed to save status page',
      color: 'error'
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
  <div class="max-w-4xl mr-auto px-4 py-8">
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
            <StatusPageMonitorSelector v-model="form.monitors" :monitors="selectedMetadata" />
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

          <UCheckbox v-model="form.showPoweredBy" label="Show 'Powered by SealWatch'" />
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
        <div class="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <UCheckbox v-model="form.published" label="Publish this status page" />
          <UCheckbox v-model="form.noIndex" label="Hide from search engines (noindex, nofollow)" />
          <UFormField label="Password protection" hint="Leave blank to keep the current password; enter at least 6 characters to require one.">
            <UInput v-model="form.password" type="password" autocomplete="new-password" placeholder="Optional password" />
          </UFormField>
          <UCheckbox v-if="isEdit && passwordProtected" v-model="clearPassword" label="Remove password protection" />
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

    <div v-if="isEdit" class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mt-6 p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Email subscribers</h2>
        <button class="text-sm underline" :disabled="loadingSubscribers" @click="loadSubscribers">Refresh</button>
      </div>
      <p class="text-sm text-gray-500 mb-3">Visitors subscribe from the public page and confirm by email. Confirm manually here if no SMTP relay is configured.</p>
      <p v-if="!subscribers.length" class="text-sm text-gray-500">No subscribers yet.</p>
      <div v-for="row in subscribers" :key="row.id" class="flex flex-wrap items-center gap-3 border-t border-gray-200 dark:border-gray-700 py-3">
        <span class="text-sm text-gray-900 dark:text-gray-100">{{ row.email }}</span>
        <span class="badge" :class="row.verified ? 'badge-success' : 'badge-warning'">{{ row.verified ? 'verified' : 'pending' }}</span>
        <span class="text-xs text-gray-500">{{ new Date(row.createdAt).toLocaleString() }}</span>
        <div class="ml-auto flex gap-2">
          <UButton v-if="!row.verified" variant="outline" size="xs" @click="verifySubscriber(row.id)">Verify</UButton>
          <UButton variant="ghost" size="xs" color="error" @click="deleteSubscriber(row.id)">Remove</UButton>
        </div>
      </div>

      <div v-if="outboxRows.length" class="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
        <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-2">Notification log</h3>
        <div v-for="row in outboxRows" :key="row.id" class="flex flex-wrap gap-3 text-xs text-gray-500 py-1">
          <span>#{{ row.id }}</span>
          <span>{{ row.eventType }}</span>
          <span :class="row.status === 'delivered' ? 'text-green-500' : row.status === 'dead' ? 'text-red-500' : 'text-amber-500'">{{ row.status }}</span>
          <span>attempts {{ row.attempts }}</span>
          <span>{{ new Date(row.createdAt).toLocaleString() }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
