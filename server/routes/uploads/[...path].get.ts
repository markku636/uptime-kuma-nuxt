// server/routes/uploads/[...path].get.ts
// Files uploaded at run time (status page logos) live in public/uploads.
// A production build only serves what was in public/ at build time, so they
// are served here (images only, never outside the uploads folder).
import { readFile, stat } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

const UPLOAD_ROOT = resolve(process.cwd(), 'public', 'uploads')
const TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

export default defineEventHandler(async (event) => {
  const rel = decodeURIComponent(getRouterParam(event, 'path') || '')
  const file = resolve(join(UPLOAD_ROOT, rel))
  const type = TYPES[extname(file).toLowerCase()]
  if (!type || !file.startsWith(UPLOAD_ROOT + sep)) throw createError({ statusCode: 404, message: 'Not found' })
  try {
    const info = await stat(file)
    if (!info.isFile()) throw new Error('not a file')
    setResponseHeader(event, 'Content-Type', type)
    setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
    setResponseHeader(event, 'X-Content-Type-Options', 'nosniff')
    return await readFile(file)
  } catch {
    throw createError({ statusCode: 404, message: 'Not found' })
  }
})
