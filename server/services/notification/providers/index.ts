// server/services/notification/providers/index.ts
export { discordProvider } from './discord'
export { slackProvider } from './slack'
export { telegramProvider } from './telegram'
export { emailProvider } from './email'
export { webhookProvider } from './webhook'
export { lineProvider } from './line'
export { teamsProvider } from './teams'
export { gotifyProvider } from './gotify'
export { pushoverProvider } from './pushover'
export { ntfyProvider } from './ntfy'
export { matrixProvider } from './matrix'
export { appriseProvider } from './apprise'
export { feishuProvider } from './feishu'
export { dingtalkProvider } from './dingtalk'
export { wecomProvider } from './wecom'
export { pagerdutyProvider } from './pagerduty'
export { opsgenieProvider } from './opsgenie'
export { aliyunSmsProvider } from './aliyun-sms'
export { signalProvider } from './signal'
export { rocketChatProvider } from './rocket-chat'
export { mattermostProvider } from './mattermost'
export { googleChatProvider } from './google-chat'
export { twilioProvider } from './twilio'
export { pushbulletProvider } from './pushbullet'
export { homeAssistantProvider } from './home-assistant'
export { splunkProvider } from './splunk'
export { grafanaOncallProvider } from './grafana-oncall'
// New providers
export * as barkProvider from './bark'
export * as serverchanProvider from './serverchan'
export * as squadcastProvider from './squadcast'
export * as signl4Provider from './signl4'
export * as lunaSeaProvider from './lunasea'
export * as goAlertProvider from './goalert'
export * as pagerTreeProvider from './pagertree'
export * as techulusPushProvider from './techulus-push'
export * as pushyProvider from './pushy'
export * as pushPlusProvider from './pushplus'
export * as pushDeerProvider from './pushdeer'
export * as threemaProvider from './threema'
export * as kookProvider from './kook'
export * as zohoCliqProvider from './zoho-cliq'
export * as alertaProvider from './alerta'
export * as clickSendSmsProvider from './clicksend-sms'
export * as sendGridProvider from './sendgrid'
export * as flashDutyProvider from './flashduty'
export * as pumbleProvider from './pumble'
export * as stackfieldProvider from './stackfield'
export * as oneBotProvider from './onebot'
export * as spugPushProvider from './spugpush'
export * as keepProvider from './keep'
export * as wPushProvider from './wpush'
// Batch 3 - More providers
export * as lineNotifyProvider from './linenotify'
export * as gorushProvider from './gorush'
export * as alertNowProvider from './alertnow'
export * as elks46Provider from './46elks'
export * as bitrix24Provider from './bitrix24'
export * as callMeBotProvider from './callmebot'
export * as cellsyntProvider from './cellsynt'
export * as freeMobileProvider from './freemobile'
export * as heiiOnCallProvider from './heii-oncall'
export * as notiferyProvider from './notifery'
// Batch 4 - SMS gateways
export * as octopushProvider from './octopush'
export * as oneChatProvider from './onechat'
export * as onesenderProvider from './onesender'
export * as promoSmsProvider from './promosms'
export * as serwerSmsProvider from './serwersms'
export * as sevenIOProvider from './sevenio'
export * as smsManagerProvider from './smsmanager'
export * as smsPartnerProvider from './smspartner'
export * as smsPlanetProvider from './smsplanet'
export * as smscProvider from './smsc'
export * as smsEagleProvider from './smseagle'
export * as wahaProvider from './waha'
export * as whapiProvider from './whapi'
export * as yzjProvider from './yzj'
export * as gtxMessagingProvider from './gtx-messaging'
export * as nostrProvider from './nostr'

export const providers = {
  discord: 'discordProvider',
  slack: 'slackProvider',
  telegram: 'telegramProvider',
  email: 'emailProvider',
  webhook: 'webhookProvider',
  line: 'lineProvider',
  teams: 'teamsProvider',
  gotify: 'gotifyProvider',
  pushover: 'pushoverProvider',
  ntfy: 'ntfyProvider',
  matrix: 'matrixProvider',
  apprise: 'appriseProvider',
  feishu: 'feishuProvider',
  dingtalk: 'dingtalkProvider',
  wecom: 'wecomProvider',
  pagerduty: 'pagerdutyProvider',
  opsgenie: 'opsgenieProvider',
  'aliyun-sms': 'aliyunSmsProvider',
  signal: 'signalProvider',
  'rocket.chat': 'rocketChatProvider',
  mattermost: 'mattermostProvider',
  'google-chat': 'googleChatProvider',
  twilio: 'twilioProvider',
  pushbullet: 'pushbulletProvider',
  'home-assistant': 'homeAssistantProvider',
  splunk: 'splunkProvider',
  'grafana-oncall': 'grafanaOncallProvider',
  bark: 'barkProvider',
  serverchan: 'serverchanProvider',
  squadcast: 'squadcastProvider',
  signl4: 'signl4Provider',
  lunasea: 'lunaSeaProvider',
  goalert: 'goAlertProvider',
  pagertree: 'pagerTreeProvider',
  'techulus-push': 'techulusPushProvider',
  pushy: 'pushyProvider',
  pushplus: 'pushPlusProvider',
  pushdeer: 'pushDeerProvider',
  threema: 'threemaProvider',
  kook: 'kookProvider',
  'zoho-cliq': 'zohoCliqProvider',
  alerta: 'alertaProvider',
  'clicksend-sms': 'clickSendSmsProvider',
  sendgrid: 'sendGridProvider',
  flashduty: 'flashDutyProvider',
  pumble: 'pumbleProvider',
  stackfield: 'stackfieldProvider',
  onebot: 'oneBotProvider',
  spugpush: 'spugPushProvider',
  keep: 'keepProvider',
  wpush: 'wPushProvider',
  // Batch 3
  linenotify: 'lineNotifyProvider',
  gorush: 'gorushProvider',
  alertnow: 'alertNowProvider',
  '46elks': 'elks46Provider',
  bitrix24: 'bitrix24Provider',
  callmebot: 'callMeBotProvider',
  cellsynt: 'cellsyntProvider',
  freemobile: 'freeMobileProvider',
  'heii-oncall': 'heiiOnCallProvider',
  notifery: 'notiferyProvider',
  // Batch 4 - SMS gateways
  octopush: 'octopushProvider',
  onechat: 'oneChatProvider',
  onesender: 'onesenderProvider',
  promosms: 'promoSmsProvider',
  serwersms: 'serwerSmsProvider',
  sevenio: 'sevenIOProvider',
  smsmanager: 'smsManagerProvider',
  smspartner: 'smsPartnerProvider',
  smsplanet: 'smsPlanetProvider',
  smsc: 'smscProvider',
  smseagle: 'smsEagleProvider',
  waha: 'wahaProvider',
  whapi: 'whapiProvider',
  yzj: 'yzjProvider',
  'gtx-messaging': 'gtxMessagingProvider',
  nostr: 'nostrProvider'
} as const

export type ProviderType = keyof typeof providers
