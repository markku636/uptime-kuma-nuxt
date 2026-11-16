<template>
  <div class="incident-editor">
    <!-- View Mode - Display Incident -->
    <div
      v-if="!isEditing && incident"
      class="incident-display"
      :class="[`incident-${incident.style}`]"
    >
      <h4 class="incident-title">{{ incident.title }}</h4>
      <div class="incident-content" v-html="contentHtml" />
      
      <div class="incident-meta">
        <span v-if="incident.createdDate">
          Created: {{ formatDate(incident.createdDate) }} ({{ dateFromNow(incident.createdDate) }})
        </span>
        <span v-if="incident.lastUpdatedDate">
          <br />
          Updated: {{ formatDate(incident.lastUpdatedDate) }} ({{ dateFromNow(incident.lastUpdatedDate) }})
        </span>
      </div>

      <div v-if="editMode" class="incident-actions">
        <button class="btn btn-light" @click="startEdit">
          <UIcon name="i-heroicons-pencil" class="me-1" />
          Edit
        </button>
        <button class="btn btn-light" @click="emit('unpin')">
          <UIcon name="i-heroicons-link-slash" class="me-1" />
          Delete
        </button>
      </div>
    </div>

    <!-- Edit Mode - Edit Form -->
    <div
      v-else-if="isEditing"
      class="incident-form"
      :class="[`incident-${localIncident.style}`]"
    >
      <div class="form-group">
        <label class="form-label">Title</label>
        <input
          v-model="localIncident.title"
          type="text"
          class="form-control"
          placeholder="Incident title..."
        />
      </div>

      <div class="form-group">
        <label class="form-label">Content</label>
        <textarea
          v-model="localIncident.content"
          class="form-control"
          rows="4"
          placeholder="Describe the incident..."
        ></textarea>
        <div class="form-text">Markdown supported</div>
      </div>

      <div class="form-group">
        <label class="form-label">Style</label>
        <div class="style-selector">
          <button
            v-for="style in styles"
            :key="style.value"
            class="style-btn"
            :class="[`btn-${style.value}`, { active: localIncident.style === style.value }]"
            @click="localIncident.style = style.value"
          >
            {{ style.label }}
          </button>
        </div>
      </div>

      <div class="incident-actions">
        <button class="btn btn-primary" @click="saveIncident">
          <UIcon name="i-heroicons-megaphone" class="me-1" />
          Post
        </button>
        <button class="btn btn-outline" @click="cancelEdit">
          <UIcon name="i-heroicons-x-mark" class="me-1" />
          Cancel
        </button>
      </div>
    </div>

    <!-- Create Button (when no incident) -->
    <button
      v-if="editMode && !incident && !isEditing"
      class="btn btn-primary create-btn"
      @click="createIncident"
    >
      <UIcon name="i-heroicons-megaphone" class="me-1" />
      Create Incident
    </button>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

interface Incident {
  id?: number
  title: string
  content: string
  style: 'info' | 'warning' | 'danger' | 'primary' | 'light' | 'dark'
  pin?: boolean
  createdDate?: string
  lastUpdatedDate?: string
}

const props = withDefaults(defineProps<{
  incident?: Incident | null
  editMode?: boolean
}>(), {
  incident: null,
  editMode: false
})

const emit = defineEmits<{
  'post': [incident: Incident]
  'unpin': []
  'cancel': []
}>()

const isEditing = ref(false)
const previousIncident = ref<Incident | null>(null)

const localIncident = ref<Incident>({
  title: '',
  content: '',
  style: 'primary'
})

