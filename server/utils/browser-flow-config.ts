// server/utils/browser-flow-config.ts — browser-flow 設定的驗證與預設值。
// 為避免動共用 prisma schema，流程設定存放在 monitor.body（JSON 字串）。
import { z } from 'zod'
import type { BrowserFlowConfig } from '../../shared/types/browser-flow'

const stepSchema = z.object({
  action: z.enum(['goto', 'click', 'fill', 'selectOption', 'check', 'uncheck', 'waitFor', 'assertVisible', 'assertText', 'assertValue', 'assertChecked', 'assertCount']),
  selector: z.string().min(1).max(512).optional(),
  value: z.string().max(4096).optional(),
  // 0 在 Playwright 代表「不逾時」，會讓 trial 永久佔住 slot，故禁止。
  timeoutMs: z.number().int().min(1).max(30000).optional(),
}).strict().superRefine((step, ctx) => {
  const needsSelector = step.action !== 'goto'
  if (needsSelector && !step.selector) ctx.addIssue({ code: 'custom', message: 'selector is required', path: ['selector'] })
  if (['fill', 'selectOption', 'assertText', 'assertValue', 'assertCount'].includes(step.action) && step.value === undefined) {
    ctx.addIssue({ code: 'custom', message: 'value is required', path: ['value'] })
  }
  if (step.action === 'goto' && step.selector) ctx.addIssue({ code: 'custom', message: 'goto 不使用 selector', path: ['selector'] })
})

export const browserFlowConfigSchema = z.object({
  startUrl: z.string().url().max(8192).optional(),
  steps: z.array(stepSchema).min(1).max(20),
  viewport: z.object({ width: z.number().int().min(320).max(3840), height: z.number().int().min(400).max(4320) }).strict().default({ width: 1440, height: 900 }),
  waitTimeoutMs: z.number().int().min(100).max(30000).default(5000),
  ignoreTls: z.boolean().default(false),
}).strict()

export const DEFAULT_BROWSER_FLOW_CONFIG: BrowserFlowConfig = {
  startUrl: undefined,
  steps: [{ action: 'goto' }],
  viewport: { width: 1440, height: 900 },
  waitTimeoutMs: 5000,
  ignoreTls: false,
}

/** monitor.body 可能是 undefined／JSON 字串／物件；未知欄位與非法動作一律拒絕。 */
export function parseBrowserFlowConfig(raw: unknown): BrowserFlowConfig {
  if (raw === undefined || raw === null || raw === '') return structuredClone(DEFAULT_BROWSER_FLOW_CONFIG)
  let value: unknown = raw
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { throw new Error('Browser flow config must be valid JSON') }
  }
  return browserFlowConfigSchema.parse(value) as BrowserFlowConfig
}
