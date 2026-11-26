// server/utils/visual-config.ts — visual-diff monitor 設定的驗證與預設值
import { z } from 'zod'
import type { VisualConfig } from '../../shared/types/visual-config'

export const visualViewportSchema = z.object({
  label: z.string().min(1).max(32).regex(/^[A-Za-z0-9_-]+$/, 'Viewport label 只能用英數字、底線與連字號'),
  width: z.number().int().min(320).max(3840),
  height: z.number().int().min(400).max(4320),
}).strict()

export const visualRequiredSelectorSchema = z.object({
  selector: z.string().min(1).max(512),
  minCount: z.number().int().min(1).max(1000).default(1),
  minWidth: z.number().int().min(0).max(3840).optional(),
  minHeight: z.number().int().min(0).max(4320).optional(),
}).strict()

/**
 * 未知欄位一律拒絕：拼錯的設定（例如 diffThreshhold）不該被靜默忽略，
 * 否則使用者會以為自己設了閾值，實際上一直用預設值。
 */
export const visualConfigSchema = z.object({
  viewports: z.array(visualViewportSchema).min(1).max(4),
  waitForSelector: z.string().min(1).max(512).optional().nullable().default(null),
  waitTimeoutMs: z.number().int().min(0).max(60000).default(5000),
  settleMs: z.number().int().min(0).max(10000).default(300),
  fullPage: z.boolean().default(true),
  requiredSelectors: z.array(visualRequiredSelectorSchema).max(50).default([]),
  maxHorizontalOverflowPx: z.number().int().min(0).max(500).default(2),
  detectBrokenImages: z.boolean().default(true),
  ignoreSelectors: z.array(z.string().min(1).max(512)).max(50).default([]),
  diffThreshold: z.number().min(0).max(1).default(0.02),
  maxDiffPixels: z.number().int().min(0).max(100000000).optional().nullable().default(null),
  baselineStrategy: z.enum(['manual', 'auto']).default('manual'),
}).strict().refine(
  (config) => new Set(config.viewports.map((viewport) => viewport.label)).size === config.viewports.length,
  { message: 'Viewport label 不能重複', path: ['viewports'] },
)

export const DEFAULT_VISUAL_CONFIG: VisualConfig = {
  viewports: [
    { label: 'desktop', width: 1440, height: 900 },
    { label: 'mobile', width: 375, height: 812 },
  ],
  waitForSelector: null,
  waitTimeoutMs: 5000,
  settleMs: 300,
  fullPage: true,
  requiredSelectors: [],
  maxHorizontalOverflowPx: 2,
  detectBrokenImages: true,
  ignoreSelectors: [],
  diffThreshold: 0.02,
  maxDiffPixels: null,
  baselineStrategy: 'manual',
}

/** 舊 monitor 或表單未填時用預設值；回傳深拷貝，避免呼叫端改到共用預設。 */
export function normalizeVisualConfig(input: unknown): VisualConfig {
  if (input === undefined || input === null) return structuredClone(DEFAULT_VISUAL_CONFIG)
  return visualConfigSchema.parse(input) as VisualConfig
}
