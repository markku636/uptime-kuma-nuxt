<script setup lang="ts">
definePageMeta({ middleware: ['auth'] })

const toast = useToast()
const notifications = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingNotification = ref<any>(null)

const notificationTypes = [
  { value: 'discord', label: 'Discord' },
  { value: 'slack', label: 'Slack' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'line', label: 'LINE' }
]

const form = ref({ name: '', type: 'discord', config: {}, isDefault: false, active: true })

onMounted(async () => { await fetchNotifications() })

async function fetchNotifications() {
  loading.value = true
  try { notifications.value = await $fetch('/api/v1/notifications') as any[] }
  catch (error: any) { toast.add({ title: 'Error', description: error.data?.message || 'Failed to load', color: 'error' }) }
  finally { loading.value = false }
}

function openAddForm() {
  editingNotification.value = null
  form.value = { name: '', type: 'discord', config: {}, isDefault: false, active: true }
  showForm.value = true
}

function openEditForm(notification: any) {
  editingNotification.value = notification
  form.value = { name: notification.name, type: notification.type, config: notification.config || {}, isDefault: notification.isDefault, active: notification.active }
  showForm.value = true
}

async function handleSubmit() {
  try {
    if (editingNotification.value) {
      await $fetch(`/api/v1/notifications/${editingNotification.value.id}`, { method: 'PUT', body: form.value })
      toast.add({ title: 'Success', description: 'Notification updated', color: 'success' })
    } else {
      await $fetch('/api/v1/notifications', { method: 'POST', body: form.value })
      toast.add({ title: 'Success', description: 'Notification created', color: 'success' })
    }
    showForm.value = false
    await fetchNotifications()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save', color: 'error' })
  }
}

async function deleteNotification(id: number) {
  if (!confirm('Delete this notification?')) return
  try {
    await $fetch(`/api/v1/notifications/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'Deleted', color: 'success' })
    await fetchNotifications()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}

async function testNotification(id: number) {
  try {
    await $fetch('/api/v1/notifications/test', { method: 'POST', body: { notificationId: id } })
    toast.add({ title: 'Success', description: 'Test notification sent', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to send test', color: 'error' })
  }
}

const configFields = computed(() => {
  switch (form.value.type) {
    case 'discord': return [{ key: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true }, { key: 'username', label: 'Bot Username', type: 'text', required: false }]
    case 'slack': return [{ key: 'webhookUrl', label: 'Webhook URL', type: 'text', required: true }, { key: 'channel', label: 'Channel', type: 'text', required: false }]
    case 'telegram': return [{ key: 'botToken', label: 'Bot Token', type: 'text', required: true }, { key: 'chatId', label: 'Chat ID', type: 'text', required: true }]
    case 'email': return [{ key: 'smtpHost', label: 'SMTP Host', type: 'text', required: true }, { key: 'smtpPort', label: 'SMTP Port', type: 'number', required: true }, { key: 'fromEmail', label: 'From Email', type: 'text', required: true }, { key: 'toEmail', label: 'To Email', type: 'text', required: true }]
    case 'webhook': return [{ key: 'url', label: 'Webhook URL', type: 'text', required: true }]
    case 'line': return [{ key: 'channelAccessToken', label: 'Channel Access Token', type: 'text', required: true }, { key: 'userId', label: 'User ID', type: 'text', required: true }]
    default: return []
  }
})
</script>

<template>
  <div>
    <div class="flex justify-between items-center mb-6">
      <h4 class="text-lg font-semibold text-white">Notifications</h4>
      <button class="btn btn-primary" @click="openAddForm">Add Notification</button>
    </div>

    <div v-if="loading" class="text-center py-8 text-gray-400">Loading...</div>

    <div v-else-if="notifications.length === 0" class="section-card text-center py-8">
      <p class="text-gray-400 mb-4">No notifications configured yet.</p>
      <button class="btn btn-primary" @click="openAddForm">Add Your First Notification</button>
    </div>

    <div v-else class="section-card">
      <table class="table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Status</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="notification in notifications" :key="notification.id">
            <td>{{ notificationTypes.find(t => t.value === notification.type)?.label || notification.type }}</td>
            <td>
              {{ notification.name }}
              <span v-if="notification.isDefault" class="badge badge-primary ml-2">Default</span>
            </td>
            <td>
              <span :class="notification.active ? 'badge badge-success' : 'badge badge-secondary'">
                {{ notification.active ? 'Enabled' : 'Disabled' }}
              </span>
            </td>
            <td class="text-right space-x-2">
              <button class="btn btn-secondary" @click="testNotification(notification.id)">Test</button>
              <button class="btn btn-secondary" @click="openEditForm(notification)">Edit</button>
              <button class="btn btn-danger" @click="deleteNotification(notification.id)">Delete</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-gray-800 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 class="text-xl font-bold text-white mb-4">{{ editingNotification ? 'Edit' : 'Add' }} Notification</h3>
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input v-model="form.name" type="text" class="input-field" placeholder="My Notification" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <select v-model="form.type" class="select-field">
              <option v-for="type in notificationTypes" :key="type.value" :value="type.value">{{ type.label }}</option>
            </select>
          </div>
          <template v-for="field in configFields" :key="field.key">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">{{ field.label }} <span v-if="field.required" class="text-red-400">*</span></label>
              <input v-model="(form.config as any)[field.key]" :type="field.type" class="input-field" />
            </div>
          </template>
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.isDefault" type="checkbox" class="text-green-500" />
              <span class="text-gray-300">Set as default</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input v-model="form.active" type="checkbox" class="text-green-500" />
              <span class="text-gray-300">Enabled</span>
            </label>
          </div>
          <div class="flex gap-3 pt-4">
            <button type="button" class="btn btn-secondary flex-1" @click="showForm = false">Cancel</button>
            <button type="submit" class="btn btn-primary flex-1">{{ editingNotification ? 'Update' : 'Create' }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
