// 合成瀏覽器流程（Checkly Browser Check 風格的宣告式子集）。
// 不執行任意 JS：只允許固定 action 列表，selector/value 有長度上限。
import { chromium } from 'playwright'
import type { CheckResult } from '../checker'
import { resolveDestination, HttpCheckError } from './http-request'
import { parseBrowserFlowConfig } from '../../../utils/browser-flow-config'
import type { BrowserFlowConfig, BrowserFlowStep } from '../../../../shared/types/browser-flow'

export interface FlowStepResult {
  index: number
  action: string
  status: 'pass' | 'fail' | 'skip'
  elapsedMs: number
  detail?: string
}

export interface BrowserFlowDeps {
  launch: () => Promise<any>
  parse: (raw: unknown) => BrowserFlowConfig
  resolve?: (url: URL, signal: AbortSignal) => Promise<unknown>
}

async function launchBrowser(): Promise<any> {
  try { return await chromium.launch({ headless: true }) } catch { return await chromium.launch({ headless: true, channel: 'chrome' }) }
}
const defaultDeps: BrowserFlowDeps = { launch: launchBrowser, parse: parseBrowserFlowConfig }

function failure(startTime: number, code: string, msg: string, flowSteps?: FlowStepResult[]): CheckResult {
  return { status: 0, ping: Date.now() - startTime, code, msg, ...(flowSteps ? { flowSteps } : {}) }
}

function stepTimeout(config: BrowserFlowConfig, step: BrowserFlowStep): number {
  return Math.min(config.waitTimeoutMs, step.timeoutMs ?? config.waitTimeoutMs)
}

async function runStep(page: any, step: BrowserFlowStep, config: BrowserFlowConfig, monitorUrl: string, resolve: NonNullable<BrowserFlowDeps['resolve']>): Promise<string | undefined> {
  const timeout = stepTimeout(config, step)
  switch (step.action) {
    case 'goto': {
      const target = step.value || monitorUrl
      let url: URL
      try { url = new URL(target) } catch { return 'INVALID_URL' }
      await resolve(url, AbortSignal.timeout(5000))
      const response = await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout })
      if (!response || response.status() >= 400) return `HTTP_${response?.status() ?? 0}`
      return undefined
    }
    case 'click':
      await page.click(step.selector!, { timeout })
      return undefined
    case 'fill':
      await page.fill(step.selector!, step.value ?? '', { timeout })
      return undefined
    case 'waitFor':
      await page.waitForSelector(step.selector!, { timeout, state: 'visible' })
      return undefined
    case 'assertVisible': {
      const locator = page.locator(step.selector!).first()
      if (await locator.count() === 0) return 'ELEMENT_NOT_FOUND'
      if (!await locator.isVisible()) return 'ELEMENT_HIDDEN'
      return undefined
    }
    case 'assertText': {
      const text = await page.locator(step.selector!).first().textContent({ timeout })
      if (!text || !text.includes(step.value ?? '')) return 'TEXT_MISMATCH'
      return undefined
    }
    case 'assertValue': {
      const value = await page.locator(step.selector!).first().inputValue({ timeout })
      if (value !== (step.value ?? '')) return 'VALUE_MISMATCH'
      return undefined
    }
    default:
      return 'UNSUPPORTED_ACTION'
  }
}

export async function checkBrowserFlow(
  monitor: any,
  startTime: number,
  signal?: AbortSignal,
  deps: BrowserFlowDeps = defaultDeps,
): Promise<CheckResult> {
  let config: BrowserFlowConfig
  try { config = deps.parse(monitor.body) } catch (error: any) {
    return failure(startTime, 'CONFIG_ERROR', `Browser flow config invalid: ${String(error?.message || error).slice(0, 200)}`)
  }
  try {
    if (!monitor.url) return failure(startTime, 'CONFIG_ERROR', 'URL is required for browser-flow monitors')
    new URL(monitor.url)
  } catch {
    return failure(startTime, 'CONFIG_ERROR', 'Invalid monitor URL')
  }

  const steps: FlowStepResult[] = []
  let browser: any = null
  try {
    browser = await deps.launch()
    const context = await browser.newContext({
      viewport: config.viewport,
      ignoreHTTPSErrors: config.ignoreTls || !!monitor.ignoreTls,
    })
    const page = await context.newPage()
    page.setDefaultTimeout(config.waitTimeoutMs)
    const abortPage = () => { void page.close().catch(() => {}) }
    signal?.addEventListener('abort', abortPage, { once: true })

    for (let index = 0; index < config.steps.length; index++) {
      if (signal?.aborted) return failure(startTime, 'ABORTED', 'Check aborted', steps)
      const step = config.steps[index]!
      const before = Date.now()
      try {
        const errorCode = await runStep(page, step, config, monitor.url, deps.resolve || resolveDestination)
        const elapsedMs = Date.now() - before
        if (errorCode) {
          steps.push({ index: index + 1, action: step.action, status: 'fail', elapsedMs, detail: errorCode })
          return failure(startTime, 'FLOW_STEP_FAILED', `Step ${index + 1}/${config.steps.length} (${step.action}) failed: ${errorCode}`, steps)
        }
        steps.push({ index: index + 1, action: step.action, status: 'pass', elapsedMs })
      } catch (error: any) {
        const message = error instanceof HttpCheckError ? error.code : String(error?.message || error).slice(0, 160)
        steps.push({ index: index + 1, action: step.action, status: 'fail', elapsedMs: Date.now() - before, detail: message })
        return failure(startTime, 'FLOW_STEP_FAILED', `Step ${index + 1}/${config.steps.length} (${step.action}) failed: ${message}`, steps)
      }
    }
    return {
      status: 1, ping: Date.now() - startTime, code: 'FLOW_OK',
      msg: `Flow passed (${steps.length} steps)`, flowSteps: steps,
    }
  } catch (error: any) {
    return failure(startTime, 'FLOW_ERROR', String(error?.message || error).slice(0, 200), steps)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
