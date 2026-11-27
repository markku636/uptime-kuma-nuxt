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
      
      <StatusIncidentUpdates v-if="incident.updates?.length" :updates="incident.updates" />

      <div v-if="editMode && incident.id" class="incident-update-form">
        <label class="form-label">Add progress update</label>
        <div class="update-row">
          <select v-model="updateStatus" class="form-control update-status" aria-label="Update status">
            <option v-for="option in updateStatuses" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <input v-model="updateMessage" class="form-control" maxlength="5000" placeholder="What changed?" aria-label="Update message" @keyup.enter="submitUpdate" />
          <button class="btn btn-light" :disabled="sendingUpdate || !updateMessage.trim()" @click="submitUpdate">
            {{ sendingUpdate ? 'Posting…' : 'Post update' }}
          </button>
        </div>
        <p v-if="updateError" role="status" class="update-error">{{ updateError }}</p>
      </div>

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
  updates?: { id: number; status: string; message: string; createdDate: string }[]
}

const props = withDefaults(defineProps<{
  incident?: Incident | null
  editMode?: boolean
  submitUpdate?: (payload: { status: string; message: string }) => Promise<boolean>
}>(), {
  incident: null,
  editMode: false,
  submitUpdate: undefined
})

const emit = defineEmits<{
  'post': [incident: Incident]
  'unpin': []
  'cancel': []
  'update': [payload: { status: string; message: string }]
}>()

const isEditing = ref(false)
const previousIncident = ref<Incident | null>(null)
const updateStatus = ref('update')
const updateMessage = ref('')
const sendingUpdate = ref(false)
const updateError = ref('')
const updateStatuses = [
  { value: 'update', label: 'Update' },
  { value: 'investigating', label: 'Investigating' },
  { value: 'identified', label: 'Identified' },
  { value: 'monitoring', label: 'Monitoring' },
  { value: 'resolved', label: 'Resolved' },
]

async function submitUpdate() {
  const message = updateMessage.value.trim()
  if (!message || sendingUpdate.value) return
  sendingUpdate.value = true
  updateError.value = ''
  try {
    const ok = props.submitUpdate
      ? await props.submitUpdate({ status: updateStatus.value, message })
      : true
    if (!ok) {
      updateError.value = 'Could not post update. Please try again.'
      return
    }
    updateMessage.value = ''
  } finally {
    sendingUpdate.value = false
  }
}

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
] as const

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
  background: #dbeafe;
  border: 1px solid #93c5fd;
  color: #1e40af;
}

.incident-warning {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  color: #92400e;
}

.incident-danger {
  background: #fee2e2;
  border: 1px solid #fca5a5;
  color: #991b1b;
}

.incident-primary {
  background: #d1fae5;
  border: 1px solid #6ee7b7;
  color: #065f46;
}

.incident-light {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  color: #374151;
}

.incident-dark {
  background: #1f2937;
  border: 1px solid #374151;
  color: #f9fafb;
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

.incident-update-form { margin-top: 14px; }
.update-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 6px; }
.update-status { flex: 0 0 150px; }
.update-row input { flex: 1 1 220px; }
.update-error { margin-top: 6px; font-size: .75rem; color: #b91c1c; }

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
  background: #dbeafe;
  color: #1e40af;
}

.btn-warning {
  background: #fef3c7;
  color: #92400e;
}

.btn-danger {
  background: #fee2e2;
  color: #991b1b;
}

.btn-primary {
  background: #d1fae5;
  color: #065f46;
}

.btn-light {
  background: #f9fafb;
  color: #374151;
}

.btn-dark {
  background: #1f2937;
  color: #f9fafb;
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
