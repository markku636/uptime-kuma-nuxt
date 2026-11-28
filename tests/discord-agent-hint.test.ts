import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildDiscordBody } from '../server/services/notification/providers/discord'

const down = {
  title: '🔴 example is DOWN',
  body: 'DOWN · CHECK_FAILED',
  monitorName: 'example',
  status: 'down' as const,
  ping: 0,
  time: '2026-11-27T00:00:00.000Z'
}

test('agentHint 只在 DOWN 事件附加到描述', () => {
  const body = buildDiscordBody(down, { webhookUrl: 'https://discord.com/api/webhooks/x/y', agentHint: 'Hermes agent：請檢查' })
  assert.equal(body.embeds[0].description, 'DOWN · CHECK_FAILED\n\n🤖 Hermes agent：請檢查')

  const up = buildDiscordBody({ ...down, status: 'up', title: '🟢 example is UP', body: 'UP' }, { webhookUrl: 'x', agentHint: 'Hermes agent：請檢查' })
  assert.equal(up.embeds[0].description, 'UP')
})

test('agentHint 去空白並截斷到 1000 字，避免超過 embed 限制', () => {
  const body = buildDiscordBody(down, { webhookUrl: 'x', agentHint: `  ${'A'.repeat(1200)}  ` })
  assert.equal(body.embeds[0].description.split('🤖 ')[1], 'A'.repeat(1000))
})

test('沒有 agentHint 或設定為非字串時，描述維持原本內容', () => {
  assert.equal(buildDiscordBody(down, { webhookUrl: 'x' }).embeds[0].description, 'DOWN · CHECK_FAILED')
  assert.equal(buildDiscordBody(down, { webhookUrl: 'x', agentHint: 42 as any }).embeds[0].description, 'DOWN · CHECK_FAILED')
})

test('有 monitorId 時 Discord embed 帶 Monitor ID 欄位', () => {
  const body = buildDiscordBody({ ...down, monitorId: 65 }, { webhookUrl: 'x' })
  assert.deepEqual(body.embeds[0].fields.find((f: any) => f.name === 'Monitor ID'), { name: 'Monitor ID', value: '65', inline: true })
  assert.equal(buildDiscordBody(down, { webhookUrl: 'x' }).embeds[0].fields.some((f: any) => f.name === 'Monitor ID'), false)
})

test('monitorUrlBase 搭配 monitorId 產生可點擊的 embed 標題連結，非法值忽略', () => {
  const body = buildDiscordBody({ ...down, monitorId: 65 }, { webhookUrl: 'x', monitorUrlBase: 'https://uptime.markkulab.net/monitors/' })
  assert.equal(body.embeds[0].url, 'https://uptime.markkulab.net/monitors/65')
  assert.equal('url' in buildDiscordBody(down, { webhookUrl: 'x', monitorUrlBase: 'https://uptime.markkulab.net/monitors/' }).embeds[0], false)
  assert.equal('url' in buildDiscordBody({ ...down, monitorId: 65 }, { webhookUrl: 'x', monitorUrlBase: 'javascript:alert(1)' }).embeds[0], false)
})

test('content 可自訂純文字前導且截斷到 1000 字，未設定時不帶此欄位', () => {
  assert.equal('content' in buildDiscordBody(down, { webhookUrl: 'x' }), false)
  const body = buildDiscordBody(down, { webhookUrl: 'x', content: '  CHECK THIS  ' })
  assert.equal(body.content, 'CHECK THIS')
  const long = buildDiscordBody(down, { webhookUrl: 'x', content: 'A'.repeat(1200) })
  assert.equal(long.content, 'A'.repeat(1000))
  assert.equal(buildDiscordBody(down, { webhookUrl: 'x', content: 7 as any }).content, undefined)
})
