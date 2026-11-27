import { requireRequestSession } from './request-session'
import { requireWorkspace } from './workspace'

/**
 * Status-page incident/announcement writes mirror the public page's `canEdit`
 * gate: an interactive session with editor rights. Read-scoped API keys and
 * viewers must not be able to deface a published page.
 */
export async function requireStatusPageEditor(event: any) {
  const session = await requireRequestSession(event)
  if (!session?.user || event.context.authMethod !== 'session') {
    throw createError({ statusCode: 403, message: 'Editor session required' })
  }
  return requireWorkspace(event, 'editor')
}
