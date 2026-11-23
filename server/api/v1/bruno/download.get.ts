import {z} from 'zod'
import {buildBrunoCollection,exportSingleRequest,safeFileName,type ExportEnvironment} from '../../../services/bruno/collection-export'
import {BrunoExportError} from '../../../services/bruno/exporter'
import {findGroup,subtreeIds} from '../../../services/groups'
import {createZip} from '../../../utils/zip'

const MAX_MONITORS = 1000
const query = z.object({
  ids: z.string().max(12000).optional(),
  groupId: z.coerce.number().int().positive().optional(),
  all: z.enum(['1']).optional(),
}).strict()

function attachment(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/**
 * Bruno download for the selected environment.
 * ?ids=12 → one .bru file; ?ids=1,2,3 / ?groupId=5 / ?all=1 → ZIP of a Bruno collection.
 * Request content is written as stored, so this is limited to workspace owners.
 */
export default defineEventHandler(async event => {
  const scope = await requireWorkspace(event, 'owner'), parsed = query.safeParse(getQuery(event))
  if (!parsed.success || [parsed.data.ids, parsed.data.groupId, parsed.data.all].filter(Boolean).length !== 1) {
    throw createError({statusCode: 400, message: 'Choose exactly one of ids, groupId or all'})
  }
  const ids = parsed.data.ids ? [...new Set(parsed.data.ids.split(',').map(Number))] : undefined
  if (ids && (!ids.length || ids.length > MAX_MONITORS || ids.some(id => !Number.isSafeInteger(id) || id <= 0))) {
    throw createError({statusCode: 400, message: `Select 1–${MAX_MONITORS} monitor IDs`})
  }
  const [workspace, environment, groups] = await Promise.all([
    prisma.workspace.findUnique({where: {id: scope.workspaceId}, select: {name: true}}),
    prisma.environment.findUnique({where: {id: scope.environmentId}, select: {name: true, variables: true, secrets: true}}),
    prisma.monitorGroup.findMany({where: {workspaceId: scope.workspaceId}, select: {id: true, parentId: true, name: true, sortOrder: true}}),
  ])
  const exportEnvironment: ExportEnvironment = {
    name: environment?.name || 'default',
    variables: (environment?.variables || {}) as Record<string, string>,
    secretNames: Object.keys((environment?.secrets || {}) as Record<string, string>),
  }

  let rootGroupId: number | null = null, collectionName = workspace?.name || 'SealWatch'
  const where: Record<string, unknown> = {workspaceId: scope.workspaceId, environmentId: scope.environmentId}
  if (ids) where.id = {in: ids}
  if (parsed.data.groupId) {
    const group = await findGroup(prisma, scope.workspaceId, parsed.data.groupId)
    rootGroupId = group.id
    collectionName = group.name
    where.groupId = {in: await subtreeIds(prisma, scope.workspaceId, group.id)}
  }
  const monitors = await prisma.monitor.findMany({where, orderBy: {id: 'asc'}, take: MAX_MONITORS + 1})
  if (ids && monitors.length !== ids.length) throw createError({statusCode: 404, message: 'Monitor not found'})
  if (monitors.length > MAX_MONITORS) throw createError({statusCode: 400, message: `Export at most ${MAX_MONITORS} monitors at a time`})
  if (!monitors.length) throw createError({statusCode: 400, message: 'Nothing to export in this environment'})

  if (ids?.length === 1) {
    try {
      const single = exportSingleRequest(monitors[0], exportEnvironment)
      setHeader(event, 'content-type', 'text/plain; charset=utf-8')
      setHeader(event, 'content-disposition', attachment(safeFileName(monitors[0]!.name, `monitor-${monitors[0]!.id}`) + '.bru'))
      setHeader(event, 'x-bruno-secret-names', single.secretNames.join(','))
      return single.content
    } catch (error) {
      if (error instanceof BrunoExportError) throw createError({statusCode: 400, message: 'This monitor cannot be expressed as a Bruno request', data: {code: error.code}})
      throw error
    }
  }

  const collection = buildBrunoCollection({collectionName, monitors, groups, rootGroupId, environment: exportEnvironment})
  if (!collection.exported) throw createError({statusCode: 400, message: 'None of the selected monitors can be expressed as Bruno requests', data: {skipped: collection.skipped}})
  const directory = safeFileName(collectionName, 'collection')
  const entries = collection.files.map(file => ({path: `${directory}/${file.path}`, content: file.content}))
  if (collection.skipped.length) {
    entries.push({path: `${directory}-skipped.json`, content: JSON.stringify({note: 'These monitors could not be expressed as Bruno requests and were left out.', skipped: collection.skipped}, null, 2) + '\n'})
  }
  setHeader(event, 'content-type', 'application/zip')
  setHeader(event, 'content-disposition', attachment(`${directory}.zip`))
  setHeader(event, 'x-bruno-exported', String(collection.exported))
  setHeader(event, 'x-bruno-skipped', String(collection.skipped.length))
  return createZip(entries)
})
