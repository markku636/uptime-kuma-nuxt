import {listGroups} from '../../../services/groups'
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'viewer')
  return {ok: true, data: await listGroups(scope.workspaceId, scope.environmentId)}
})
