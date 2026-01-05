/**
 * Notification Provider Components Index
 * 自動導出所有通知提供者元件
 */

// 高優先級 - 常用通知
export { default as Discord } from './Discord.vue'
export { default as Slack } from './Slack.vue'
export { default as Telegram } from './Telegram.vue'
export { default as Email } from './Email.vue'
export { default as Webhook } from './Webhook.vue'
export { default as Line } from './Line.vue'
export { default as Teams } from './Teams.vue'
export { default as PagerDuty } from './PagerDuty.vue'
export { default as Pushover } from './Pushover.vue'
export { default as Ntfy } from './Ntfy.vue'

// 中優先級 - 區域性/企業通知
export { default as DingTalk } from './DingTalk.vue'
export { default as Feishu } from './Feishu.vue'
export { default as WeCom } from './WeCom.vue'
export { default as AliyunSms } from './AliyunSms.vue'
export { default as ServerChan } from './ServerChan.vue'
export { default as Bark } from './Bark.vue'
export { default as Gotify } from './Gotify.vue'
export { default as Matrix } from './Matrix.vue'
export { default as Mattermost } from './Mattermost.vue'
export { default as GoogleChat } from './GoogleChat.vue'
export { default as RocketChat } from './RocketChat.vue'
export { default as Opsgenie } from './Opsgenie.vue'

// 低優先級 - 其他通知
export { default as Signal } from './Signal.vue'
export { default as Twilio } from './Twilio.vue'
export { default as Pushbullet } from './Pushbullet.vue'
export { default as HomeAssistant } from './HomeAssistant.vue'
export { default as Splunk } from './Splunk.vue'
export { default as GrafanaOncall } from './GrafanaOncall.vue'
export { default as Apprise } from './Apprise.vue'
export { default as Squadcast } from './Squadcast.vue'
export { default as SIGNL4 } from './SIGNL4.vue'
export { default as LunaSea } from './LunaSea.vue'
export { default as GoAlert } from './GoAlert.vue'
export { default as PagerTree } from './PagerTree.vue'
export { default as TechulusPush } from './TechulusPush.vue'
export { default as Pushy } from './Pushy.vue'
export { default as PushPlus } from './PushPlus.vue'
export { default as PushDeer } from './PushDeer.vue'
export { default as Threema } from './Threema.vue'
export { default as Kook } from './Kook.vue'
export { default as ZohoCliq } from './ZohoCliq.vue'
export { default as Alerta } from './Alerta.vue'
export { default as ClickSendSMS } from './ClickSendSMS.vue'
export { default as SendGrid } from './SendGrid.vue'
export { default as FlashDuty } from './FlashDuty.vue'
export { default as Pumble } from './Pumble.vue'
export { default as Stackfield } from './Stackfield.vue'
export { default as OneBot } from './OneBot.vue'
export { default as SpugPush } from './SpugPush.vue'
export { default as Keep } from './Keep.vue'
export { default as WPush } from './WPush.vue'

// 其他提供者
export { default as LineNotify } from './LineNotify.vue'
export { default as Gorush } from './Gorush.vue'
export { default as AlertNow } from './AlertNow.vue'
export { default as Elks46 } from './46elks.vue'
export { default as Bitrix24 } from './Bitrix24.vue'
export { default as CallMeBot } from './CallMeBot.vue'
export { default as Cellsynt } from './Cellsynt.vue'
export { default as FreeMobile } from './FreeMobile.vue'
export { default as HeiiOnCall } from './HeiiOnCall.vue'
export { default as Notifery } from './Notifery.vue'

