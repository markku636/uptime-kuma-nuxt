// server/api/v1/settings/import.post.ts
// Retired: this older importer created rows without an owner, so every
// non-empty import failed and was rolled back. Backups are exported and
// restored with Settings > Backup (GET /api/v1/backup/export,
// POST /api/v1/backup/import).
export default defineEventHandler(() => {
  throw createError({
    statusCode: 410,
    message: 'This import is no longer available: use Settings > Backup (/api/v1/backup/export and /api/v1/backup/import)',
  })
})
