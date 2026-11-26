// shared/types/visual-config.ts — client/server 共用的 visual-diff 設定型別

export interface VisualViewport {
  label: string
  width: number
  height: number
}

export interface VisualRequiredSelector {
  selector: string
  minCount: number
  minWidth?: number
  minHeight?: number
}

export interface VisualConfig {
  viewports: VisualViewport[]
  waitForSelector?: string | null
  waitTimeoutMs: number
  settleMs: number
  fullPage: boolean
  requiredSelectors: VisualRequiredSelector[]
  maxHorizontalOverflowPx: number
  detectBrokenImages: boolean
  ignoreSelectors: string[]
  diffThreshold: number
  maxDiffPixels?: number | null
  baselineStrategy: 'manual' | 'auto'
}
