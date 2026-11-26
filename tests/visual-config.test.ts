import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_VISUAL_CONFIG,
  normalizeVisualConfig,
  visualConfigSchema,
} from '../server/utils/visual-config'
import { createMonitorSchema } from '../server/utils/monitor-input'

const minimal = { viewports: [{ label: 'desktop', width: 1440, height: 900 }] }

test('只給 viewports 時補上安全的預設值', () => {
  const config = normalizeVisualConfig(minimal)
  assert.equal(config.waitTimeoutMs, 5000)
  assert.equal(config.settleMs, 300)
  assert.equal(config.fullPage, true)
  assert.equal(config.maxHorizontalOverflowPx, 2)
  assert.equal(config.detectBrokenImages, true)
  assert.equal(config.diffThreshold, 0.02)
  assert.equal(config.baselineStrategy, 'manual')
  assert.deepEqual(config.requiredSelectors, [])
  assert.deepEqual(config.ignoreSelectors, [])
  assert.equal(config.maxDiffPixels, null)
})

test('requiredSelectors 的 minCount 有預設且尺寸可選', () => {
  const config = normalizeVisualConfig({
    ...minimal,
    requiredSelectors: [{ selector: 'header' }, { selector: 'main', minCount: 2, minWidth: 320 }],
  })
  assert.equal(config.requiredSelectors[0].minCount, 1)
  assert.equal(config.requiredSelectors[1].minCount, 2)
  assert.equal(config.requiredSelectors[1].minWidth, 320)
})

test('null/undefined 回深拷貝，改回傳值不會污染預設', () => {
  const a = normalizeVisualConfig(null)
  const b = normalizeVisualConfig(undefined)
  a.viewports[0].width = 1
  a.ignoreSelectors.push('changed')
  assert.notEqual(a, b)
  assert.notEqual(a.viewports, b.viewports)
  assert.equal(b.viewports[0].width, DEFAULT_VISUAL_CONFIG.viewports[0].width)
  assert.deepEqual(b.ignoreSelectors, [])
})

test('拒絕不合法設定：重複 label、超界、過多 viewport、未知欄位', () => {
  const bad = [
    { viewports: [{ label: 'a', width: 1440, height: 900 }, { label: 'a', width: 375, height: 812 }] },
    { viewports: [{ label: 'a', width: 100, height: 900 }] },
    { viewports: Array.from({ length: 5 }, (_, i) => ({ label: `v${i}`, width: 800, height: 600 })) },
    { ...minimal, diffThreshhold: 0.5 },
    { ...minimal, baselineStrategy: 'always' },
    { ...minimal, diffThreshold: 1.5 },
  ]
  for (const input of bad) assert.equal(visualConfigSchema.safeParse(input).success, false, JSON.stringify(input))
})

test('createMonitorSchema 接受 visual-diff 設定並拒絕不合法設定', () => {
  const base = { name: 'dashboard 跑版', type: 'visual-diff', url: 'https://example.com/dashboard' }
  assert.equal(createMonitorSchema.safeParse({ ...base, visualConfig: minimal }).success, true)
  assert.equal(createMonitorSchema.safeParse({ ...base }).success, true)
  assert.equal(
    createMonitorSchema.safeParse({
      ...base,
      visualConfig: { ...minimal, diffThreshhold: 0.5 },
    }).success,
    false,
  )
  assert.equal(
    createMonitorSchema.safeParse({
      ...base,
      visualConfig: { viewports: [{ label: 'a', width: 10, height: 900 }] },
    }).success,
    false,
  )
})

test('合法的自訂設定會被保留', () => {
  const config = normalizeVisualConfig({
    viewports: [
      { label: 'desktop', width: 1920, height: 1080 },
      { label: 'mobile', width: 375, height: 812 },
    ],
    waitForSelector: '[data-ready="true"]',
    settleMs: 1000,
    fullPage: false,
    ignoreSelectors: ['.timestamp', '#ad'],
    diffThreshold: 0.01,
    maxDiffPixels: 500,
    baselineStrategy: 'auto',
  })
  assert.equal(config.viewports.length, 2)
  assert.equal(config.waitForSelector, '[data-ready="true"]')
  assert.equal(config.fullPage, false)
  assert.deepEqual(config.ignoreSelectors, ['.timestamp', '#ad'])
  assert.equal(config.maxDiffPixels, 500)
  assert.equal(config.baselineStrategy, 'auto')
})
