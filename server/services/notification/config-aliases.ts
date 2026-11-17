// server/services/notification/config-aliases.ts
// The notification forms (Settings > Notifications) save uptime-kuma's field
// names (slackwebhookURL, pushoveruserkey, ...), while the providers read
// their own (webhookUrl, userKey, ...). This fills a provider's names from
// the form's when they are missing, so both shapes work. Pure:
// tests/server/notification-config.test.ts.

type Aliases = Record<string, string[]>

/** provider key ← form keys (first one set wins); keyed by normalized type */
const ALIASES: Record<string, Aliases> = {
  alerta: { alertaApiEndpoint: ['alertaAPIEndpoint'], alertaApiKey: ['alertaAPIKey'] },
  aliyunsms: { accessKeySecret: ['secretAccessKey'], phoneNumbers: ['phonenumber'] },
  apprise: { appriseUrl: ['appriseURL'], urls: ['appriseURLs'] },
  cellsynt: { cellsyntLogin: ['cellsyntUsername'], cellsyntOriginatortype: ['cellsyntOrigintype'] },
  clicksendsms: {
    clicksendsmsLogin: ['clickSendSmsLogin'],
    clicksendsmsPassword: ['clickSendSmsKey'],
    clicksendsmsToNumber: ['clickSendSmsToNumber'],
    clicksendsmsSenderName: ['clickSendSmsSenderName'],
  },
  dingtalk: { webhookUrl: ['webHookUrl'], secret: ['secretKey'] },
  discord: { webhookUrl: ['discordWebhookUrl'], username: ['discordUsername'] },
  feishu: { webhookUrl: ['feishuWebHookUrl'] },
  googlechat: { webhookUrl: ['googleChatWebhookURL'] },
  gotify: { serverUrl: ['gotifyserverurl'], appToken: ['gotifyapplicationToken'], priority: ['gotifyPriority'] },
  grafanaoncall: { webhookUrl: ['grafanaOncallWebhookURL'] },
  gtxmessaging: { gtxMessagingApiKey: ['gtxApiKey'], gtxMessagingFrom: ['gtxFrom'], gtxMessagingTo: ['gtxTo'] },
  homeassistant: { serverUrl: ['homeAssistantUrl'], accessToken: ['homeAssistantLongLivedAccessToken'], notifyService: ['homeAssistantNotifyTarget'] },
  line: { channelAccessToken: ['lineChannelAccessToken'], userId: ['lineUserID'] },
  lunasea: { lunaSeaTarget: ['lunaseaTarget'] },
  matrix: { roomId: ['internalRoomId'] },
  mattermost: { webhookUrl: ['mattermostWebhookUrl'], username: ['mattermostusername'], iconUrl: ['mattermosticonurl'], channel: ['mattermostchannel'] },
  ntfy: { topic: ['ntfytopic'], serverUrl: ['ntfyserverurl'], priority: ['ntfyPriority'], username: ['ntfyusername'], password: ['ntfypassword'] },
  octopush: {
    octopushAPIKey: ['octopushApiKey'],
    octopushSMSType: ['octopushSmsType'],
    octopushSenderName: ['octopushFromNumber'],
    octopushPhoneNumber: ['octopushToNumber'],
  },
  onebot: { httpAddr: ['onebotHttpAddr'], accessToken: ['onebotAccessToken'], msgType: ['onebotMsgType'], recieverId: ['onebotReceiverId'] },
  onechat: { onechatReceiverId: ['onechatReceiverID'] },
  onesender: { onesenderTypeReceiver: ['onesenderRecipientType'], onesenderReceiver: ['onesenderRecipient'] },
  opsgenie: { apiKey: ['opsgenieApiKey'], region: ['opsgenieRegion'], priority: ['opsgeniePriority'] },
  pagerduty: { integrationKey: ['pagerdutyIntegrationKey'], severity: ['pagerdutyPriority'] },
  pagertree: { pagerTreeIntegrationUrl: ['pagerTreeIntegrationURL'] },
  promosms: { promosmsSMSType: ['promosmsSmsType'], promosmsSenderName: ['promosmsSender'] },
  pushbullet: { accessToken: ['pushbulletAccessToken'], deviceIden: ['pushbulletDeviceIdentifier'] },
  pushover: { userKey: ['pushoveruserkey'], appToken: ['pushoverapptoken'], priority: ['pushoverpriority'], device: ['pushoverdevice'], sound: ['pushoversounds'] },
  pushplus: { pushPlusSendKey: ['pushplusToken'], pushPlusChannel: ['pushplusChannel'] },
  rocketchat: { webhookUrl: ['rocketwebhookURL'], username: ['rocketusername'], iconEmoji: ['rocketiconemo'] },
  sevenio: { sevenioSender: ['sevenioFrom'] },
  signal: { signalUrl: ['signalURL'], number: ['signalNumber'], recipients: ['signalRecipients'] },
  slack: { webhookUrl: ['slackwebhookURL'], channel: ['slackchannel'] },
  smsc: { smscToNumber: ['smscPhones'] },
  smseagle: { smseagleRecipientTo: ['smseagleRecipient'] },
  smsmanager: { smsmanagerNumbers: ['smsmanagerPhoneNumber'] },
  smspartner: { smspartnerApikey: ['smspartnerApiKey'] },
  smsplanet: { smsplanetPhoneNumbers: ['smsplanetPhoneNumber'], smsplanetApiToken: ['smsplanetApiKey'] },
  splunk: { serverUrl: ['splunkURL'], token: ['splunkToken'] },
  techuluspush: { pushAPIKey: ['techulusPushAPIKey'] },
  telegram: { botToken: ['telegramBotToken'], chatId: ['telegramChatID'] },
  threema: { threemaSenderIdentity: ['threemaGatewayID'] },
  twilio: { accountSid: ['twilioAccountSID'], authToken: ['twilioAuthToken'], fromNumber: ['twilioFromNumber'], toNumber: ['twilioToNumber'] },
  webhook: { url: ['webhookURL'] },
  whapi: { whapiRecipient: ['whapiTo'] },
  yzj: { yzjWebHookUrl: ['yzjWebhookUrl'] },
  zohocliq: { zohoCliqWebhookUrl: ['zohoCliqWebhookURL'] },
}