const styles = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'danger', label: 'Danger' },
  { value: 'primary', label: 'Primary' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

// Computed
const contentHtml = computed(() => {
  if (props.incident?.content) {
    return DOMPurify.sanitize(marked(props.incident.content) as string)
  }
  return ''
})

// Watch for incident changes
watch(() => props.incident, (newIncident) => {
  if (newIncident) {
    localIncident.value = { ...newIncident }
  }
}, { immediate: true })

// Methods
function createIncident() {
  previousIncident.value = props.incident ? { ...props.incident } : null
  localIncident.value = {
    title: '',
    content: '',
    style: 'primary'
  }
  isEditing.value = true
}

function startEdit() {
  if (props.incident) {
    previousIncident.value = { ...props.incident }
    localIncident.value = { ...props.incident }
  }
  isEditing.value = true
}

function cancelEdit() {
  isEditing.value = false
  if (previousIncident.value) {
    localIncident.value = { ...previousIncident.value }
  }
  previousIncident.value = null
  emit('cancel')
}

function saveIncident() {
  if (!localIncident.value.title || !localIncident.value.content) {
    console.error('Please input title and content')
    return
  }
  emit('post', localIncident.value)
  isEditing.value = false
}

function formatDate(date: string) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

function dateFromNow(date: string) {
  return dayjs(date).fromNow()
}
</script>

<style scoped>
.incident-editor {
  margin-bottom: 16px;
}

.incident-display,
.incident-form {
  padding: 16px 20px;
  border-radius: 8px;
  margin-bottom: 16px;
}

/* Incident Styles */
.incident-info {
  background: color-mix(in srgb, var(--uk-status-maintenance) var(--uk-subtle-mix), transparent);
  border: 1px solid color-mix(in srgb, var(--uk-status-maintenance) 40%, transparent);
  color: var(--uk-status-maintenance-fg);
}

.incident-warning {
  background: color-mix(in srgb, var(--uk-status-pending) var(--uk-subtle-mix), transparent);
  border: 1px solid color-mix(in srgb, var(--uk-status-pending) 40%, transparent);
  color: var(--uk-status-pending-fg);
}

.incident-danger {
  background: color-mix(in srgb, var(--uk-status-down) var(--uk-subtle-mix), transparent);
  border: 1px solid color-mix(in srgb, var(--uk-status-down) 40%, transparent);
  color: var(--uk-status-down-fg);
}

.incident-primary {
  background: color-mix(in srgb, var(--uk-status-up) var(--uk-subtle-mix), transparent);
  border: 1px solid color-mix(in srgb, var(--uk-status-up) 40%, transparent);
  color: var(--uk-status-up-fg);
}

.incident-light {
  background: var(--uk-bg-sunken);
  border: 1px solid var(--uk-border);
  color: var(--uk-text-secondary);
}

.incident-dark {
  background: var(--uk-bg-surface);
  border: 1px solid var(--uk-border);
  color: var(--uk-text);
}

.incident-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 8px;
}

.incident-content {
  font-size: 0.875rem;
  line-height: 1.6;
}

.incident-content :deep(p) {
  margin-bottom: 8px;
}

.incident-meta {
  font-size: 0.75rem;
  opacity: 0.8;
  margin-top: 12px;
}

.incident-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 6px;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  font-size: 0.875rem;
  border: 1px solid currentColor;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.8);
  color: inherit;
}

.form-control:focus {
  outline: none;
  box-shadow: 0 0 0 2px currentColor;
}

.form-text {
  font-size: 0.75rem;
  opacity: 0.7;
  margin-top: 4px;
}

.style-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.style-btn {
  padding: 6px 12px;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.style-btn.active {
  border-color: currentColor;
  transform: scale(1.05);
}

.btn-info {
  background: color-mix(in srgb, var(--uk-status-maintenance) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-maintenance-fg);
}

.btn-warning {
  background: color-mix(in srgb, var(--uk-status-pending) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-pending-fg);
}

.btn-danger {
  background: color-mix(in srgb, var(--uk-status-down) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-down-fg);
}

.btn-primary {
  background: color-mix(in srgb, var(--uk-status-up) var(--uk-subtle-mix), transparent);
  color: var(--uk-status-up-fg);
}

.btn-light {
  background: var(--uk-bg-sunken);
  color: var(--uk-text-secondary);
}

.btn-dark {
  background: var(--uk-bg-surface);
  color: var(--uk-text);
}

.btn {
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  border: none;
}

.btn-outline {
  background: transparent;
  border: 1px solid currentColor;
}

.create-btn {
  background: var(--color-primary, #10b981);
  color: white;
}

.create-btn:hover {
  background: var(--color-primary-dark, #059669);
}

.me-1 {
  margin-right: 4px;
}
</style>
