import {test,before,after} from 'node:test'
import assert from 'node:assert/strict'
import type {BrunoFile,BrunoManifest} from '../shared/types/bruno'
import {prisma,request,data,user,workspace,cleanup,type Identity,type Scope} from './helpers/http'

let owner: Identity, editor: Identity, viewer: Identity, outsider: Identity, a: Scope, staging: Scope, other: Scope

const bru = (name: string, extra = '') => `meta {\n  name: ${name}\n  type: http\n  seq: 1\n}\n\nget {\n  url: http://127.0.0.1:9/${encodeURIComponent(name)}\n  body: none\n  auth: none\n}\n${extra}`
const collection: BrunoFile[] = [
  {path: 'bruno.json', content: JSON.stringify({version: '1', name: 'Orders API', type: 'collection'})},
  {path: 'health.bru', content: bru('Health')},
  {path: 'orders/folder.bru', content: 'meta {\n  name: Orders\n  seq: 1\n}\n'},
  {path: 'orders/list.bru', content: bru('List orders', '\ntests {\n  test("ok", function() {});\n}\n')},
  {path: 'orders/admin/refund.bru', content: bru('Refund')},
]

async function importCollection(input: BrunoManifest, scope = a, identity = owner) {
  const preview = await data(await request('/api/v1/bruno/preview', 'POST', identity, scope, input))
  assert.equal(preview.ok, true, JSON.stringify(preview.issues))
  return {preview, result: await data(await request('/api/v1/bruno/import', 'POST', identity, scope, {...input, digest: preview.digest}))}
}
const groupsOf = async (scope = a, identity = owner) => (await data(await request('/api/v1/groups', 'GET', identity, scope))).data

before(async () => {
  owner = await user('groups-owner'); editor = await user('groups-editor'); viewer = await user('groups-viewer'); outsider = await user('groups-outsider')
  a = await workspace(owner, 'Groups A'); other = await workspace(outsider, 'Groups other')
  const created = await data(await request(`/api/v1/workspaces/${a.workspaceId}/environments`, 'POST', owner, a, {name: 'staging'}))
  staging = {workspaceId: a.workspaceId, environmentId: created.data.id}
  for (const [member, role] of [[editor, 'editor'], [viewer, 'viewer']] as const) {
    await data(await request(`/api/v1/workspaces/${a.workspaceId}/members`, 'POST', owner, a, {username: member.username, role}))
  }
})
after(async () => { await cleanup([owner, editor, viewer, outsider], [a, other]) })

test('Bruno folders become a group tree shared by environments; script/tests are flagged on the source', async () => {
  const input: BrunoManifest = {collectionId: 'orders-api', mode: 'create', files: collection}
  const {preview, result} = await importCollection(input)
  assert.deepEqual(preview.groups.map((plan: any) => [plan.path, plan.name, plan.exists]), [['', 'Orders API', false], ['orders', 'Orders', false], ['orders/admin', 'admin', false]])
  assert.equal(preview.requests.find((row: any) => row.path === 'orders/list.bru').skipped[0], 'tests')
  assert.equal(result.data.createdIds.length, 3)
  assert.equal(result.data.withSkippedBlocks, 1)

  const {groups} = await groupsOf()
  const byPath = Object.fromEntries(groups.map((group: any) => [group.sourcePath, group]))
  assert.equal(byPath[''].parentId, null)
  assert.equal(byPath['orders'].parentId, byPath[''].id)
  assert.equal(byPath['orders/admin'].parentId, byPath['orders'].id)
  const monitors = await prisma.monitor.findMany({where: {workspaceId: a.workspaceId}, include: {brunoSources: true}, orderBy: {name: 'asc'}})
  assert.deepEqual(monitors.map(row => [row.name, row.groupId]), [['Health', byPath[''].id], ['List orders', byPath['orders'].id], ['Refund', byPath['orders/admin'].id]])
  assert.deepEqual(monitors.find(row => row.name === 'List orders')!.brunoSources[0]!.ignoredBlocks, ['tests'])

  // Same collection into staging reuses the groups instead of duplicating them.
  await importCollection(input, staging)
  assert.equal((await groupsOf(staging)).groups.length, 3)
  assert.equal((await groupsOf(staging)).groups.find((group: any) => group.sourcePath === 'orders').monitorCount, 1)

  // Monitor list filters by group.
  const listed = await data(await request(`/api/v1/monitors?groupId=${byPath['orders/admin'].id}`, 'GET', owner, a))
  assert.deepEqual(listed.data.map((row: any) => row.name), ['Refund'])
  const detail = await data(await request(`/api/v1/monitors/${monitors[1]!.id}`, 'GET', owner, a))
  assert.equal(detail.data.groupId, byPath['orders'].id)
  assert.deepEqual(detail.data.bruno.ignoredBlocks, ['tests'])
})

