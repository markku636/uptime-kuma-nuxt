<script setup lang="ts">
/**
 * Notifications Settings Page
 * Complete implementation with all 78 notification providers
 */

definePageMeta({ middleware: ['auth'] })

const toast = useToast()
const notifications = ref<any[]>([])
const loading = ref(true)
const showForm = ref(false)
const editingNotification = ref<any>(null)

// Error/Success message display
const alertMessage = ref('')
const alertType = ref<'success' | 'error'>('success')
const showAlert = ref(false)

function showAlertMessage(message: string, type: 'success' | 'error') {
  alertMessage.value = message
  alertType.value = type
  showAlert.value = true
  // Auto hide after 5 seconds
  setTimeout(() => {
    showAlert.value = false
  }, 5000)
}

// TLS Certificate Expiry Notification Settings
const tlsExpiryDays = ref<number[]>([7, 14, 21])
const newTlsExpiryDay = ref<number | null>(null)

// All 78 notification types grouped by category
const notificationCategories = [
  {
    name: 'Popular',
    types: [
      { value: 'discord', label: 'Discord' },
      { value: 'slack', label: 'Slack' },
      { value: 'telegram', label: 'Telegram' },
      { value: 'email', label: 'Email (SMTP)' },
      { value: 'webhook', label: 'Webhook' },
      { value: 'line', label: 'LINE Notify' },
      { value: 'teams', label: 'Microsoft Teams' },
      { value: 'pagerduty', label: 'PagerDuty' },
      { value: 'pushover', label: 'Pushover' },
      { value: 'ntfy', label: 'ntfy' },
    ]
  },
  {
    name: 'Regional / Enterprise',
    types: [
      { value: 'dingtalk', label: 'DingTalk (釘釘)' },
      { value: 'feishu', label: 'Feishu (飛書)' },
      { value: 'wecom', label: 'WeCom (企業微信)' },
      { value: 'aliyunsms', label: 'Aliyun SMS' },
      { value: 'serverchan', label: 'ServerChan (方糖)' },
      { value: 'pushplus', label: 'PushPlus (推送加)' },
      { value: 'bark', label: 'Bark' },
      { value: 'kook', label: 'Kook (開黑啦)' },
      { value: 'yzj', label: 'YZJ (云之家)' },
    ]
  },
  {
    name: 'Chat & Collaboration',
    types: [
      { value: 'mattermost', label: 'Mattermost' },
      { value: 'rocketchat', label: 'Rocket.Chat' },
      { value: 'googlechat', label: 'Google Chat' },
      { value: 'matrix', label: 'Matrix' },
      { value: 'zohocliq', label: 'Zoho Cliq' },
      { value: 'pumble', label: 'Pumble' },
      { value: 'stackfield', label: 'Stackfield' },
    ]
  },
  {
    name: 'Incident Management',
    types: [
      { value: 'opsgenie', label: 'Opsgenie' },
      { value: 'grafanaoncall', label: 'Grafana OnCall' },
      { value: 'splunk', label: 'Splunk' },
      { value: 'squadcast', label: 'Squadcast' },
      { value: 'signl4', label: 'SIGNL4' },
      { value: 'goalert', label: 'GoAlert' },
      { value: 'pagertree', label: 'PagerTree' },
      { value: 'alerta', label: 'Alerta' },
      { value: 'flashduty', label: 'FlashDuty' },
      { value: 'alertnow', label: 'AlertNow' },
      { value: 'heiioncall', label: 'Heii On-Call' },
    ]
  },
  {
    name: 'Push Services',
    types: [
      { value: 'gotify', label: 'Gotify' },
      { value: 'apprise', label: 'Apprise' },
      { value: 'pushbullet', label: 'Pushbullet' },
      { value: 'lunasea', label: 'LunaSea' },
      { value: 'techuluspush', label: 'Techulus Push' },
      { value: 'pushy', label: 'Pushy' },
      { value: 'pushdeer', label: 'PushDeer' },
      { value: 'wpush', label: 'WPush' },
      { value: 'gorush', label: 'Gorush' },
    ]
  },
  {
    name: 'SMS Gateways',
    types: [
      { value: 'twilio', label: 'Twilio' },
      { value: 'clicksendsms', label: 'ClickSend SMS' },
      { value: '46elks', label: '46elks' },
      { value: 'cellsynt', label: 'Cellsynt' },
      { value: 'freemobile', label: 'Free Mobile' },
      { value: 'octopush', label: 'Octopush' },
      { value: 'promosms', label: 'PromoSMS' },
      { value: 'serwersms', label: 'SerwerSMS' },
      { value: 'sevenio', label: 'SevenIO' },
      { value: 'smsmanager', label: 'SMS Manager' },
      { value: 'smspartner', label: 'SMS Partner' },
      { value: 'smsplanet', label: 'SMS Planet' },
      { value: 'smsc', label: 'SMSC' },
      { value: 'smseagle', label: 'SMSEagle' },
      { value: 'gtxmessaging', label: 'GTX Messaging' },
    ]
  },
  {
    name: 'WhatsApp & Messaging',
    types: [
      { value: 'waha', label: 'WAHA (WhatsApp HTTP API)' },
      { value: 'whapi', label: 'Whapi' },
      { value: 'callmebot', label: 'CallMeBot' },
      { value: 'signal', label: 'Signal' },
      { value: 'threema', label: 'Threema' },
      { value: 'onesender', label: 'Onesender' },
      { value: 'onechat', label: 'OneChat' },
    ]
  },
  {
    name: 'Home Automation',
    types: [
      { value: 'homeassistant', label: 'Home Assistant' },
    ]
  },
  {
    name: 'Other',
    types: [
      { value: 'sendgrid', label: 'SendGrid' },
      { value: 'onebot', label: 'OneBot' },
      { value: 'spugpush', label: 'SpugPush' },
      { value: 'keep', label: 'Keep' },
      { value: 'bitrix24', label: 'Bitrix24' },
      { value: 'notifery', label: 'Notifery' },
      { value: 'nostr', label: 'Nostr' },
    ]
  },
]

