import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { prisma, request, data, user, workspace, cleanup, type Identity, type Scope } from './helpers/http'

let owner: Identity, scope: Scope
let channelId: number

before(async () => {
  owner = await user('escalation')
  scope = await workspace(owner, 'Escalation')
  const channel = await prisma.notification.create({
    data: { name: 'Escalation channel', type: 'webhook', config: {}, userId: owner.id, workspaceId: scope.workspaceId },
  })
  channelId = channel.id
})
after(async () => { await cleanup([owner], [scope]) })

test('per-channel delay persists, is returned by the editor DTO and survives cloning', async () => {
  const created = await data(await request('/api/v1/monitors', 'POST', owner, scope, {
    name: 'Escalation monitor', type: 'http', url: 'http://127.0.0.1:9/health',
    notifications: [channelId], notificationDelays: { [String(channelId)]: 30 },
  }))
  assert.equal(created.ok, true)
  assert.equal(created.data.notificationDelays[String(channelId)], 30)

  const link = await prisma.monitorNotification.findUniqueOrThrow({
    where: { monitorId_notificationId: { monitorId: created.data.id, notificationId: channelId } },
  })
  assert.equal(link.delayMinutes, 30)

  const cloned = await data(await request(`/api/v1/monitors/${created.data.id}/clone`, 'POST', owner, scope, {}))
  const cloneLink = await prisma.monitorNotification.findUniqueOrThrow({
    where: { monitorId_notificationId: { monitorId: cloned.data.id, notificationId: channelId } },
  })
  assert.equal(cloneLink.delayMinutes, 30)
})
