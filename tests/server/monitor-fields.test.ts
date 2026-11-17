import { describe, expect, it } from 'vitest'
import { columnData, idList, normalizeMonitorFields, updateMonitorSchema } from '../../server/services/monitor/fields'

describe('idList', () => {
  it('reads ids from every shape the forms send', () => {
    expect(idList([3, '4', 3])).toEqual([3, 4])
    expect(idList([{ tag_id: 3, value: '' }, { tagId: 5 }, { id: 6 }])).toEqual([3, 5, 6])
    expect(idList({ 7: true, 8: false, 9: true })).toEqual([7, 9])
    expect(idList(null)).toBeUndefined()
    expect(idList([0, -1, 'x'])).toEqual([])
  })
})

describe('normalizeMonitorFields', () => {
  it('maps the edit form keys onto columns', () => {
    expect(normalizeMonitorFields({
      maxredirects: 3,
      dns_resolve_server: '1.1.1.1',
      dns_resolve_type: 'AAAA',
      remote_browser: 2,
      assigned_node: 'node-a',
      notificationIDList: { 4: true, 5: false },
      tags: [{ tag_id: 9, value: '' }],
    })).toEqual({
      maxRedirects: 3,
      dnsResolver: '1.1.1.1',
      dnsRecordType: 'AAAA',
      remoteBrowserId: 2,
      assignedNode: 'node-a',
      notifications: [4],
      tags: [9],
    })
  })

  it('keeps the column when both spellings are sent', () => {
    expect(normalizeMonitorFields({ maxRedirects: 1, maxredirects: 5 })).toEqual({ maxRedirects: 1 })
  })

  it('tidies numbers, lists and nulls', () => {
    expect(normalizeMonitorFields({
      port: '8080',
      proxyId: '',
      timeout: '12.5',
      kafkaBrokers: 'a:9092, b:9092\nc:9092',
      interval: null,
      method: null,
      url: null,
    })).toEqual({
      port: 8080,
      proxyId: null,
      timeout: 12.5,
      kafkaBrokers: ['a:9092', 'b:9092', 'c:9092'],
      url: null,
    })
  })
})

describe('updateMonitorSchema', () => {
  it('accepts type-specific settings it used to drop', () => {
    const parsed = updateMonitorSchema.parse({
      jsonPath: '$.ok',
      expectedValue: 'true',
      grpcUrl: 'grpc.example:443',
      mqttTopic: 'up',
      dockerHost: 3,
      dnsResolver: '9.9.9.9',
      proxyId: 1,
      maxRedirects: 0,
      tlsExpiryDays: [7, 14],
      headers: null,
    })
    expect(parsed).toMatchObject({ jsonPath: '$.ok', grpcUrl: 'grpc.example:443', dockerHost: '3', maxRedirects: 0, headers: null })
  })

  it('separates relations from columns', () => {
    expect(columnData({ name: 'x', tags: [1], notifications: [2], parent: 3, workspaceId: 4 })).toEqual({ name: 'x' })
  })
})

describe('review fixes', () => {
  it('leaves relations alone when their value cannot be read', () => {
    expect(normalizeMonitorFields({ tags: '3' })).toEqual({ tags: undefined })
    expect(normalizeMonitorFields({ tags: null, notifications: [] })).toEqual({ tags: null, notifications: [] })
  })

  it('rounds the timeout to whole seconds', () => {
    expect(updateMonitorSchema.parse({ timeout: 1.6 }).timeout).toBe(2)
  })
})
