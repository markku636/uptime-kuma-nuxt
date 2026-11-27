/**
 * Build a copy-paste iframe snippet for a public status page embed.
 * Slugs and origins are constrained to safe characters so the snippet can be
 * rendered as text in the editor without becoming an injection vector.
 */
export function buildStatusEmbedSnippet(origin: string, slug: string, title?: string): string {
  const safeOrigin = /^https?:\/\/[^\s"'<>]+$/.test(origin) ? origin.replace(/\/$/, '') : ''
  const safeSlug = /^[a-z0-9-]{1,100}$/.test(slug) ? slug : ''
  if (!safeOrigin || !safeSlug) return ''
  const label = String(title || 'Status').replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'Status'
  return `<iframe src="${safeOrigin}/status/${safeSlug}/embed" title="${label} status" width="100%" height="320" style="border:0;border-radius:8px" loading="lazy"></iframe>`
}