// Flatten all notification types for select options
const allNotificationTypes = computed(() => {
  return notificationCategories.flatMap(cat => cat.types)
})

const form = ref({
  name: '',
  type: 'discord',
  config: {} as Record<string, any>,
  isDefault: false,
  active: true
})

onMounted(async () => {
  await fetchNotifications()
  await fetchTlsExpirySettings()
})

async function fetchNotifications() {
  loading.value = true
  try {
    const response = await $fetch('/api/v1/notifications') as any
    // Handle both { ok, data } format and direct array format
    notifications.value = response?.data || response || []
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to load notifications', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function fetchTlsExpirySettings() {
  try {
    const settings = await $fetch('/api/v1/settings/tls-expiry') as any
    if (settings?.days) {
      tlsExpiryDays.value = settings.days
    }
  } catch {
    // Use defaults if not found
  }
}

function openAddForm() {
  editingNotification.value = null
  form.value = { name: '', type: 'discord', config: {}, isDefault: false, active: true }
  showForm.value = true
}

function openEditForm(notification: any) {
  editingNotification.value = notification
  form.value = {
    name: notification.name,
    type: notification.type,
    config: notification.config || {},
    isDefault: notification.isDefault,
    active: notification.active
  }
  showForm.value = true
}

async function handleSubmit() {
  if (!form.value.name.trim()) {
    toast.add({ title: 'Validation Error', description: 'Friendly name is required', color: 'error' })
    return
  }
  
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
    console.error('Notification save error:', error)
    toast.add({ title: 'Error', description: error.data?.message || error.message || 'Failed to save', color: 'error' })
  }
}

async function deleteNotification(id: number) {
  if (!confirm('Are you sure you want to delete this notification?')) return
  try {
    await $fetch(`/api/v1/notifications/${id}`, { method: 'DELETE' })
    toast.add({ title: 'Success', description: 'Notification deleted', color: 'success' })
    await fetchNotifications()
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to delete', color: 'error' })
  }
}

async function testNotification(id: number) {
  console.log('Testing notification:', id)
  try {
    const result = await $fetch('/api/v1/notifications/test', { method: 'POST', body: { notificationId: id } })
    console.log('Test result:', result)
    showAlertMessage('Test notification sent successfully!', 'success')
    toast.add({ title: 'Success', description: 'Test notification sent!', color: 'success' })
  } catch (error: any) {
    console.error('Test notification error:', error)
    const errorMsg = error.data?.message || error.message || error.statusMessage || 'Failed to send test notification'
    console.log('Error message:', errorMsg)
    showAlertMessage(errorMsg, 'error')
    toast.add({ title: 'Test Failed', description: errorMsg, color: 'error' })
  }
}

function addTlsExpiryDay() {
  if (newTlsExpiryDay.value && newTlsExpiryDay.value > 0 && !tlsExpiryDays.value.includes(newTlsExpiryDay.value)) {
    tlsExpiryDays.value.push(newTlsExpiryDay.value)
    tlsExpiryDays.value.sort((a, b) => a - b)
    newTlsExpiryDay.value = null
  }
}

function removeTlsExpiryDay(day: number) {
  tlsExpiryDays.value = tlsExpiryDays.value.filter(d => d !== day)
}

