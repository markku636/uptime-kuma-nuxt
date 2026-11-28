// 合成瀏覽器流程（Checkly Browser Check 風格的宣告式子集）。
// 不執行任意 JS：只允許固定 action 列表，selector/value 有長度上限。
import { chromium } from 'playwright'
import { Prisma } from '@prisma/client'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { CheckResult } from '../checker'
import { workerPrisma } from '../../../utils/worker-prisma'
import { isForbiddenAddress, HttpCheckError } from './http-request'
import { parseBrowserFlowConfig } from '../../../utils/browser-flow-config'
import type { BrowserFlowConfig, BrowserFlowStep } from '../../../../shared/types/browser-flow'

export interface FlowStepResult {
  index: number
  action: string
  status: 'pass' | 'fail' | 'skip'
  elapsedMs: number
  detail?: string
}

export interface FlowFailureArtifact {
  monitorId: number
  viewportLabel: string
  status: number
  currentImage: Buffer
  metrics: Record<string, unknown>
}
export interface BrowserFlowDeps {
  launch: () => Promise<any>
  parse: (raw: unknown) => BrowserFlowConfig
  /** 每次導向／請求都要重新驗證，不能用起點的一次解析代替。 */
  resolve?: (url: URL) => Promise<unknown>
  saveFailure?: (artifact: FlowFailureArtifact) => Promise<void>
  saveTrace?: (monitorId: number, metrics: Record<string, unknown>) => Promise<void>
}

const METADATA_HOSTS = new Set(['metadata.google.internal', 'metadata.google', 'instance-data.ec2.internal', 'metadata.azure.internal'])

/** 強制 deny RFC1918／loopback／metadata；與 HTTP checker 的寬鬆預設不同。 */
export async function assertPublicUrl(raw: string): Promise<void> {
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol) || url.href.length > 8192 || url.username || url.password) {
    throw new HttpCheckError('DESTINATION_DENIED')
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  if (!host || METADATA_HOSTS.has(host)) throw new HttpCheckError('DESTINATION_DENIED')
  const family = isIP(host)
  const addresses = family ? [{ address: host, family }] : await lookup(host, { all: true })
  if (!addresses.length || addresses.some(({ address }) => isForbiddenAddress(address, false))) {
    throw new HttpCheckError('DESTINATION_DENIED')
  }
}
const strictResolve = async (url: URL): Promise<void> => { await assertPublicUrl(url.href) }

const defaultSaveFailure: NonNullable<BrowserFlowDeps['saveFailure']> = async artifact => {
  // 只保留最近一張失敗截圖，避免每次檢查都新增一列。
  await workerPrisma.visualCheckArtifact.deleteMany({ where: { monitorId: artifact.monitorId, viewportLabel: artifact.viewportLabel } })
  await workerPrisma.visualCheckArtifact.create({ data: {
    monitorId: artifact.monitorId, viewportLabel: artifact.viewportLabel, status: artifact.status,
    currentImage: new Uint8Array(artifact.currentImage), diffImage: null,
    metrics: artifact.metrics as Prisma.InputJsonValue,
  } })
}

async function launchBrowser(): Promise<any> {
  try { return await chromium.launch({ headless: true }) } catch (bundled) {
    try { return await chromium.launch({ headless: true, channel: 'chrome' }) } catch (chrome) {
      // 保留兩次失敗原因：artifact 模式可能缺少 bundled browser 的系統函式庫。
      const text = (error: any) => String(error?.message || error).slice(-1500)
      throw new Error(`bundled=${text(bundled)}; chrome=${text(chrome)}`)
    }
  }
}
const defaultSaveTrace: NonNullable<BrowserFlowDeps['saveTrace']> = async (monitorId, metrics) => {
  await workerPrisma.visualCheckArtifact.deleteMany({ where: { monitorId, viewportLabel: 'flow-trace' } })
  await workerPrisma.visualCheckArtifact.create({ data: {
    monitorId, viewportLabel: 'flow-trace', status: 1, currentImage: null, diffImage: null,
    metrics: metrics as Prisma.InputJsonValue,
  } })
}