/** "rocket.chat", "rocketchat", "Rocket-Chat" → "rocketchat" */
export function normalizeType(type: string): string {
  return String(type ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const isSet = (v: unknown) => v !== undefined && v !== null && v !== ''

export function notificationConfig(type: string, raw: unknown): Record<string, any> {
  let config: Record<string, any> = {}
  if (typeof raw === 'string') {
    try { config = JSON.parse(raw) ?? {} } catch { config = {} }
  } else if (raw && typeof raw === 'object') {
    config = { ...(raw as Record<string, any>) }
  }
  const t = normalizeType(type)
  for (const [key, from] of Object.entries(ALIASES[t] ?? {})) {
    if (isSet(config[key])) continue
    const source = from.find(f => isSet(config[f]))
    if (source) config[key] = config[source]
  }

  // Values that are built, not renamed
  if (t === 'wecom' && !isSet(config.webhookUrl) && isSet(config.weComBotKey)) {
    config.webhookUrl = `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${encodeURIComponent(config.weComBotKey)}`
  }
  if (t === 'signl4' && !isSet(config.signl4WebhookURL) && isSet(config.signl4TeamSecret)) {
    config.signl4WebhookURL = `https://connect.signl4.com/webhook/${encodeURIComponent(config.signl4TeamSecret)}`
  }
  if (t === 'webhook') {
    if (!isSet(config.headers) && isSet(config.webhookAdditionalHeaders)) {
      try {
        const headers = typeof config.webhookAdditionalHeaders === 'string' ? JSON.parse(config.webhookAdditionalHeaders) : config.webhookAdditionalHeaders
        if (headers && typeof headers === 'object' && !Array.isArray(headers)) config.headers = headers
      } catch { /* not JSON: ignored */ }
    }
    if (!isSet(config.body) && config.webhookContentType === 'custom' && isSet(config.webhookCustomBody)) {
      config.body = config.webhookCustomBody
    }
  }
  return config
}
