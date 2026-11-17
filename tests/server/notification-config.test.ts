import { describe, expect, it, vi } from 'vitest'

vi.mock('../../server/utils/prisma', () => ({ prisma: {} }))
const { resolveProvider } = await import('../../server/services/notification/sender')
const { providers } = await import('../../server/services/notification/providers/index')
const { notificationConfig, normalizeType } = await import('../../server/services/notification/config-aliases')

// The types Settings > Notifications offers (its <select> values)
const PAGE_TYPES = 'discord slack telegram email webhook line teams pagerduty pushover ntfy dingtalk feishu wecom aliyunsms serverchan pushplus bark kook yzj mattermost rocketchat googlechat matrix zohocliq pumble stackfield opsgenie grafanaoncall splunk squadcast signl4 goalert pagertree alerta flashduty alertnow heiioncall gotify apprise pushbullet lunasea techuluspush pushy pushdeer wpush gorush twilio clicksendsms 46elks cellsynt freemobile octopush promosms serwersms sevenio smsmanager smspartner smsplanet smsc smseagle gtxmessaging waha whapi callmebot signal threema onesender onechat homeassistant sendgrid onebot spugpush keep bitrix24 notifery nostr'.split(' ')

describe('resolveProvider', () => {
  it('has a provider for every registered type', () => {
    const missing = Object.keys(providers).filter(t => !resolveProvider(t))
    expect(missing).toEqual([])
  })

  it('has a provider for every type the settings page offers', () => {
    const missing = PAGE_TYPES.filter(t => !resolveProvider(t))
    expect(missing).toEqual([])
  })

  it('matches names with or without separators', () => {
    expect(normalizeType('rocket.chat')).toBe(normalizeType('rocketchat'))
    expect(resolveProvider('google-chat')).toBeTypeOf('function')
    expect(resolveProvider('nope')).toBeNull()
  })
})

describe('notificationConfig', () => {
  it('fills provider keys from the form keys', () => {
    expect(notificationConfig('slack', { slackwebhookURL: 'https://hooks/x', slackchannel: '#ops' })).toMatchObject({ webhookUrl: 'https://hooks/x', channel: '#ops' })
    expect(notificationConfig('pushover', { pushoveruserkey: 'u', pushoverapptoken: 'a' })).toMatchObject({ userKey: 'u', appToken: 'a' })
    expect(notificationConfig('rocket.chat', { rocketwebhookURL: 'https://r' })).toMatchObject({ webhookUrl: 'https://r' })
  })

  it('keeps provider keys that are already set', () => {
    expect(notificationConfig('slack', { webhookUrl: 'keep', slackwebhookURL: 'other' }).webhookUrl).toBe('keep')
  })

  it('builds webhook headers / body and WeCom / SIGNL4 URLs', () => {
    const hook = notificationConfig('webhook', {
      webhookURL: 'https://h',
      webhookAdditionalHeaders: '{"X-Token":"t"}',
      webhookContentType: 'custom',
      webhookCustomBody: '{"m":"{{ msg }}"}',
    })
    expect(hook).toMatchObject({ url: 'https://h', headers: { 'X-Token': 't' }, body: '{"m":"{{ msg }}"}' })
    expect(notificationConfig('wecom', { weComBotKey: 'k 1' }).webhookUrl).toBe('https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=k%201')
    expect(notificationConfig('signl4', { signl4TeamSecret: 's' }).signl4WebhookURL).toBe('https://connect.signl4.com/webhook/s')
  })

  it('accepts a JSON string config', () => {
    expect(notificationConfig('discord', '{"discordWebhookUrl":"https://d"}')).toMatchObject({ webhookUrl: 'https://d' })
  })
})
