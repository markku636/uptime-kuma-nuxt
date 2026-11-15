import {deleteGroup} from '../../../services/groups'
import {stopMonitorJob} from '../../../services/monitor/scheduler'
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'editor')
  const monitors = getQuery(event).monitors === 'delete' ? 'delete' : 'keep'
  const result = await deleteGroup(scope.workspaceId, scope.environmentId, Number(getRouterParam(event, 'id')), monitors)
  result.deletedMonitorIds.forEach(stopMonitorJob)
  return {ok: true, data: result}
})