export const defaultDeps: BrowserFlowDeps = {
  launch: launchBrowser, parse: parseBrowserFlowConfig, resolve: strictResolve,
  saveFailure: defaultSaveFailure, saveTrace: defaultSaveTrace,
}

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
      await resolve(url)
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
    case 'selectOption':
      await page.selectOption(step.selector!, step.value ?? '', { timeout })
      return undefined
    case 'check':
      await page.check(step.selector!, { timeout })
      return undefined
    case 'uncheck':
      await page.uncheck(step.selector!, { timeout })
      return undefined
    case 'assertChecked': {
      const checked = await page.locator(step.selector!).first().isChecked({ timeout })
      if (!checked) return 'NOT_CHECKED'
      return undefined
    }
    case 'assertCount': {
      const expected = Number(step.value)
      if (!Number.isSafeInteger(expected) || expected < 0) return 'INVALID_COUNT'
      const actual = await page.locator(step.selector!).count()
      if (actual !== expected) return `COUNT_MISMATCH:${actual}`
      return undefined
    }
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
    case 'assertUrl': {
      const current = typeof page.url === 'function' ? page.url() : ''
      if (!current || !current.includes(step.value || '')) return 'URL_MISMATCH'
      return undefined
    }
    case 'assertTitle': {
      const title = typeof page.title === 'function' ? await page.title() : ''
      if (!title.includes(step.value || '')) return 'TITLE_MISMATCH'
      return undefined
    }
    case 'assertHidden': {
      const locator = page.locator(step.selector!).first()
      if (await locator.count() > 0 && await locator.isVisible()) return 'ELEMENT_VISIBLE'
      return undefined
    }
    case 'press': {
      if (step.selector) await page.locator(step.selector).first().press(step.value!, { timeout })
      else await page.keyboard.press(step.value!)
      return undefined
    }
    case 'waitForTimeout': {
      const ms = Number(step.value)
      if (!Number.isSafeInteger(ms) || ms < 0 || ms > 30000) return 'INVALID_WAIT'
      await page.waitForTimeout(ms)
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
  const startUrl = config.startUrl || monitor.url
  try {
    if (!startUrl) return failure(startTime, 'CONFIG_ERROR', 'URL is required for browser-flow monitors')
    await (deps.resolve || strictResolve)(new URL(startUrl))
  } catch (error: any) {
    const code = error instanceof HttpCheckError ? error.code : 'CONFIG_ERROR'
    return failure(startTime, code, `Invalid or denied monitor URL (${code})`)
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
    // 每次請求（含 redirect、click 後的導向、子資源）都重新驗目的地，
    // 只驗起點會被 302→內網／metadata 或被 click 導向繞過。
    const guard = deps.resolve || strictResolve
    if (typeof page.route === 'function') {
      await page.route('**/*', async (route: any) => {
        try { await guard(new URL(route.request().url())); await route.continue() }
        catch { await route.abort('blockedbyclient') }
      })
    }
    const abortPage = () => { void page.close().catch(() => {}) }
    signal?.addEventListener('abort', abortPage, { once: true })
    // 只有排程檢查留證據；trial 不寫 DB。截圖上限 2 MiB，失敗時不影響回傳結果。
    const persistFailure = async (code: string): Promise<void> => {
      if (monitor.includeTrialResponse || !monitor.id || !deps.saveFailure) return
      try {
        const image: Buffer = await page.screenshot({ type: 'png' })
        if (image.length > 2 * 1024 * 1024) return
        await deps.saveFailure({
          monitorId: monitor.id, viewportLabel: 'flow-fail', status: 0, currentImage: image,
          metrics: { code, flowSteps: steps, url: monitor.url, configVersion: monitor.configVersion ?? 1 },
        })
      } catch { /* 證據失敗不應讓檢查本身失敗 */ }
    }

    for (let index = 0; index < config.steps.length; index++) {
      if (signal?.aborted) return failure(startTime, 'ABORTED', 'Check aborted', steps)
      const step = config.steps[index]!
      const before = Date.now()
      try {
        const errorCode = await runStep(page, step, config, startUrl, guard)
        if (!errorCode && typeof page.url === 'function') await guard(new URL(page.url()))
        const elapsedMs = Date.now() - before
        if (errorCode) {
          steps.push({ index: index + 1, action: step.action, status: 'fail', elapsedMs, detail: errorCode })
          await persistFailure('FLOW_STEP_FAILED')
          return failure(startTime, 'FLOW_STEP_FAILED', `Step ${index + 1}/${config.steps.length} (${step.action}) failed: ${errorCode}`, steps)
        }
        steps.push({ index: index + 1, action: step.action, status: 'pass', elapsedMs })
      } catch (error: any) {
        const message = error instanceof HttpCheckError ? error.code : String(error?.message || error).slice(0, 160)
        steps.push({ index: index + 1, action: step.action, status: 'fail', elapsedMs: Date.now() - before, detail: message })
        await persistFailure('FLOW_STEP_FAILED')
        return failure(startTime, 'FLOW_STEP_FAILED', `Step ${index + 1}/${config.steps.length} (${step.action}) failed: ${message}`, steps)
      }
    }
    if (!monitor.includeTrialResponse && monitor.id && deps.saveTrace) {
      try { await deps.saveTrace(monitor.id, { code: 'FLOW_OK', flowSteps: steps, url: monitor.url, configVersion: monitor.configVersion ?? 1 }) } catch { /* trace 失敗不影響判定 */ }
    }
    return {
      status: 1, ping: Date.now() - startTime, code: 'FLOW_OK',
      msg: `Flow passed (${steps.length} steps)`, flowSteps: steps,
    }
  } catch (error: any) {
    return failure(startTime, 'FLOW_ERROR', String(error?.message || error).slice(0, 1600), steps)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
