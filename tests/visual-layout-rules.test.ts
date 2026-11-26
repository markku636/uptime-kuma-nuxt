import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeVisualConfig } from '../server/utils/visual-config'
import {
  evaluateLayoutRules,
  layoutFailureMessage,
  type LayoutObservation,
} from '../server/services/monitor/checkers/visual-layout-rules'

const config = normalizeVisualConfig({ viewports: [{ label: 'desktop', width: 1440, height: 900 }] })
const healthy: LayoutObservation = {
  httpStatus: 200,
  viewportWidth: 1440,
  documentScrollWidth: 1440,
  required: [],
  brokenImages: [],
  pageErrors: [],
}

test('正常頁面沒有任何規則失敗', () => {
  assert.deepEqual(evaluateLayoutRules(healthy, config), [])
})

test('HTTP 4xx/5xx 與水平溢出各自被抓到', () => {
  const failures = evaluateLayoutRules(
    { ...healthy, httpStatus: 503, documentScrollWidth: 1460 },
    config,
  )
  assert.deepEqual(failures.map((failure) => failure.rule), ['http_status', 'horizontal_overflow'])
  assert.match(layoutFailureMessage(failures), /HTTP 503/)
  assert.match(layoutFailureMessage(failures), /水平溢出 20px/)
})

test('必要元素消失、隱藏或過小都算跑版', () => {
  const withSelectors = normalizeVisualConfig({
    viewports: [{ label: 'desktop', width: 1440, height: 900 }],
    requiredSelectors: [
      { selector: 'header', minCount: 1, minWidth: 200, minHeight: 24 },
      { selector: 'main', minCount: 2 },
    ],
  })
  const failures = evaluateLayoutRules(
    {
      ...healthy,
      required: [
        { selector: 'header', count: 1, visibleCount: 0, maxWidth: 100, maxHeight: 10 },
        { selector: 'main', count: 1, visibleCount: 1, maxWidth: 800, maxHeight: 600 },
      ],
    },
    withSelectors,
  )
  assert.ok(failures.some((failure) => failure.rule === 'required_hidden'))
  assert.ok(failures.some((failure) => failure.rule === 'required_too_small'))
  assert.ok(failures.some((failure) => failure.rule === 'required_missing'))
})

test('完全找不到必要元素時只報 missing，不重複報 hidden', () => {
  const withSelectors = normalizeVisualConfig({
    viewports: [{ label: 'desktop', width: 1440, height: 900 }],
    requiredSelectors: [{ selector: '#hero', minCount: 1 }],
  })
  const failures = evaluateLayoutRules({ ...healthy, required: [] }, withSelectors)
  assert.deepEqual(failures.map((failure) => failure.rule), ['required_missing'])
})

test('破圖可關閉；JS 錯誤一律算跑版', () => {
  const observation = {
    ...healthy,
    brokenImages: ['/logo.png'],
    pageErrors: ['TypeError: undefined is not a function'],
  }
  assert.deepEqual(evaluateLayoutRules(observation, config).map((f) => f.rule), [
    'broken_images',
    'page_error',
  ])
  const ignoreBroken = normalizeVisualConfig({
    viewports: [{ label: 'desktop', width: 1440, height: 900 }],
    detectBrokenImages: false,
  })
  assert.deepEqual(evaluateLayoutRules(observation, ignoreBroken).map((f) => f.rule), ['page_error'])
})
