// utils/browser-flow-editor.ts — 把 Browser flows 表單轉成 monitor payload 的純函式。
// 抽出來是為了能被 unit test 直接驗證，避免 UI 再次漏掉 value 或其他欄位。

export interface BrowserFlowEditorStep {
  action: string
  selector: string
  value: string
  timeoutMs: number | null
}

export interface BrowserFlowEditorInput {
  name: string
  url: string
  steps: BrowserFlowEditorStep[]
  interval: number
  viewport?: { width: number; height: number }
  waitTimeoutMs?: number
  ignoreTls?: boolean
}

export const BROWSER_FLOW_ACTIONS = [
  'goto', 'click', 'fill', 'selectOption', 'check', 'uncheck', 'waitFor',
  'assertVisible', 'assertText', 'assertValue', 'assertChecked', 'assertCount',
] as const

const VALUE_ACTIONS = new Set<string>(['goto', 'fill', 'selectOption', 'assertText', 'assertValue', 'assertCount'])
const REQUIRED_VALUE_ACTIONS = new Set<string>(['fill', 'selectOption', 'assertText', 'assertValue', 'assertCount'])

export interface CleanStep {
  action: string
  selector?: string
  value?: string
  timeoutMs?: number
}

/** 回傳乾淨步驟，非法設定直接丟出可讀訊息（不靜默丟欄位）。 */
export function cleanBrowserFlowSteps(steps: BrowserFlowEditorStep[]): CleanStep[] {
  if (!steps.length) throw new Error('至少需要一个步骤')
  if (steps.length > 20) throw new Error('最多 20 个步骤')
  return steps.map((step, index) => {
    const n = index + 1
    if (!(BROWSER_FLOW_ACTIONS as readonly string[]).includes(step.action)) throw new Error(`Step ${n}: unsupported action`)
    const clean: CleanStep = { action: step.action }
    if (step.action === 'goto') {
      if (step.selector?.trim()) throw new Error(`Step ${n}: goto 不使用 selector`)
      const target = (step.value || '').trim()
      if (target) {
        let parsed: URL
        try { parsed = new URL(target) } catch { throw new Error(`Step ${n}: goto URL invalid`) }
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Step ${n}: goto URL must be http/https`)
        clean.value = target
      }
    } else {
      const selector = (step.selector || '').trim()
      if (!selector) throw new Error(`Step ${n}: selector is required`)
      if (selector.length > 512) throw new Error(`Step ${n}: selector too long`)
      clean.selector = selector
      if (REQUIRED_VALUE_ACTIONS.has(step.action)) {
        if (step.value === undefined || step.value === '') throw new Error(`Step ${n}: value is required`)
        if (step.value.length > 4096) throw new Error(`Step ${n}: value too long`)
        if (step.action === 'assertCount' && !/^\d{1,5}$/.test(step.value)) throw new Error(`Step ${n}: count must be a non-negative integer`)
        clean.value = step.value
      } else if (VALUE_ACTIONS.has(step.action) && step.value) {
        clean.value = step.value
      }
    }
    if (step.timeoutMs !== null && step.timeoutMs !== undefined) {
      const timeout = Number(step.timeoutMs)
      if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 30000) throw new Error(`Step ${n}: timeout must be 1–30000 ms`)
      clean.timeoutMs = timeout
    }
    return clean
  })
}

export function buildBrowserFlowPayload(input: BrowserFlowEditorInput): Record<string, unknown> {
  const name = input.name.trim()
  const url = input.url.trim()
  if (!name) throw new Error('Flow name is required')
  if (!url) throw new Error('Start URL is required')
  let parsed: URL
  try { parsed = new URL(url) } catch { throw new Error('Start URL invalid') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Start URL must be http/https')
  const interval = Number(input.interval)
  if (![60, 300, 900, 3600].includes(interval)) throw new Error('Invalid run interval')

  const steps = cleanBrowserFlowSteps(input.steps)
  return {
    name, type: 'browser-flow', url,
    body: JSON.stringify({
      startUrl: url, steps,
      viewport: input.viewport || { width: 1280, height: 800 },
      waitTimeoutMs: input.waitTimeoutMs || 8000,
      ignoreTls: input.ignoreTls || false,
    }),
    interval, timeout: 30, method: 'GET', active: true,
  }
}