test('re-import with replace keeps a monitor the user moved, and folders renamed by the user keep matching', async () => {
  const {groups} = await groupsOf()
  const orders = groups.find((group: any) => group.sourcePath === 'orders'), root = groups.find((group: any) => group.sourcePath === '')
  const refund = await prisma.monitor.findFirstOrThrow({where: {workspaceId: a.workspaceId, environmentId: a.environmentId, name: 'Refund'}})
  await data(await request('/api/v1/groups/move', 'POST', editor, a, {monitorIds: [refund.id], groupId: root.id}))
  await data(await request(`/api/v1/groups/${orders.id}`, 'PUT', editor, a, {name: 'Orders (renamed)'}))
  const {preview, result} = await importCollection({collectionId: 'orders-api', mode: 'replace', files: collection})
  assert.ok(preview.groups.every((plan: any) => plan.exists))
  assert.equal(result.data.replacedIds.length, 3)
  assert.equal((await prisma.monitor.findUniqueOrThrow({where: {id: refund.id}})).groupId, root.id)
  assert.equal((await groupsOf()).groups.length, 3)
})

test('group permissions, cycle prevention and workspace isolation', async () => {
  const {groups} = await groupsOf()
  const root = groups.find((group: any) => group.sourcePath === ''), admin = groups.find((group: any) => group.sourcePath === 'orders/admin')
  assert.equal((await request('/api/v1/groups', 'POST', viewer, a, {name: 'Nope'})).status, 403)
  assert.equal((await request(`/api/v1/groups/${root.id}`, 'PUT', editor, a, {parentId: admin.id})).status, 400)
  assert.equal((await request(`/api/v1/groups/${root.id}`, 'PUT', outsider, other, {name: 'x'})).status, 404)
  assert.equal((await request('/api/v1/groups/move', 'POST', outsider, other, {monitorIds: [1], groupId: null})).status, 404)
  const created = await data(await request('/api/v1/groups', 'POST', editor, a, {name: '  Manual\n group ', parentId: root.id}))
  assert.equal(created.data.name, 'Manual group')
  assert.equal(created.data.sourceKind, 'manual')
  const viewerList = await groupsOf(a, viewer)
  assert.equal(viewerList.groups.length, 4)
})

test('Bruno download is owner-only: single .bru, group ZIP and environment ZIP', async () => {
  const {groups} = await groupsOf()
  const root = groups.find((group: any) => group.sourcePath === '')
  const health = await prisma.monitor.findFirstOrThrow({where: {workspaceId: a.workspaceId, environmentId: a.environmentId, name: 'Health'}})
  assert.equal((await request(`/api/v1/bruno/download?ids=${health.id}`, 'GET', editor, a)).status, 403)
  assert.equal((await request(`/api/v1/bruno/download?ids=${health.id}&all=1`, 'GET', owner, a)).status, 400)

  const single = await request(`/api/v1/bruno/download?ids=${health.id}`, 'GET', owner, a)
  assert.equal(single.status, 200)
  assert.match(single.headers.get('content-disposition') || '', /Health\.bru/)
  assert.match(await single.text(), /get \{\n  url: http:\/\/127\.0\.0\.1:9\/Health/)

  const zip = await request(`/api/v1/bruno/download?groupId=${root.id}`, 'GET', owner, a)
  assert.equal(zip.status, 200)
  assert.equal(zip.headers.get('content-type'), 'application/zip')
  assert.equal(zip.headers.get('x-bruno-exported'), '3')
  const bytes = Buffer.from(await zip.arrayBuffer())
  assert.equal(bytes.readUInt32LE(0), 0x04034b50)
  const names = bytes.toString('latin1')
  assert.ok(names.includes('Orders API/bruno.json') && names.includes('Orders API/Orders (renamed)/folder.bru'))

  const all = await request('/api/v1/bruno/download?all=1', 'GET', owner, a)
  assert.equal(all.status, 200)
  assert.ok(Number(all.headers.get('x-bruno-exported')) >= 3)
})

test('deleting a group keeps or deletes monitors only in the selected environment', async () => {
  const {groups} = await groupsOf()
  const orders = groups.find((group: any) => group.sourcePath === 'orders'), root = groups.find((group: any) => group.sourcePath === '')
  const before = await prisma.monitor.count({where: {workspaceId: a.workspaceId}})
  const removed = await data(await request(`/api/v1/groups/${orders.id}?monitors=delete`, 'DELETE', editor, a))
  assert.equal(removed.data.deletedGroups, 2)
  assert.equal(removed.data.deletedMonitorIds.length, 1)
  assert.equal(await prisma.monitor.count({where: {workspaceId: a.workspaceId}}), before - 1)
  // Staging monitors of the deleted folders survive and move up to the parent group.
  const stagingOrders = await prisma.monitor.findMany({where: {workspaceId: a.workspaceId, environmentId: staging.environmentId, name: {in: ['List orders', 'Refund']}}})
  assert.equal(stagingOrders.length, 2)
  assert.ok(stagingOrders.every(row => row.groupId === root.id))

  const kept = await data(await request(`/api/v1/groups/${root.id}?monitors=keep`, 'DELETE', owner, a))
  assert.ok(kept.data.deletedGroups >= 1)
  assert.equal(await prisma.monitor.count({where: {workspaceId: a.workspaceId, groupId: {not: null}}}), 0)
  assert.equal(await prisma.monitor.count({where: {workspaceId: a.workspaceId}}), before - 1)
})
