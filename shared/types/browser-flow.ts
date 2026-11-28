// shared/types/browser-flow.ts — 合成瀏覽器流程（Checkly Browser Check 風格的宣告式子集）

export type BrowserFlowAction =
  | 'goto'
  | 'click'
  | 'fill'
  | 'waitFor'
  | 'assertVisible'
  | 'assertText'
  | 'assertValue'

export interface BrowserFlowStep {
  action: BrowserFlowAction
  selector?: string
  value?: string
  timeoutMs?: number
}

export interface BrowserFlowConfig {
  startUrl?: string
  steps: BrowserFlowStep[]
  viewport: { width: number; height: number }
  waitTimeoutMs: number
  ignoreTls: boolean
}
