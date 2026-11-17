// server/services/monitor/checkers/real-browser-checker.ts
// Load the page in Chromium (Playwright): through the monitor's remote
// browser (a Chrome DevTools endpoint such as browserless or
// `chrome --remote-debugging-port`) or a local headless Chromium.
// Every check keeps a screenshot of the page (see ../screenshots).
import type { CheckResult } from '../checker'
import { prisma } from '../../../utils/prisma'
import { isStatusAccepted } from '../status-codes'
import { saveScreenshot } from '../screenshots'

let chromiumPromise: Promise<any> | null = null
let localBrowser: any = null
/** The executable the shared browser was started with ('' = Playwright's own) */
let localBrowserPath = ''

async function chromium() {
  // playwright is optional at run time (it is large); load it on first use
  chromiumPromise ??= import('playwright').then((mod: any) => mod.chromium ?? mod.default?.chromium)
  const c = await chromiumPromise
  if (!c) throw new Error('Playwright is not available')
  return c
}

/** Settings > General > Chrome executable (empty: Playwright's own Chromium) */
async function chromePath(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: 'chromePath' } }).catch(() => null)
  return (row?.value ?? '').trim()
}

/** Shared local headless Chromium; restarted when the configured path changes */
async function getLocalBrowser() {
  const path = await chromePath()
  if (localBrowser?.isConnected() && path === localBrowserPath) return localBrowser
  if (localBrowser) await localBrowser.close().catch(() => {})
  const c = await chromium()
  try {
    localBrowser = await c.launch({ headless: true, ...(path ? { executablePath: path } : {}) })
    localBrowserPath = path
  } catch (error: any) {
    localBrowser = null
    const reason = String(error?.message || error).split('\n')[0]
    throw new Error(path
      ? `Could not start Chrome at "${path}" (${reason}). Check Settings > General > Chrome executable`
      : `No local Chromium (${reason}). Set the Chrome executable in Settings > General, add a remote browser, or run "npx playwright install chromium"`)
  }
  return localBrowser
}

export async function closeBrowser() {
  if (localBrowser) {
    await localBrowser.close().catch(() => {})
    localBrowser = null
  }
}

/** Fold a keyword result into the check (uptime-kuma semantics) */
function keywordOutcome(content: string, keyword: string, invert: boolean): { ok: boolean; msg: string } {
  const found = content.includes(keyword)
  const shown = keyword.length > 50 ? `"${keyword.slice(0, 47)}..."` : `"${keyword}"`
  if (invert) return { ok: !found, msg: found ? `Keyword ${shown} found, but should be absent` : `keyword ${shown} absent` }
  return { ok: found, msg: found ? `keyword ${shown} found` : `Keyword ${shown} not found` }
}

export async function checkRealBrowser(monitor: any, startTime: number): Promise<CheckResult> {
  if (!monitor.url) return { status: 0, ping: 0, msg: 'URL is required for real browser monitoring' }
  const timeout = (monitor.timeout || 48) * 1000

  let remote: any = null
  let context: any = null
  try {
    let browser: any
    if (monitor.remoteBrowserId) {
      const row = await prisma.remoteBrowser.findFirst({ where: { id: monitor.remoteBrowserId, userId: monitor.userId } })
      if (!row) return { status: 0, ping: 0, msg: 'Remote browser not found' }
      if (!row.active) return { status: 0, ping: 0, msg: `Remote browser "${row.name}" is disabled` }
      remote = await (await chromium()).connectOverCDP(row.url, { timeout })
      browser = remote
    } else {
      browser = await getLocalBrowser()
    }

    context = await browser.newContext({ ignoreHTTPSErrors: !!monitor.ignoreTls })
    const page = await context.newPage()
    page.setDefaultTimeout(timeout)
    const response = await page.goto(monitor.url, { waitUntil: 'networkidle', timeout })
    const ping = Date.now() - startTime

    // Keep what the page looked like, whatever the outcome
    try {
      saveScreenshot(monitor.id, await page.screenshot({ type: 'png', fullPage: false }))
    } catch { /* a screenshot is a bonus */ }

    if (!response) return { status: monitor.upsideDown ? 1 : 0, ping, msg: 'No response from page' }

    const code = response.status()
    let up = isStatusAccepted(code, monitor.acceptedStatuscodes)
    let msg = `HTTP ${code}`
    if (up && monitor.keyword) {
      const outcome = keywordOutcome(await page.content(), monitor.keyword, !!monitor.invertKeyword)
      up = outcome.ok
      msg = outcome.ok ? `${msg}, ${outcome.msg}` : outcome.msg
    }
    if (monitor.upsideDown) up = !up
    return { status: up ? 1 : 0, ping, msg }
  } catch (error: any) {
    const ping = Date.now() - startTime
    return { status: monitor.upsideDown ? 1 : 0, ping, msg: String(error?.message || 'Real browser check failed').split('\n')[0] }
  } finally {
    // Always release the page's context; a remote connection is per check
    if (context) await context.close().catch(() => {})
    if (remote) await remote.close().catch(() => {})
  }
}