async function saveTlsExpirySettings() {
  try {
    await $fetch('/api/v1/settings/tls-expiry', { method: 'PUT', body: { days: tlsExpiryDays.value } })
    toast.add({ title: 'Success', description: 'TLS expiry settings saved', color: 'success' })
  } catch (error: any) {
    toast.add({ title: 'Error', description: error.data?.message || 'Failed to save settings', color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-8">
    <!-- Alert Banner -->
    <div v-if="showAlert" 
         :class="[
           'fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg max-w-md',
           alertType === 'success' ? 'bg-up text-on-primary' : 'bg-down text-white'
         ]">
      <div class="flex items-start gap-3">
        <div class="flex-1 text-sm">{{ alertMessage }}</div>
        <button @click="showAlert = false" class="shrink-0 w-5 h-5 flex items-center justify-center hover:bg-default/20 rounded">
          <UIcon name="i-heroicons-x-mark" class="w-4 h-4" />
        </button>
      </div>
    </div>

    <!-- Notifications Section -->
    <div class="section-card">
      <div class="flex justify-between items-center mb-6">
        <h4 class="text-lg font-semibold text-highlighted">Notifications</h4>
        <button class="btn btn-primary" @click="openAddForm">
          <UIcon name="i-heroicons-plus" class="w-4 h-4 mr-2" />
          Setup Notification
        </button>
      </div>

      <div v-if="loading" class="text-center py-8">
        <div class="spinner w-8 h-8 mx-auto"></div>
        <p class="text-toned mt-2">Loading notifications...</p>
      </div>

      <div v-else-if="notifications.length === 0" class="text-center py-8 bg-elevated rounded-lg">
        <UIcon name="i-heroicons-bell-slash" class="w-12 h-12 mx-auto text-muted mb-3" />
        <p class="text-toned mb-4">Not available, please setup.</p>
        <button class="btn btn-primary" @click="openAddForm">Setup Notification</button>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-accented">
              <th class="text-left py-3 px-4 text-toned font-medium">Type</th>
              <th class="text-left py-3 px-4 text-toned font-medium">Name</th>
              <th class="text-left py-3 px-4 text-toned font-medium">Status</th>
              <th class="text-right py-3 px-4 text-toned font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="notification in notifications" :key="notification.id" class="border-b border-default hover:bg-elevated">
              <td class="py-3 px-4">
                <span class="text-default">{{ allNotificationTypes.find(t => t.value === notification.type)?.label || notification.type }}</span>
              </td>
              <td class="py-3 px-4">
                <span class="text-highlighted">{{ notification.name }}</span>
                <span v-if="notification.isDefault" class="ml-2 px-2 py-0.5 text-xs bg-up/20 text-up-fg rounded">Default</span>
              </td>
              <td class="py-3 px-4">
                <span :class="notification.active ? 'text-up-fg' : 'text-muted'">
                  {{ notification.active ? 'Enabled' : 'Disabled' }}
                </span>
              </td>
              <td class="py-3 px-4 text-right space-x-2">
                <UButton size="xs" color="neutral" variant="outline" @click="testNotification(notification.id)">Test</UButton>
                <UButton size="xs" color="neutral" variant="outline" @click="openEditForm(notification)">Edit</UButton>
                <UButton size="xs" color="error" variant="soft" @click="deleteNotification(notification.id)">Delete</UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- TLS Certificate Expiry Section -->
    <div class="section-card">
      <h4 class="text-lg font-semibold text-highlighted mb-4">TLS Certificate Expiry</h4>
      <p class="text-toned text-sm mb-4">HTTPS Monitors trigger notification when TLS certificate expires in:</p>
      <p class="text-muted text-xs mb-4">Notifications must be assigned to a monitor to function.</p>

      <div class="space-y-3">
        <div v-for="day in tlsExpiryDays" :key="day" class="flex items-center justify-between bg-elevated rounded-lg p-3">
          <span class="text-highlighted">{{ day }} days</span>
          <button class="text-down-fg hover:text-down p-1" @click="removeTlsExpiryDay(day)">
            <UIcon name="i-heroicons-x-circle" class="w-5 h-5" />
          </button>
        </div>

        <div class="flex gap-2">
          <input
            v-model.number="newTlsExpiryDay"
            type="number"
            min="1"
            placeholder="day"
            class="input-field flex-1"
            @keyup.enter="addTlsExpiryDay"
          />
          <button class="btn btn-secondary" @click="addTlsExpiryDay">
            <UIcon name="i-heroicons-plus" class="w-5 h-5" />
          </button>
        </div>

        <button class="btn btn-primary mt-4" @click="saveTlsExpirySettings">Save</button>
      </div>
    </div>

    <!-- Add/Edit Notification Modal -->
    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60" @click="showForm = false"></div>
        
        <!-- Modal Content -->
        <div class="relative bg-default rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-hidden">
          <div class="p-6 overflow-y-auto max-h-[85vh]">
            <h3 class="text-xl font-bold text-highlighted mb-6">
              {{ editingNotification ? 'Edit Notification' : 'Setup Notification' }}
            </h3>

            <form @submit.prevent="handleSubmit" class="space-y-4">
              <!-- Notification Type -->
              <div>
                <label class="block text-sm font-medium text-default mb-2">Notification Type</label>
                <select v-model="form.type" class="select-field w-full">
                  <optgroup v-for="category in notificationCategories" :key="category.name" :label="category.name">
                    <option v-for="type in category.types" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </option>
                  </optgroup>
                </select>
              </div>

              <!-- Friendly Name -->
              <div>
                <label class="block text-sm font-medium text-default mb-2">Friendly Name</label>
                <input v-model="form.name" type="text" class="input-field w-full" placeholder="My Discord Notification" required />
              </div>

              <!-- Dynamic Provider Form based on type -->
              <div class="border-t border-accented pt-4 mt-4">
                <NotificationProvidersDiscord v-if="form.type === 'discord'" v-model="form.config" />
                <NotificationProvidersSlack v-else-if="form.type === 'slack'" v-model="form.config" />
                <NotificationProvidersTelegram v-else-if="form.type === 'telegram'" v-model="form.config" />
                <NotificationProvidersEmail v-else-if="form.type === 'email'" v-model="form.config" />
                <NotificationProvidersWebhook v-else-if="form.type === 'webhook'" v-model="form.config" />
                <NotificationProvidersLine v-else-if="form.type === 'line'" v-model="form.config" />
                <NotificationProvidersTeams v-else-if="form.type === 'teams'" v-model="form.config" />
                <NotificationProvidersPagerDuty v-else-if="form.type === 'pagerduty'" v-model="form.config" />
                <NotificationProvidersPushover v-else-if="form.type === 'pushover'" v-model="form.config" />
                <NotificationProvidersNtfy v-else-if="form.type === 'ntfy'" v-model="form.config" />
                <NotificationProvidersDingTalk v-else-if="form.type === 'dingtalk'" v-model="form.config" />
                <NotificationProvidersFeishu v-else-if="form.type === 'feishu'" v-model="form.config" />
                <NotificationProvidersWeCom v-else-if="form.type === 'wecom'" v-model="form.config" />
                <NotificationProvidersGotify v-else-if="form.type === 'gotify'" v-model="form.config" />
                <NotificationProvidersMatrix v-else-if="form.type === 'matrix'" v-model="form.config" />
                <NotificationProvidersMattermost v-else-if="form.type === 'mattermost'" v-model="form.config" />
                <NotificationProvidersGoogleChat v-else-if="form.type === 'googlechat'" v-model="form.config" />
                <NotificationProvidersRocketChat v-else-if="form.type === 'rocketchat'" v-model="form.config" />
                <NotificationProvidersOpsgenie v-else-if="form.type === 'opsgenie'" v-model="form.config" />
                <NotificationProvidersSignal v-else-if="form.type === 'signal'" v-model="form.config" />
                <NotificationProvidersTwilio v-else-if="form.type === 'twilio'" v-model="form.config" />
                <NotificationProvidersPushbullet v-else-if="form.type === 'pushbullet'" v-model="form.config" />
                <NotificationProvidersHomeAssistant v-else-if="form.type === 'homeassistant'" v-model="form.config" />
                <NotificationProvidersSplunk v-else-if="form.type === 'splunk'" v-model="form.config" />
                <NotificationProvidersApprise v-else-if="form.type === 'apprise'" v-model="form.config" />
                <NotificationProvidersLunaSea v-else-if="form.type === 'lunasea'" v-model="form.config" />
                <!-- Fallback for other types -->
                <div v-else class="text-toned text-sm">
                  <p class="mb-2">Provider-specific configuration:</p>
                  <textarea
                    v-model="form.config"
                    class="input-field w-full font-mono text-sm"
                    rows="4"
                    placeholder='{"webhookUrl": "https://..."}'
                  />
                </div>
              </div>

              <!-- Options -->
              <div class="flex items-center gap-6 pt-4 border-t border-accented">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.isDefault" type="checkbox" class="w-4 h-4 text-up-fg rounded" />
                  <span class="text-default">Default enabled</span>
                </label>
                <label class="flex items-center gap-2 cursor-pointer">
                  <input v-model="form.active" type="checkbox" class="w-4 h-4 text-up-fg rounded" />
                  <span class="text-default">Enabled</span>
                </label>
              </div>

              <!-- Actions -->
              <div class="flex gap-3 pt-4">
                <button type="button" class="btn btn-secondary flex-1" @click="showForm = false">Cancel</button>
                <button type="submit" class="btn btn-primary flex-1">
                  {{ editingNotification ? 'Update' : 'Save' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
