<template>
  <div
    class="incident-banner"
    :class="[`incident-${incident.style}`, { 'edit-mode': editMode }]"
    role="alert"
  >
    <!-- Edit mode header -->
    <div v-if="editMode && editIncidentMode" class="incident-label">
      <strong>{{ $t('Title') }}:</strong>
    </div>
    
    <!-- Title -->
    <h4 
      v-if="editIncidentMode"
      ref="titleRef"
      class="incident-title"
      contenteditable="true"
      @input="onTitleInput"
    >
      {{ incident.title }}
    </h4>
    <h4 v-else class="incident-title">{{ incident.title }}</h4>
    
    <!-- Edit mode content label -->
    <div v-if="editMode && editIncidentMode" class="incident-label mt-2">
      <strong>{{ $t('Content') }}:</strong>
    </div>
    
    <!-- Content -->
    <div 
      v-if="editIncidentMode"
      ref="contentRef"
      class="incident-content editable"
      contenteditable="true"
      @input="onContentInput"
    >
      {{ incident.content }}
    </div>
    <div v-else class="incident-content" v-html="contentHTML" />
    
    <div v-if="editIncidentMode" class="form-text text-sm opacity-75">
      {{ $t('Markdown supported') }}
    </div>
    
    <!-- Date info -->
    <div class="incident-date mt-3">
      <span>{{ $t('Date Created') }}: {{ formatDate(incident.createdDate) }}</span>
      <span v-if="incident.createdDate"> ({{ dateFromNow(incident.createdDate) }})</span>
      <br />
      <span v-if="incident.lastUpdatedDate">
        {{ $t('Last Updated') }}: {{ formatDate(incident.lastUpdatedDate) }}
        ({{ dateFromNow(incident.lastUpdatedDate) }})
      </span>
    </div>
    
    <!-- Edit mode controls -->
    <div v-if="editMode" class="incident-actions mt-3">
      <template v-if="editIncidentMode">
        <UButton color="neutral" variant="outline" size="sm" @click="emit('post')">
          <UIcon name="i-heroicons-megaphone" class="mr-1" />
          {{ $t('Post') }}
        </UButton>
        
        <UButton color="neutral" variant="outline" size="sm" @click="emit('cancel')">
          <UIcon name="i-heroicons-x-mark" class="mr-1" />
          {{ $t('Cancel') }}
        </UButton>
        
        <!-- Style dropdown -->
        <UDropdownMenu
          :items="styleOptions"
          :content="{ align: 'start' }"
        >
          <UButton color="neutral" size="sm">
            {{ $t('Style') }}: {{ $t(incident.style) }}
            <UIcon name="i-heroicons-chevron-down" class="ml-1" />
          </UButton>
        </UDropdownMenu>
      </template>
      
      <template v-else-if="incident.id">
        <UButton color="neutral" variant="outline" size="sm" @click="emit('edit')">
          <UIcon name="i-heroicons-pencil" class="mr-1" />
          {{ $t('Edit') }}
        </UButton>
        
        <UButton color="neutral" variant="outline" size="sm" @click="emit('unpin')">
          <UIcon name="i-heroicons-link-slash" class="mr-1" />
          {{ $t('Delete') }}
        </UButton>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import utc from 'dayjs/plugin/utc'

dayjs.extend(relativeTime)
dayjs.extend(utc)

interface Incident {
  id?: number
  title: string
  content: string
  style: 'info' | 'warning' | 'danger' | 'primary' | 'light' | 'dark'
  createdDate?: string
  lastUpdatedDate?: string
}

const props = withDefaults(defineProps<{
  incident: Incident
  editMode?: boolean
  editIncidentMode?: boolean
}>(), {
  editMode: false,
  editIncidentMode: false
})

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'post'): void
  (e: 'cancel'): void
  (e: 'unpin'): void
  (e: 'update:incident', value: Incident): void
  (e: 'styleChange', style: string): void
}>()

const { t } = useI18n()

const titleRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)

// Sanitized HTML content
const contentHTML = computed(() => {
  if (!props.incident.content) return ''
  return DOMPurify.sanitize(marked(props.incident.content) as string)
})

// Style options for dropdown
const styleOptions = computed(() => [
  [
    { label: t('info'), click: () => emit('styleChange', 'info') },
    { label: t('warning'), click: () => emit('styleChange', 'warning') },
    { label: t('danger'), click: () => emit('styleChange', 'danger') },
    { label: t('primary'), click: () => emit('styleChange', 'primary') },
    { label: t('light'), click: () => emit('styleChange', 'light') },
    { label: t('dark'), click: () => emit('styleChange', 'dark') },
  ]
])

// Event handlers
function onTitleInput(e: Event) {
  const target = e.target as HTMLElement
  emit('update:incident', {
    ...props.incident,
    title: target.textContent || ''
  })
}

function onContentInput(e: Event) {
  const target = e.target as HTMLElement
  emit('update:incident', {
    ...props.incident,
    content: target.textContent || ''
  })
}

// Date formatting
function formatDate(date?: string) {
  if (!date) return ''
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

function dateFromNow(date?: string) {
  if (!date) return ''
  return dayjs.utc(date).fromNow()
}
</script>

<style scoped>
.incident-banner {
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 16px;
}

/* Style variants */
.incident-info {
  background-color: color-mix(in srgb, var(--uk-status-maintenance) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-maintenance-fg);
}

.incident-warning {
  background-color: color-mix(in srgb, var(--uk-status-pending) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-pending-fg);
}

.incident-danger {
  background-color: color-mix(in srgb, var(--uk-status-down) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-down-fg);
}

.incident-primary {
  background-color: color-mix(in srgb, var(--uk-status-up) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-up-fg);
}

.incident-light {
  background-color: var(--uk-bg-sunken);
  color: var(--uk-text-secondary);
}

.incident-dark {
  background-color: var(--uk-bg-raised);
  color: var(--uk-text);
}

.incident-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.incident-content {
  line-height: 1.6;
}

.incident-content.editable {
  min-height: 60px;
  padding: 8px;
  border: 1px dashed currentColor;
  border-radius: 4px;
  opacity: 0.8;
}

.incident-date {
  font-size: 12px;
  opacity: 0.75;
}

.incident-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.incident-label {
  font-size: 14px;
}
</style>
