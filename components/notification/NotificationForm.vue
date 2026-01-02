<script setup lang="ts">
import type { Notification } from '~/types'

interface Props {
  notification?: Notification | null
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  notification: null,
  loading: false
})

const emit = defineEmits<{
  (e: 'submit', data: any): void
  (e: 'cancel'): void
}>()

// Notification types with their configuration fields
const notificationTypes = [
  { value: 'discord', label: 'Discord' },
  { value: 'slack', label: 'Slack' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email (SMTP)' },
  { value: 'webhook', label: 'Webhook' },
  { value: 'line', label: 'LINE' },
  { value: 'pushover', label: 'Pushover' },
  { value: 'gotify', label: 'Gotify' },
  { value: 'ntfy', label: 'ntfy' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'teams', label: 'Microsoft Teams' },
  { value: 'apprise', label: 'Apprise' },
  { value: 'feishu', label: 'Feishu (飛書)' },
  { value: 'dingtalk', label: 'DingTalk (釘釘)' },
  { value: 'wecom', label: 'WeCom (企業微信)' },
  { value: 'pagerduty', label: 'PagerDuty' },
  { value: 'opsgenie', label: 'OpsGenie' },
  { value: 'aliyun-sms', label: 'Aliyun SMS (阿里雲短信)' },
  { value: 'signal', label: 'Signal' },
  { value: 'rocket.chat', label: 'Rocket.Chat' },
  { value: 'mattermost', label: 'Mattermost' },
  { value: 'google-chat', label: 'Google Chat' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'pushbullet', label: 'Pushbullet' },
  { value: 'home-assistant', label: 'Home Assistant' },
  { value: 'splunk', label: 'Splunk' },
  { value: 'grafana-oncall', label: 'Grafana OnCall' },
  // New providers
  { value: 'bark', label: 'Bark' },
  { value: 'serverchan', label: 'ServerChan (方糖)' },
  { value: 'squadcast', label: 'Squadcast' },
  { value: 'signl4', label: 'SIGNL4' },
  { value: 'lunasea', label: 'LunaSea' },
  { value: 'goalert', label: 'GoAlert' },
  { value: 'pagertree', label: 'PagerTree' },
  { value: 'techulus-push', label: 'Push by Techulus' },
  { value: 'pushy', label: 'Pushy' },
  { value: 'pushplus', label: 'PushPlus (推送加)' },
  { value: 'pushdeer', label: 'PushDeer' },
  { value: 'threema', label: 'Threema' },
  { value: 'kook', label: 'Kook (KOOK/開黑啦)' },
  { value: 'zoho-cliq', label: 'Zoho Cliq' },
  { value: 'alerta', label: 'Alerta' },
  { value: 'clicksend-sms', label: 'ClickSend SMS' },
  { value: 'sendgrid', label: 'SendGrid' },
  { value: 'flashduty', label: 'FlashDuty (閃值)' },
  { value: 'pumble', label: 'Pumble' },
  { value: 'stackfield', label: 'Stackfield' },
  { value: 'onebot', label: 'OneBot' },
  { value: 'spugpush', label: 'SpugPush' },
  { value: 'keep', label: 'Keep' },
  { value: 'wpush', label: 'WPush' },
  // Batch 3
  { value: 'linenotify', label: 'LINE Notify' },
  { value: 'gorush', label: 'Gorush' },
  { value: 'alertnow', label: 'AlertNow' },
  { value: '46elks', label: '46elks SMS' },
  { value: 'bitrix24', label: 'Bitrix24' },
  { value: 'callmebot', label: 'CallMeBot' },
  { value: 'cellsynt', label: 'Cellsynt' },
  { value: 'freemobile', label: 'Free Mobile SMS' },
  { value: 'heii-oncall', label: 'Heii On-Call' },
  { value: 'notifery', label: 'Notifery' },
  // Batch 4 - SMS gateways
  { value: 'octopush', label: 'Octopush' },
  { value: 'onechat', label: 'OneChat' },
  { value: 'onesender', label: 'Onesender' },
  { value: 'promosms', label: 'PromoSMS' },
  { value: 'serwersms', label: 'SerwerSMS' },
  { value: 'sevenio', label: 'Seven.io' },
  { value: 'smsmanager', label: 'SMS Manager' },
  { value: 'smspartner', label: 'SMS Partner' },
  { value: 'smsplanet', label: 'SMS Planet' },
  { value: 'smsc', label: 'SMSC' },
  { value: 'smseagle', label: 'SMSEagle' },
  { value: 'waha', label: 'WAHA (WhatsApp)' },
  { value: 'whapi', label: 'Whapi (WhatsApp)' },
  { value: 'yzj', label: 'YZJ (云之家)' },
  { value: 'gtx-messaging', label: 'GTX Messaging' },
  { value: 'nostr', label: 'Nostr' }
]

// Form data
const form = ref({
  name: '',
  type: 'discord',
  config: {} as Record<string, any>,
  isDefault: false,
  active: true,
  applyExisting: false
})

// Initialize form with existing data
onMounted(() => {
  if (props.notification) {
    form.value = {
      name: props.notification.name,
      type: props.notification.type,
      config: { ...props.notification.config },
      isDefault: props.notification.isDefault,
      active: props.notification.active,
      applyExisting: false
    }
  }
})

// Reset config when type changes
watch(() => form.value.type, () => {
  if (!props.notification) {
    form.value.config = {}
  }
})

// Configuration fields per notification type
const configFields = computed(() => {
  switch (form.value.type) {
    case 'discord':
      return [
        { key: 'webhookUrl', label: 'Discord Webhook URL', type: 'text', required: true, placeholder: 'https://discord.com/api/webhooks/...' },
        { key: 'username', label: 'Bot Display Name', type: 'text', required: false, placeholder: 'Uptime Kuma' }
      ]
    case 'slack':
      return [
        { key: 'webhookUrl', label: 'Slack Webhook URL', type: 'text', required: true, placeholder: 'https://hooks.slack.com/services/...' },
        { key: 'channel', label: 'Channel (optional)', type: 'text', required: false, placeholder: '#alerts' }
      ]
    case 'telegram':
      return [
        { key: 'botToken', label: 'Bot Token', type: 'text', required: true, placeholder: '123456789:ABC...' },
        { key: 'chatId', label: 'Chat ID', type: 'text', required: true, placeholder: '-1001234567890' }
      ]
    case 'email':
      return [
        { key: 'smtpHost', label: 'SMTP Host', type: 'text', required: true, placeholder: 'smtp.gmail.com' },
        { key: 'smtpPort', label: 'SMTP Port', type: 'number', required: true, placeholder: '587' },
        { key: 'smtpSecure', label: 'Use TLS', type: 'checkbox', required: false },
        { key: 'smtpUsername', label: 'SMTP Username', type: 'text', required: false },
        { key: 'smtpPassword', label: 'SMTP Password', type: 'password', required: false },
        { key: 'fromEmail', label: 'From Email', type: 'text', required: true, placeholder: 'alerts@example.com' },
        { key: 'toEmail', label: 'To Email', type: 'text', required: true, placeholder: 'admin@example.com' }
      ]
    case 'webhook':
      return [
        { key: 'url', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://example.com/webhook' },
        { key: 'method', label: 'Request Method', type: 'select', options: ['POST', 'GET', 'PUT'], required: false },
        { key: 'contentType', label: 'Content Type', type: 'select', options: ['application/json', 'application/x-www-form-urlencoded'], required: false }
      ]
    case 'line':
      return [
        { key: 'channelAccessToken', label: 'Channel Access Token', type: 'text', required: true },
        { key: 'userId', label: 'User ID or Group ID', type: 'text', required: true }
      ]
    case 'pushover':
      return [
        { key: 'userKey', label: 'User Key', type: 'text', required: true, placeholder: 'Your Pushover user key' },
        { key: 'appToken', label: 'Application Token', type: 'text', required: true, placeholder: 'Your application API token' },
        { key: 'device', label: 'Device (optional)', type: 'text', required: false, placeholder: 'Leave empty for all devices' },
        { key: 'priority', label: 'Priority', type: 'select', options: ['-2', '-1', '0', '1', '2'], required: false },
        { key: 'sound', label: 'Sound', type: 'text', required: false, placeholder: 'pushover' }
      ]
    case 'gotify':
      return [
        { key: 'serverUrl', label: 'Gotify Server URL', type: 'text', required: true, placeholder: 'https://gotify.example.com' },
        { key: 'appToken', label: 'Application Token', type: 'text', required: true },
        { key: 'priority', label: 'Priority', type: 'number', required: false, placeholder: '5' }
      ]
    case 'ntfy':
      return [
        { key: 'serverUrl', label: 'ntfy Server URL', type: 'text', required: false, placeholder: 'https://ntfy.sh (default)' },
        { key: 'topic', label: 'Topic', type: 'text', required: true, placeholder: 'uptime-kuma-alerts' },
        { key: 'priority', label: 'Priority', type: 'select', options: ['1', '2', '3', '4', '5'], required: false },
        { key: 'username', label: 'Username (optional)', type: 'text', required: false },
        { key: 'password', label: 'Password (optional)', type: 'password', required: false }
      ]
    case 'matrix':
      return [
        { key: 'homeserverUrl', label: 'Homeserver URL', type: 'text', required: true, placeholder: 'https://matrix.org' },
        { key: 'accessToken', label: 'Access Token', type: 'text', required: true },
        { key: 'roomId', label: 'Room ID', type: 'text', required: true, placeholder: '!roomid:matrix.org' }
      ]
    case 'teams':
      return [
        { key: 'webhookUrl', label: 'Teams Webhook URL', type: 'text', required: true, placeholder: 'https://outlook.office.com/webhook/...' }
      ]
    case 'apprise':
      return [
        { key: 'appriseUrl', label: 'Apprise Server URL', type: 'text', required: true, placeholder: 'http://localhost:8000/notify' },
        { key: 'appriseUrls', label: 'Apprise URLs (comma separated)', type: 'textarea', required: true, placeholder: 'discord://webhook_id/webhook_token,slack://tokenA/tokenB/tokenC' }
      ]
    case 'feishu':
      return [
        { key: 'webhookUrl', label: 'Feishu Webhook URL', type: 'text', required: true, placeholder: 'https://open.feishu.cn/open-apis/bot/v2/hook/...' },
        { key: 'secret', label: 'Secret Key (optional)', type: 'text', required: false, placeholder: 'For signed webhooks' }
      ]
    case 'dingtalk':
      return [
        { key: 'webhookUrl', label: 'DingTalk Webhook URL', type: 'text', required: true, placeholder: 'https://oapi.dingtalk.com/robot/send?access_token=...' },
        { key: 'secret', label: 'Secret Key (optional)', type: 'text', required: false, placeholder: 'For signed webhooks' }
      ]
    case 'wecom':
      return [
        { key: 'webhookUrl', label: 'WeCom Webhook URL', type: 'text', required: true, placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' }
      ]
    case 'pagerduty':
      return [
        { key: 'integrationKey', label: 'Integration Key (Routing Key)', type: 'text', required: true, placeholder: 'Your PagerDuty integration key' },
        { key: 'severity', label: 'Severity', type: 'select', options: ['critical', 'error', 'warning', 'info'], required: false },
        { key: 'autoResolve', label: 'Auto-resolve on recovery', type: 'checkbox', required: false }
      ]
    case 'opsgenie':
      return [
        { key: 'apiKey', label: 'API Key', type: 'text', required: true, placeholder: 'Your OpsGenie API key' },
        { key: 'region', label: 'Region', type: 'select', options: ['us', 'eu'], required: false },
        { key: 'priority', label: 'Priority', type: 'select', options: ['P1', 'P2', 'P3', 'P4', 'P5'], required: false }
      ]
    case 'aliyun-sms':
      return [
        { key: 'accessKeyId', label: 'Access Key ID', type: 'text', required: true },
        { key: 'accessKeySecret', label: 'Access Key Secret', type: 'password', required: true },
        { key: 'signName', label: 'Sign Name (簽名名稱)', type: 'text', required: true },
        { key: 'templateCode', label: 'Template Code (模板編號)', type: 'text', required: true },
        { key: 'phoneNumbers', label: 'Phone Numbers (多個用逗號分隔)', type: 'text', required: true, placeholder: '13800138000,13900139000' }
      ]
    case 'signal':
      return [
        { key: 'signalUrl', label: 'Signal CLI REST API URL', type: 'text', required: true, placeholder: 'http://localhost:8080' },
        { key: 'number', label: 'Sender Number', type: 'text', required: true, placeholder: '+1234567890' },
        { key: 'recipients', label: 'Recipient Numbers (comma separated)', type: 'text', required: true, placeholder: '+1234567890,+0987654321' }
      ]
    case 'rocket.chat':
      return [
        { key: 'webhookUrl', label: 'Rocket.Chat Webhook URL', type: 'text', required: true, placeholder: 'https://rocket.example.com/hooks/...' },
        { key: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'Uptime Kuma' },
        { key: 'iconEmoji', label: 'Icon Emoji (optional)', type: 'text', required: false, placeholder: ':robot:' }
      ]
    case 'mattermost':
      return [
        { key: 'webhookUrl', label: 'Mattermost Webhook URL', type: 'text', required: true, placeholder: 'https://mattermost.example.com/hooks/...' },
        { key: 'channel', label: 'Channel (optional)', type: 'text', required: false, placeholder: 'alerts' },
        { key: 'username', label: 'Username (optional)', type: 'text', required: false, placeholder: 'Uptime Kuma' },
        { key: 'iconUrl', label: 'Icon URL (optional)', type: 'text', required: false }
      ]
    case 'google-chat':
      return [
        { key: 'webhookUrl', label: 'Google Chat Webhook URL', type: 'text', required: true, placeholder: 'https://chat.googleapis.com/v1/spaces/...' }
      ]
    case 'twilio':
      return [
        { key: 'accountSid', label: 'Account SID', type: 'text', required: true, placeholder: 'ACxxxxxxxxxxxxx' },
        { key: 'authToken', label: 'Auth Token', type: 'password', required: true },
        { key: 'fromNumber', label: 'From Number', type: 'text', required: true, placeholder: '+1234567890' },
        { key: 'toNumber', label: 'To Number', type: 'text', required: true, placeholder: '+0987654321' }
      ]
    case 'pushbullet':
      return [
        { key: 'accessToken', label: 'Access Token', type: 'text', required: true, placeholder: 'Your Pushbullet access token' },
        { key: 'deviceIden', label: 'Device Identifier (optional)', type: 'text', required: false, placeholder: 'Leave empty for all devices' }
      ]
    case 'home-assistant':
      return [
        { key: 'serverUrl', label: 'Home Assistant URL', type: 'text', required: true, placeholder: 'http://homeassistant.local:8123' },
        { key: 'accessToken', label: 'Long-Lived Access Token', type: 'password', required: true },
        { key: 'notifyService', label: 'Notify Service', type: 'text', required: true, placeholder: 'notify.mobile_app_phone' }
      ]
    case 'splunk':
      return [
        { key: 'serverUrl', label: 'Splunk HEC URL', type: 'text', required: true, placeholder: 'https://splunk.example.com:8088' },
        { key: 'token', label: 'HEC Token', type: 'password', required: true },
        { key: 'source', label: 'Source', type: 'text', required: false, placeholder: 'uptime-kuma' },
        { key: 'sourceType', label: 'Source Type', type: 'text', required: false, placeholder: '_json' },
        { key: 'index', label: 'Index', type: 'text', required: false, placeholder: 'main' }
      ]
    case 'grafana-oncall':
      return [
        { key: 'webhookUrl', label: 'Grafana OnCall Webhook URL', type: 'text', required: true, placeholder: 'https://oncall.grafana.net/integrations/v1/...' }
      ]
    // New providers config fields
    case 'bark':
      return [
        { key: 'barkEndpoint', label: 'Bark Server URL', type: 'text', required: true, placeholder: 'https://api.day.app/your-key' },
        { key: 'barkGroup', label: 'Group (optional)', type: 'text', required: false, placeholder: 'uptime-kuma' },
        { key: 'barkSound', label: 'Sound (optional)', type: 'text', required: false, placeholder: 'alarm' }
      ]
    case 'serverchan':
      return [
        { key: 'serverChanSendKey', label: 'SendKey', type: 'text', required: true, placeholder: 'SCTxxx or sctpXXXt...' }
      ]
    case 'squadcast':
      return [
        { key: 'squadcastWebhookURL', label: 'Squadcast Webhook URL', type: 'text', required: true, placeholder: 'https://api.squadcast.com/v2/incidents/api/...' }
      ]
    case 'signl4':
      return [
        { key: 'signl4WebhookURL', label: 'SIGNL4 Webhook URL', type: 'text', required: true, placeholder: 'https://connect.signl4.com/webhook/...' }
      ]
    case 'lunasea':
      return [
        { key: 'lunaSeaTarget', label: 'LunaSea Device/User Token', type: 'text', required: true, placeholder: 'device:xxx or user:xxx' }
      ]
    case 'goalert':
      return [
        { key: 'goAlertBaseURL', label: 'GoAlert Base URL', type: 'text', required: true, placeholder: 'https://goalert.example.com' },
        { key: 'goAlertToken', label: 'Integration Key', type: 'text', required: true }
      ]
    case 'pagertree':
      return [
        { key: 'pagerTreeIntegrationUrl', label: 'Integration URL', type: 'text', required: true, placeholder: 'https://api.pagertree.com/integration/...' },
        { key: 'pagerTreeUrgency', label: 'Urgency', type: 'select', options: ['low', 'medium', 'high', 'critical'], required: false },
        { key: 'pagerTreeAutoResolve', label: 'Auto Resolve', type: 'checkbox', required: false }
      ]
    case 'techulus-push':
      return [
        { key: 'pushAPIKey', label: 'API Key', type: 'text', required: true },
        { key: 'pushTitle', label: 'Title (optional)', type: 'text', required: false, placeholder: 'Uptime-Kuma' },
        { key: 'pushChannel', label: 'Channel (optional)', type: 'text', required: false },
        { key: 'pushSound', label: 'Sound (optional)', type: 'text', required: false }
      ]
    case 'pushy':
      return [
        { key: 'pushyAPIKey', label: 'API Key', type: 'text', required: true },
        { key: 'pushyToken', label: 'Device Token', type: 'text', required: true }
      ]
    case 'pushplus':
      return [
        { key: 'pushPlusSendKey', label: 'SendKey (Token)', type: 'text', required: true },
        { key: 'pushPlusChannel', label: 'Channel', type: 'select', options: ['wechat', 'webhook', 'cp', 'mail'], required: false }
      ]
    case 'pushdeer':
      return [
        { key: 'pushdeerServer', label: 'Server URL (optional)', type: 'text', required: false, placeholder: 'https://api2.pushdeer.com' },
        { key: 'pushdeerKey', label: 'PushKey', type: 'text', required: true }
      ]
    case 'threema':
      return [
        { key: 'threemaSenderIdentity', label: 'Gateway ID', type: 'text', required: true, placeholder: '*MYGATEWAY' },
        { key: 'threemaSecret', label: 'Gateway Secret', type: 'password', required: true },
        { key: 'threemaRecipientType', label: 'Recipient Type', type: 'select', options: ['identity', 'phone', 'email'], required: true },
        { key: 'threemaRecipient', label: 'Recipient', type: 'text', required: true, placeholder: 'Threema ID, phone, or email' }
      ]
    case 'kook':
      return [
        { key: 'kookBotToken', label: 'Bot Token', type: 'text', required: true },
        { key: 'kookGuildID', label: 'Channel ID', type: 'text', required: true }
      ]
    case 'zoho-cliq':
      return [
        { key: 'zohoCliqWebhookUrl', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://cliq.zoho.com/company/api/v2/channelsbyname/...' }
      ]
    case 'alerta':
      return [
        { key: 'alertaApiEndpoint', label: 'API Endpoint', type: 'text', required: true, placeholder: 'https://alerta.example.com/api/alert' },
        { key: 'alertaApiKey', label: 'API Key', type: 'text', required: true },
        { key: 'alertaEnvironment', label: 'Environment', type: 'text', required: true, placeholder: 'Production' },
        { key: 'alertaAlertState', label: 'Alert Severity', type: 'select', options: ['critical', 'major', 'minor', 'warning'], required: false },
        { key: 'alertaRecoverState', label: 'Recover Severity', type: 'select', options: ['cleared', 'normal', 'ok'], required: false }
      ]
    case 'clicksend-sms':
      return [
        { key: 'clicksendsmsLogin', label: 'Username', type: 'text', required: true },
        { key: 'clicksendsmsPassword', label: 'API Key', type: 'password', required: true },
        { key: 'clicksendsmsToNumber', label: 'To Number', type: 'text', required: true, placeholder: '+61411111111' },
        { key: 'clicksendsmsSenderName', label: 'Sender Name (optional)', type: 'text', required: false, placeholder: 'UptimeKuma' }
      ]
    case 'sendgrid':
      return [
        { key: 'sendgridApiKey', label: 'API Key', type: 'password', required: true },
        { key: 'sendgridFromEmail', label: 'From Email', type: 'text', required: true },
        { key: 'sendgridToEmail', label: 'To Email', type: 'text', required: true },
        { key: 'sendgridCcEmail', label: 'CC (comma separated)', type: 'text', required: false },
        { key: 'sendgridBccEmail', label: 'BCC (comma separated)', type: 'text', required: false },
        { key: 'sendgridSubject', label: 'Subject (optional)', type: 'text', required: false }
      ]
    case 'flashduty':
      return [
        { key: 'flashdutyIntegrationKey', label: 'Integration Key', type: 'text', required: true },
        { key: 'flashdutySeverity', label: 'Severity', type: 'select', options: ['Info', 'Warning', 'Critical'], required: false }
      ]
    case 'pumble':
      return [
        { key: 'pumbleWebhookURL', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://api.pumble.com/workspaces/.../incoming-webhooks/...' }
      ]
    case 'stackfield':
      return [
        { key: 'stackfieldWebhookURL', label: 'Webhook URL', type: 'text', required: true }
      ]
    case 'onebot':
      return [
        { key: 'httpAddr', label: 'HTTP Address', type: 'text', required: true, placeholder: 'http://127.0.0.1:5700' },
        { key: 'accessToken', label: 'Access Token (optional)', type: 'text', required: false },
        { key: 'msgType', label: 'Message Type', type: 'select', options: ['private', 'group'], required: true },
        { key: 'recieverId', label: 'QQ Number / Group ID', type: 'text', required: true }
      ]
    case 'spugpush':
      return [
        { key: 'spugpushTemplateKey', label: 'Template Key', type: 'text', required: true }
      ]
    case 'keep':
      return [
        { key: 'keepWebhookURL', label: 'Keep Webhook URL', type: 'text', required: true, placeholder: 'https://api.keephq.dev' },
        { key: 'keepWebhookAPIKey', label: 'API Key', type: 'text', required: true }
      ]
    case 'wpush':
      return [
        { key: 'wpushAPIkey', label: 'API Key', type: 'text', required: true },
        { key: 'wpushChannel', label: 'Channel (optional)', type: 'text', required: false }
      ]
    // Batch 3 config fields
    case 'linenotify':
      return [
        { key: 'lineNotifyAccessToken', label: 'Access Token', type: 'text', required: true }
      ]
    case 'gorush':
      return [
        { key: 'gorushServerURL', label: 'Server URL', type: 'text', required: true, placeholder: 'https://gorush.example.com' },
        { key: 'gorushDeviceToken', label: 'Device Token', type: 'text', required: true },
        { key: 'gorushPlatform', label: 'Platform', type: 'select', options: ['ios', 'android'], required: true }
      ]
    case 'alertnow':
      return [
        { key: 'alertNowWebhookURL', label: 'Webhook URL', type: 'text', required: true }
      ]
    case '46elks':
      return [
        { key: 'elksUsername', label: 'API Username', type: 'text', required: true },
        { key: 'elksAuthToken', label: 'API Password', type: 'password', required: true },
        { key: 'elksToNumber', label: 'To Number', type: 'text', required: true, placeholder: '+46701234567' },
        { key: 'elksFromNumber', label: 'From Number', type: 'text', required: true, placeholder: '+46766861001' }
      ]
    case 'bitrix24':
      return [
        { key: 'bitrix24WebhookURL', label: 'Webhook URL', type: 'text', required: true, placeholder: 'https://your-domain.bitrix24.com/rest/1/...' },
        { key: 'bitrix24UserID', label: 'User ID', type: 'text', required: true }
      ]
    case 'callmebot':
      return [
        { key: 'callmebotApiKey', label: 'API Key', type: 'text', required: true },
        { key: 'callmebotPhone', label: 'Phone Number', type: 'text', required: true, placeholder: '+1234567890' }
      ]
    case 'cellsynt':
      return [
        { key: 'cellsyntUsername', label: 'Username', type: 'text', required: true },
        { key: 'cellsyntPassword', label: 'Password', type: 'password', required: true },
        { key: 'cellsyntDestination', label: 'Destination Number', type: 'text', required: true },
        { key: 'cellsyntOriginatortype', label: 'Originator Type', type: 'select', options: ['numeric', 'alpha'], required: true },
        { key: 'cellsyntOriginator', label: 'Originator', type: 'text', required: true }
      ]
    case 'freemobile':
      return [
        { key: 'freemobileUser', label: 'User ID', type: 'text', required: true },
        { key: 'freemobilePass', label: 'API Key', type: 'password', required: true }
      ]
    case 'heii-oncall':
      return [
        { key: 'heiiOnCallApiUrl', label: 'Heii API URL', type: 'text', required: true, placeholder: 'https://heiioncall.com/api' },
        { key: 'heiiOnCallTriggerId', label: 'Trigger ID', type: 'text', required: true },
        { key: 'heiiOnCallApiKey', label: 'API Key', type: 'text', required: true }
      ]
    case 'notifery':
      return [
        { key: 'notiferyApiKey', label: 'API Key', type: 'text', required: true },
        { key: 'notiferyTitle', label: 'Title (optional)', type: 'text', required: false, placeholder: 'Uptime-Kuma' }
      ]
    // Batch 4 config fields - SMS gateways
    case 'octopush':
      return [
        { key: 'octopushVersion', label: 'API Version', type: 'select', options: ['1', '2'], required: true },
        { key: 'octopushAPIKey', label: 'API Key (V2)', type: 'text', required: false },
        { key: 'octopushLogin', label: 'Login (V2)', type: 'text', required: false },
        { key: 'octopushPhoneNumber', label: 'Phone Number (V2)', type: 'text', required: false },
        { key: 'octopushSMSType', label: 'SMS Type (V2)', type: 'text', required: false },
        { key: 'octopushSenderName', label: 'Sender Name (V2)', type: 'text', required: false },
        { key: 'octopushDMLogin', label: 'Login (V1)', type: 'text', required: false },
        { key: 'octopushDMAPIKey', label: 'API Key (V1)', type: 'text', required: false },
        { key: 'octopushDMPhoneNumber', label: 'Phone Number (V1)', type: 'text', required: false },
        { key: 'octopushDMSenderName', label: 'Sender Name (V1)', type: 'text', required: false },
        { key: 'octopushDMSMSType', label: 'SMS Type (V1)', type: 'select', options: ['sms_low_cost', 'sms_premium'], required: false }
      ]
    case 'onechat':
      return [
        { key: 'onechatAccessToken', label: 'Access Token', type: 'text', required: true },
        { key: 'onechatBotId', label: 'Bot ID', type: 'text', required: true },
        { key: 'onechatReceiverId', label: 'Receiver ID', type: 'text', required: true }
      ]
    case 'onesender':
      return [
        { key: 'onesenderURL', label: 'API URL', type: 'text', required: true },
        { key: 'onesenderToken', label: 'Access Token', type: 'text', required: true },
        { key: 'onesenderReceiver', label: 'Receiver Number', type: 'text', required: true },
        { key: 'onesenderTypeReceiver', label: 'Receiver Type', type: 'select', options: ['private', 'group'], required: true }
      ]
    case 'promosms':
      return [
        { key: 'promosmsLogin', label: 'Login', type: 'text', required: true },
        { key: 'promosmsPassword', label: 'Password', type: 'password', required: true },
        { key: 'promosmsPhoneNumber', label: 'Phone Number', type: 'text', required: true },
        { key: 'promosmsSenderName', label: 'Sender Name', type: 'text', required: true },
        { key: 'promosmsSMSType', label: 'SMS Type', type: 'select', options: ['0', '1', '3'], required: true },
        { key: 'promosmsAllowLongSMS', label: 'Allow Long SMS', type: 'checkbox', required: false }
      ]
    case 'serwersms':
      return [
        { key: 'serwersmsUsername', label: 'Username', type: 'text', required: true },
        { key: 'serwersmsPassword', label: 'Password', type: 'password', required: true },
        { key: 'serwersmsPhoneNumber', label: 'Phone Number', type: 'text', required: true },
        { key: 'serwersmsSenderName', label: 'Sender Name', type: 'text', required: true }
      ]
    case 'sevenio':
      return [
        { key: 'sevenioApiKey', label: 'API Key', type: 'text', required: true },
        { key: 'sevenioTo', label: 'To Number', type: 'text', required: true },
        { key: 'sevenioSender', label: 'Sender (optional)', type: 'text', required: false }
      ]
    case 'smsmanager':
      return [
        { key: 'smsmanagerApiKey', label: 'API Key', type: 'text', required: true },
        { key: 'smsmanagerNumbers', label: 'Phone Numbers', type: 'text', required: true },
        { key: 'smsmanagerMessageType', label: 'Message Type', type: 'text', required: true }
      ]
    case 'smspartner':
      return [
        { key: 'smspartnerApikey', label: 'API Key', type: 'text', required: true },
        { key: 'smspartnerSenderName', label: 'Sender Name', type: 'text', required: true },
        { key: 'smspartnerPhoneNumber', label: 'Phone Number', type: 'text', required: true }
      ]
    case 'smsplanet':
      return [
        { key: 'smsplanetApiToken', label: 'API Token', type: 'text', required: true },
        { key: 'smsplanetSenderName', label: 'Sender Name', type: 'text', required: true },
        { key: 'smsplanetPhoneNumbers', label: 'Phone Numbers', type: 'text', required: true }
      ]
    case 'smsc':
      return [
        { key: 'smscLogin', label: 'Login', type: 'text', required: true },
        { key: 'smscPassword', label: 'Password', type: 'password', required: true },
        { key: 'smscToNumber', label: 'To Number', type: 'text', required: true },
        { key: 'smscSenderName', label: 'Sender Name (optional)', type: 'text', required: false },
        { key: 'smscTranslit', label: 'Transliteration', type: 'select', options: ['0', '1', '2'], required: false }
      ]
    case 'smseagle':
      return [
        { key: 'smseagleUrl', label: 'SMSEagle URL', type: 'text', required: true },
        { key: 'smseagleToken', label: 'Access Token', type: 'text', required: true },
        { key: 'smseagleRecipientType', label: 'Recipient Type', type: 'select', options: ['smseagle-to', 'smseagle-group', 'smseagle-contact'], required: true },
        { key: 'smseagleRecipientTo', label: 'Recipient', type: 'text', required: true },
        { key: 'smseaglePriority', label: 'Priority (0-9)', type: 'number', required: false },
        { key: 'smseagleEncoding', label: 'Encoding', type: 'select', options: ['standard', 'unicode'], required: false }
      ]
    case 'waha':
      return [
        { key: 'wahaApiUrl', label: 'WAHA API URL', type: 'text', required: true, placeholder: 'http://localhost:3000' },
        { key: 'wahaSession', label: 'Session (optional)', type: 'text', required: false, placeholder: 'default' },
        { key: 'wahaChatId', label: 'Chat ID', type: 'text', required: true, placeholder: '1234567890@c.us' }
      ]
    case 'whapi':
      return [
        { key: 'whapiApiUrl', label: 'Whapi API URL', type: 'text', required: true, placeholder: 'https://gate.whapi.cloud' },
        { key: 'whapiAuthToken', label: 'Auth Token', type: 'text', required: true },
        { key: 'whapiRecipient', label: 'Recipient', type: 'text', required: true, placeholder: '1234567890@s.whatsapp.net' }
      ]
    case 'yzj':
      return [
        { key: 'yzjWebHookUrl', label: 'Webhook URL', type: 'text', required: true }
      ]
    case 'gtx-messaging':
      return [
        { key: 'gtxMessagingApiKey', label: 'API Key', type: 'text', required: true },
        { key: 'gtxMessagingFrom', label: 'From Number', type: 'text', required: true },
        { key: 'gtxMessagingTo', label: 'To Number', type: 'text', required: true }
      ]
    case 'nostr':
      return [
        { key: 'nostrSender', label: 'Sender Private Key (nsec)', type: 'password', required: true },
        { key: 'nostrRecipients', label: 'Recipients (comma-separated npub)', type: 'text', required: true },
        { key: 'nostrRelays', label: 'Relays (comma-separated URLs)', type: 'text', required: true }
      ]
    default:
      return []
  }
})

function handleSubmit() {
  emit('submit', { ...form.value })
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="handleSubmit">
    <!-- Basic Info -->
    <div class="space-y-4">
      <UFormField label="Friendly Name" required>
        <UInput
          v-model="form.name"
          placeholder="e.g., Discord - DevOps Team"
          required
        />
      </UFormField>

      <UFormField label="Notification Type" required>
        <USelect
          v-model="form.type"
          :items="notificationTypes.map(t => ({ label: t.label, value: t.value }))"
        />
      </UFormField>
    </div>

    <!-- Dynamic Config Fields -->
    <div class="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">
        {{ notificationTypes.find(t => t.value === form.type)?.label }} Settings
      </h3>
      
      <template v-for="field in configFields" :key="field.key">
        <UFormField :label="field.label" :required="field.required">
          <UInput
            v-if="field.type === 'text'"
            v-model="form.config[field.key]"
            :placeholder="field.placeholder"
            :required="field.required"
          />
          <UInput
            v-else-if="field.type === 'password'"
            v-model="form.config[field.key]"
            type="password"
            :placeholder="field.placeholder"
            :required="field.required"
          />
          <UInput
            v-else-if="field.type === 'number'"
            v-model.number="form.config[field.key]"
            type="number"
            :placeholder="field.placeholder"
            :required="field.required"
          />
          <UTextarea
            v-else-if="field.type === 'textarea'"
            v-model="form.config[field.key]"
            :placeholder="field.placeholder"
            :required="field.required"
            :rows="3"
          />
          <UCheckbox
            v-else-if="field.type === 'checkbox'"
            v-model="form.config[field.key]"
          />
          <USelect
            v-else-if="field.type === 'select'"
            v-model="form.config[field.key]"
            :items="(field.options || []).map((o: string) => ({ label: o, value: o }))"
          />
        </UFormField>
      </template>
    </div>

    <!-- Options -->
    <div class="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
      <UCheckbox
        v-model="form.isDefault"
        label="Default enabled (Apply to all new monitors)"
      />
      <UCheckbox
        v-model="form.active"
        label="Enable this notification"
      />
      <UCheckbox
        v-if="!notification"
        v-model="form.applyExisting"
        label="Also apply to existing monitors"
      />
    </div>

    <!-- Actions -->
    <div class="flex justify-end gap-3 pt-4">
      <UButton variant="ghost" @click="emit('cancel')">
        Cancel
      </UButton>
      <UButton type="submit" :loading="loading">
        {{ notification ? 'Update' : 'Create' }}
      </UButton>
    </div>
  </form>
</template>
