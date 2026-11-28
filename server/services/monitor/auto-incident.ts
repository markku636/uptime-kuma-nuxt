// Supercheck 風格：失敗時自動在公開狀態頁開事件，恢復時標為 resolved。
// 用既有 setting 表做全域開關，不新增欄位；事件以標題前綴綁定 monitor。
import { enqueueSubscriberNotifications } from '../status-page/subscriber-outbox'

export const AUTO_INCIDENT_SETTING_KEY = 'autoIncidentOnDown'

export interface AutoIncidentDeps { enabled: () => Promise<boolean> }

export async function autoIncidentEnabled(tx: any): Promise<boolean> {
  const setting = await tx.setting.findUnique({ where: { key: AUTO_INCIDENT_SETTING_KEY }, select: { value: true } })
  return setting?.value === 'true'
}

function titleFor(monitorId: number): string {
  return `[monitor:${monitorId}] incident`
}

/** 只處理狀態變化（DOWN/UP）；呼叫端負責判斷 changed。 */
export async function syncAutoIncident(
  tx: any,
  monitor: { id: number; name: string },
  status: number,
  now: Date,
  deps: AutoIncidentDeps = { enabled: () => autoIncidentEnabled(tx) },
): Promise<number> {
  if (![0, 1].includes(status) || !await deps.enabled()) return 0
  const groups = await tx.statusPageGroup.findMany({
    where: { monitors: { some: { monitorId: monitor.id } }, statusPage: { published: true } },
    select: { statusPageId: true },
  })
  const pageIds = [...new Set(groups.map((row: any) => row.statusPageId))]
  const title = titleFor(monitor.id)
  let affected = 0

  for (const statusPageId of pageIds) {
    const incidents = await tx.incident.findMany({
      where: { statusPageId, title: { startsWith: title } },
      select: { id: true, pin: true, updates: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true } } },
    })
    const open = incidents.filter((row: any) => row.updates[0]?.status !== 'resolved')
    if (status === 0) {
      if (!open.length) {
        const incident = await tx.incident.create({ data: {
          statusPageId, title, content: `${monitor.name} is DOWN (auto-created at ${now.toISOString()}).`,
          style: 'danger', impact: 'major', pin: true,
        } })
        await tx.incidentUpdate.create({ data: { incidentId: incident.id, status: 'investigating', message: `${monitor.name} went DOWN.` } })
        try { await enqueueSubscriberNotifications(tx, Number(statusPageId), {
          event: 'incident-created', title, message: `${monitor.name} went DOWN.`, incidentId: Number(incident.id),
        }) } catch { /* 訂閱通知失敗不影響事件本身 */ }
        affected++
      }
    } else if (open.length) {
      for (const incident of open) {
        await tx.incidentUpdate.create({ data: { incidentId: incident.id, status: 'resolved', message: `${monitor.name} recovered.` } })
        await tx.incident.update({ where: { id: incident.id }, data: { pin: false } })
        try { await enqueueSubscriberNotifications(tx, Number(statusPageId), {
          event: 'incident-resolved', title, message: `${monitor.name} recovered.`, incidentId: Number(incident.id),
        }) } catch { /* 訂閱通知失敗不影響事件本身 */ }
        affected++
      }
    }
  }
  return affected
}