// SMS 閘道器
export { default as Octopush } from './Octopush.vue'
export { default as OneChat } from './OneChat.vue'
export { default as Onesender } from './Onesender.vue'
export { default as PromoSMS } from './PromoSMS.vue'
export { default as SerwerSMS } from './SerwerSMS.vue'
export { default as SevenIO } from './SevenIO.vue'
export { default as SMSManager } from './SMSManager.vue'
export { default as SMSPartner } from './SMSPartner.vue'
export { default as SMSPlanet } from './SMSPlanet.vue'
export { default as SMSC } from './SMSC.vue'
export { default as SMSEagle } from './SMSEagle.vue'
export { default as WAHA } from './WAHA.vue'
export { default as Whapi } from './Whapi.vue'
export { default as YZJ } from './YZJ.vue'
export { default as GtxMessaging } from './GtxMessaging.vue'
export { default as Nostr } from './Nostr.vue'

// 通知類型到元件的映射
export const NotificationProviderMap: Record<string, () => Promise<any>> = {
  // 高優先級
  'discord': () => import('./Discord.vue'),
  'slack': () => import('./Slack.vue'),
  'telegram': () => import('./Telegram.vue'),
  'email': () => import('./Email.vue'),
  'smtp': () => import('./Email.vue'),
  'webhook': () => import('./Webhook.vue'),
  'line': () => import('./Line.vue'),
  'teams': () => import('./Teams.vue'),
  'pagerduty': () => import('./PagerDuty.vue'),
  'pushover': () => import('./Pushover.vue'),
  'ntfy': () => import('./Ntfy.vue'),
  
  // 中優先級
  'dingtalk': () => import('./DingTalk.vue'),
  'feishu': () => import('./Feishu.vue'),
  'wecom': () => import('./WeCom.vue'),
  'aliyun-sms': () => import('./AliyunSms.vue'),
  'serverchan': () => import('./ServerChan.vue'),
  'bark': () => import('./Bark.vue'),
  'gotify': () => import('./Gotify.vue'),
  'matrix': () => import('./Matrix.vue'),
  'mattermost': () => import('./Mattermost.vue'),
  'google-chat': () => import('./GoogleChat.vue'),
  'rocket.chat': () => import('./RocketChat.vue'),
  'opsgenie': () => import('./Opsgenie.vue'),
  
  // 低優先級
  'signal': () => import('./Signal.vue'),
  'twilio': () => import('./Twilio.vue'),
  'pushbullet': () => import('./Pushbullet.vue'),
  'home-assistant': () => import('./HomeAssistant.vue'),
  'splunk': () => import('./Splunk.vue'),
  'grafana-oncall': () => import('./GrafanaOncall.vue'),
  'apprise': () => import('./Apprise.vue'),
  'squadcast': () => import('./Squadcast.vue'),
  'signl4': () => import('./SIGNL4.vue'),
  'lunasea': () => import('./LunaSea.vue'),
  'goalert': () => import('./GoAlert.vue'),
  'pagertree': () => import('./PagerTree.vue'),
  'techulus-push': () => import('./TechulusPush.vue'),
  'pushy': () => import('./Pushy.vue'),
  'pushplus': () => import('./PushPlus.vue'),
  'pushdeer': () => import('./PushDeer.vue'),
  'threema': () => import('./Threema.vue'),
  'kook': () => import('./Kook.vue'),
  'zoho-cliq': () => import('./ZohoCliq.vue'),
  'alerta': () => import('./Alerta.vue'),
  'clicksend-sms': () => import('./ClickSendSMS.vue'),
  'sendgrid': () => import('./SendGrid.vue'),
  'flashduty': () => import('./FlashDuty.vue'),
  'pumble': () => import('./Pumble.vue'),
  'stackfield': () => import('./Stackfield.vue'),
  'onebot': () => import('./OneBot.vue'),
  'spugpush': () => import('./SpugPush.vue'),
  'keep': () => import('./Keep.vue'),
  'wpush': () => import('./WPush.vue'),
  
  // 其他提供者
  'linenotify': () => import('./LineNotify.vue'),
  'gorush': () => import('./Gorush.vue'),
  'alertnow': () => import('./AlertNow.vue'),
  '46elks': () => import('./46elks.vue'),
  'bitrix24': () => import('./Bitrix24.vue'),
  'callmebot': () => import('./CallMeBot.vue'),
  'cellsynt': () => import('./Cellsynt.vue'),
  'freemobile': () => import('./FreeMobile.vue'),
  'heii-oncall': () => import('./HeiiOnCall.vue'),
  'notifery': () => import('./Notifery.vue'),
  
  // SMS 閘道器
  'octopush': () => import('./Octopush.vue'),
  'onechat': () => import('./OneChat.vue'),
  'onesender': () => import('./Onesender.vue'),
  'promosms': () => import('./PromoSMS.vue'),
  'serwersms': () => import('./SerwerSMS.vue'),
  'sevenio': () => import('./SevenIO.vue'),
  'smsmanager': () => import('./SMSManager.vue'),
  'smspartner': () => import('./SMSPartner.vue'),
  'smsplanet': () => import('./SMSPlanet.vue'),
  'smsc': () => import('./SMSC.vue'),
  'smseagle': () => import('./SMSEagle.vue'),
  'waha': () => import('./WAHA.vue'),
  'whapi': () => import('./Whapi.vue'),
  'yzj': () => import('./YZJ.vue'),
  'gtx-messaging': () => import('./GtxMessaging.vue'),
  'nostr': () => import('./Nostr.vue'),
}

