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
  'assertUrl', 'assertTitle', 'assertHidden', 'press', 'waitForTimeout',
] as const

const VALUE_ACTIONS = new Set<string>([
  'goto', 'fill', 'selectOption', 'assertText', 'assertValue', 'assertCount',
  'assertUrl', 'assertTitle', 'press', 'waitForTimeout',
])
const REQUIRED_VALUE_ACTIONS = new Set<string>([
  'fill', 'selectOption', 'assertText', 'assertValue', 'assertCount',
  'assertUrl', 'assertTitle', 'press', 'waitForTimeout',
])
const SELECTOR_OPTIONAL = new Set<string>(['goto', 'assertUrl', 'assertTitle', 'press', 'waitForTimeout'])

export const usesValue = (action: string): boolean => VALUE_ACTIONS.has(action)
export const usesSelector = (action: string): boolean => !SELECTOR_OPTIONAL.has(action)

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
    const rawSelector = (step.selector || '').trim()
    if (!SELECTOR_OPTIONAL.has(step.action)) {
      if (!rawSelector) throw new Error(`Step ${n}: selector is required`)
      if (rawSelector.length > 512) throw new Error(`Step ${n}: selector too long`)
      clean.selector = rawSelector
    } else if (step.action === 'press' && rawSelector) {
      // press 可以只對某個元素送按鍵；其他動作的 selector 是切換 action 後的殘值，忽略即可。
      if (rawSelector.length > 512) throw new Error(`Step ${n}: selector too long`)
      clean.selector = rawSelector
    }

    const value = step.value ?? ''
    if (REQUIRED_VALUE_ACTIONS.has(step.action) && !value) throw new Error(`Step ${n}: value is required`)
    if (value && value.length > 4096) throw new Error(`Step ${n}: value too long`)
    if (['goto', 'assertUrl'].includes(step.action) && value) {
      let parsed: URL
      try { parsed = new URL(value) } catch { throw new Error(`Step ${n}: ${step.action} URL invalid`) }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Step ${n}: ${step.action} URL must be http/https`)
    }
    if (step.action === 'assertCount' && value && !/^\d{1,5}$/.test(value)) throw new Error(`Step ${n}: count must be a non-negative integer`)
    if (step.action === 'waitForTimeout' && value && (!/^\d{1,5}$/.test(value) || Number(value) > 30000)) throw new Error(`Step ${n}: wait must be 0–30000 ms`)
    if (step.action === 'press' && value.length > 100) throw new Error(`Step ${n}: key too long`)
    if (VALUE_ACTIONS.has(step.action) && value) clean.value = value
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
