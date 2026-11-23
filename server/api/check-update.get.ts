import { APP_VERSION } from '../utils/version'

const RELEASE_URL = 'https://api.github.com/repos/markku636/uptime-kuma-nuxt/releases/latest'
const RELEASES_URL = 'https://api.github.com/repos/markku636/uptime-kuma-nuxt/releases?per_page=10'

function numericParts(version: string) {
  return version.replace(/^v/i, '').split(/[.-]/).map(part => Number.parseInt(part, 10)).filter(Number.isFinite)
}

function isNewer(candidate: string, current: string) {
  const a = numericParts(candidate)
  const b = numericParts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i] ?? 0
    const right = b[i] ?? 0
    if (left > right) return true
    if (left < right) return false
  }
  return false
}

export default defineEventHandler(async (event) => {
  await requireRequestSession(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  try {
    const beta = getQuery(event).beta === 'true' || getQuery(event).beta === '1'
    const response = await fetch(beta ? RELEASES_URL : RELEASE_URL, {
      headers: { accept: 'application/vnd.github+json', 'user-agent': 'uptime-kuma-nuxt' },
      signal: AbortSignal.timeout(5000),
    })
    if (!response.ok) throw new Error(`GitHub responded ${response.status}`)
    const payload = await response.json() as any
    const releases: any[] = Array.isArray(payload) ? payload : [payload]
    const release: { tag_name?: string; html_url?: string; prerelease?: boolean } =
      (beta ? releases.find(item => item && typeof item.tag_name === 'string') : releases.find(item => item && !item.prerelease))
      || releases[0]
      || {}
    const tag = typeof release.tag_name === 'string' && /^v?\d{1,5}[0-9A-Za-z.-]{0,40}$/.test(release.tag_name)
      ? release.tag_name
      : null
    return {
      latestVersion: tag,
      currentVersion: APP_VERSION,
      hasUpdate: !!tag && isNewer(tag, APP_VERSION),
      prerelease: !!release.prerelease,
      url: typeof release.html_url === 'string' && release.html_url.startsWith('https://github.com/') ? release.html_url : null,
    }
  } catch {
    // Update checks are best-effort; a blocked network must not break the About page.
    return { latestVersion: null, currentVersion: APP_VERSION, hasUpdate: false, url: null, error: 'UNAVAILABLE' }
  }
})