// 檢查是否有專用元件
export function hasProviderComponent(type: string): boolean {
  return type in NotificationProviderMap
}

// 取得元件
export async function getProviderComponent(type: string) {
  if (hasProviderComponent(type)) {
    const module = await NotificationProviderMap[type]()
    return module.default
  }
  return null
}

// 通知類型列表（包含所有支援的類型）
export const NotificationTypes = [
  // 高優先級
  { value: 'discord', label: 'Discord', hasComponent: true },
  { value: 'slack', label: 'Slack', hasComponent: true },
  { value: 'telegram', label: 'Telegram', hasComponent: true },
  { value: 'email', label: 'Email (SMTP)', hasComponent: true },
  { value: 'webhook', label: 'Webhook', hasComponent: true },
  { value: 'line', label: 'LINE', hasComponent: true },
  { value: 'teams', label: 'Microsoft Teams', hasComponent: true },
  { value: 'pagerduty', label: 'PagerDuty', hasComponent: true },
  { value: 'pushover', label: 'Pushover', hasComponent: true },
  { value: 'ntfy', label: 'ntfy', hasComponent: true },
  
  // 中優先級 - 亞洲
  { value: 'dingtalk', label: 'DingTalk (釘釘)', hasComponent: true },
  { value: 'feishu', label: 'Feishu (飛書)', hasComponent: true },
  { value: 'wecom', label: 'WeCom (企業微信)', hasComponent: true },
  { value: 'aliyun-sms', label: 'Aliyun SMS (阿里雲短信)', hasComponent: true },
  { value: 'serverchan', label: 'ServerChan (方糖)', hasComponent: true },
  { value: 'bark', label: 'Bark', hasComponent: true },
  
  // 其他常用
  { value: 'gotify', label: 'Gotify', hasComponent: true },
  { value: 'matrix', label: 'Matrix', hasComponent: true },
  { value: 'mattermost', label: 'Mattermost', hasComponent: true },
  { value: 'google-chat', label: 'Google Chat', hasComponent: true },
  { value: 'rocket.chat', label: 'Rocket.Chat', hasComponent: true },
  { value: 'opsgenie', label: 'OpsGenie', hasComponent: true },
  
  // 低優先級
  { value: 'signal', label: 'Signal', hasComponent: true },
  { value: 'twilio', label: 'Twilio', hasComponent: true },
  { value: 'pushbullet', label: 'Pushbullet', hasComponent: true },
  { value: 'home-assistant', label: 'Home Assistant', hasComponent: true },
  { value: 'splunk', label: 'Splunk', hasComponent: true },
  { value: 'grafana-oncall', label: 'Grafana OnCall', hasComponent: true },
  { value: 'apprise', label: 'Apprise', hasComponent: true },
  { value: 'squadcast', label: 'Squadcast', hasComponent: true },
  { value: 'signl4', label: 'SIGNL4', hasComponent: true },
  { value: 'lunasea', label: 'LunaSea', hasComponent: true },
  { value: 'goalert', label: 'GoAlert', hasComponent: true },
  { value: 'pagertree', label: 'PagerTree', hasComponent: true },
  { value: 'techulus-push', label: 'Push by Techulus', hasComponent: true },
  { value: 'pushy', label: 'Pushy', hasComponent: true },
  { value: 'pushplus', label: 'PushPlus (推送加)', hasComponent: true },
  { value: 'pushdeer', label: 'PushDeer', hasComponent: true },
  { value: 'threema', label: 'Threema', hasComponent: true },
  { value: 'kook', label: 'Kook (開黑啦)', hasComponent: true },
  { value: 'zoho-cliq', label: 'Zoho Cliq', hasComponent: true },
  { value: 'alerta', label: 'Alerta', hasComponent: true },
  { value: 'clicksend-sms', label: 'ClickSend SMS', hasComponent: true },
  { value: 'sendgrid', label: 'SendGrid', hasComponent: true },
  { value: 'flashduty', label: 'FlashDuty (閃值)', hasComponent: true },
  { value: 'pumble', label: 'Pumble', hasComponent: true },
  { value: 'stackfield', label: 'Stackfield', hasComponent: true },
  { value: 'onebot', label: 'OneBot', hasComponent: true },
  { value: 'spugpush', label: 'SpugPush', hasComponent: true },
  { value: 'keep', label: 'Keep', hasComponent: true },
  { value: 'wpush', label: 'WPush', hasComponent: true },
  
  // 其他提供者
  { value: 'linenotify', label: 'LINE Notify', hasComponent: true },
  { value: 'gorush', label: 'Gorush', hasComponent: true },
  { value: 'alertnow', label: 'AlertNow', hasComponent: true },
  { value: '46elks', label: '46elks SMS', hasComponent: true },
  { value: 'bitrix24', label: 'Bitrix24', hasComponent: true },
  { value: 'callmebot', label: 'CallMeBot', hasComponent: true },
  { value: 'cellsynt', label: 'Cellsynt', hasComponent: true },
  { value: 'freemobile', label: 'Free Mobile SMS', hasComponent: true },
  { value: 'heii-oncall', label: 'Heii On-Call', hasComponent: true },
  { value: 'notifery', label: 'Notifery', hasComponent: true },
  
  // SMS 閘道器
  { value: 'octopush', label: 'Octopush', hasComponent: true },
  { value: 'onechat', label: 'OneChat', hasComponent: true },
  { value: 'onesender', label: 'Onesender', hasComponent: true },
  { value: 'promosms', label: 'PromoSMS', hasComponent: true },
  { value: 'serwersms', label: 'SerwerSMS', hasComponent: true },
  { value: 'sevenio', label: 'Seven.io', hasComponent: true },
  { value: 'smsmanager', label: 'SMS Manager', hasComponent: true },
  { value: 'smspartner', label: 'SMS Partner', hasComponent: true },
  { value: 'smsplanet', label: 'SMS Planet', hasComponent: true },
  { value: 'smsc', label: 'SMSC', hasComponent: true },
  { value: 'smseagle', label: 'SMSEagle', hasComponent: true },
  { value: 'waha', label: 'WAHA (WhatsApp)', hasComponent: true },
  { value: 'whapi', label: 'Whapi (WhatsApp)', hasComponent: true },
  { value: 'yzj', label: 'YZJ (云之家)', hasComponent: true },
  { value: 'gtx-messaging', label: 'GTX Messaging', hasComponent: true },
  { value: 'nostr', label: 'Nostr', hasComponent: true },
]
