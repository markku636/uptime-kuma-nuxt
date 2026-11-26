// server/services/monitor/checkers/visual-layout-rules.ts
// 純函式：吃瀏覽器量到的版面事實，回可解釋的失敗規則。不碰 DB／Playwright。
import type { VisualConfig } from '../../../../shared/types/visual-config'

export interface RequiredSelectorObservation {
  selector: string
  count: number
  visibleCount: number
  maxWidth: number
  maxHeight: number
}

export interface LayoutObservation {
  httpStatus: number
  viewportWidth: number
  documentScrollWidth: number
  required: RequiredSelectorObservation[]
  brokenImages: string[]
  pageErrors: string[]
}

export type LayoutRule =
  | 'http_status'
  | 'horizontal_overflow'
  | 'required_missing'
  | 'required_hidden'
  | 'required_too_small'
  | 'broken_images'
  | 'page_error'

export interface LayoutRuleFailure {
  rule: LayoutRule
  detail: string
}

export function evaluateLayoutRules(
  observation: LayoutObservation,
  config: VisualConfig,
): LayoutRuleFailure[] {
  const failures: LayoutRuleFailure[] = []

  if (observation.httpStatus >= 400) {
    failures.push({ rule: 'http_status', detail: `HTTP ${observation.httpStatus}` })
  }

  const overflow = observation.documentScrollWidth - observation.viewportWidth
  if (overflow > config.maxHorizontalOverflowPx) {
    failures.push({
      rule: 'horizontal_overflow',
      detail: `水平溢出 ${overflow}px（上限 ${config.maxHorizontalOverflowPx}px）`,
    })
  }

  for (const expected of config.requiredSelectors) {
    const seen = observation.required.find((item) => item.selector === expected.selector)
    const count = seen?.count ?? 0
    if (count < expected.minCount) {
      failures.push({
        rule: 'required_missing',
        detail: `${expected.selector} 只有 ${count} 個（需要 ${expected.minCount}）`,
      })
      continue
    }
    const visibleCount = seen?.visibleCount ?? 0
    if (visibleCount < expected.minCount) {
      failures.push({
        rule: 'required_hidden',
        detail: `${expected.selector} 只有 ${visibleCount} 個可見（需要 ${expected.minCount}）`,
      })
    }
    if (expected.minWidth != null && (seen?.maxWidth ?? 0) < expected.minWidth) {
      failures.push({
        rule: 'required_too_small',
        detail: `${expected.selector} 寬度 ${seen?.maxWidth ?? 0}px（至少 ${expected.minWidth}px）`,
      })
    }
    if (expected.minHeight != null && (seen?.maxHeight ?? 0) < expected.minHeight) {
      failures.push({
        rule: 'required_too_small',
        detail: `${expected.selector} 高度 ${seen?.maxHeight ?? 0}px（至少 ${expected.minHeight}px）`,
      })
    }
  }

  if (config.detectBrokenImages && observation.brokenImages.length > 0) {
    failures.push({
      rule: 'broken_images',
      detail: `破圖 ${observation.brokenImages.length} 張：${observation.brokenImages.slice(0, 3).join('、')}`,
    })
  }

  if (observation.pageErrors.length > 0) {
    failures.push({
      rule: 'page_error',
      detail: `JS 錯誤 ${observation.pageErrors.length} 個：${observation.pageErrors.slice(0, 3).join('、')}`,
    })
  }

  return failures
}

export function layoutFailureMessage(failures: LayoutRuleFailure[]): string {
  return failures.map((failure) => `${failure.rule}: ${failure.detail}`).join('；')
}
