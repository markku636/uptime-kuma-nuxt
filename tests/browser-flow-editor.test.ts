import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildBrowserFlowPayload, cleanBrowserFlowSteps, type BrowserFlowEditorStep } from '../utils/browser-flow-editor'
import { parseBrowserFlowConfig } from '../server/utils/browser-flow-config'

function step(action: string, extra: Partial<BrowserFlowEditorStep> = {}): BrowserFlowEditorStep {
  return { action, selector: '', value: '', timeoutMs: null, ...extra }
}

function input(steps: BrowserFlowEditorStep[]) {
  return { name: 'Journey', url: 'https://example.com', steps, interval: 3600 }
}

test('selectOption / assertCount / goto 的 value 不再被靜默丟掉', () => {
  const steps = [
    step('goto', { value: 'https://example.com/login' }),
    step('selectOption', { selector: 'select#lang', value: 'tw' }),
    step('assertCount', { selector: '.item', value: '3' }),
    step('assertText', { selector: 'h1', value: 'Hello' }),
  ]
  const payload = buildBrowserFlowPayload(input(steps))
  const body = JSON.parse(String(payload.body))
  assert.equal(body.steps[0].value, 'https://example.com/login')
  assert.equal(body.steps[1].value, 'tw')
  assert.equal(body.steps[2].value, '3')
  assert.equal(body.steps[3].value, 'Hello')
  // 產生的 body 必須能通過 server 端 zod（先前 selectOption/assertCount 會 CONFIG_ERROR）
  assert.doesNotThrow(() => parseBrowserFlowConfig(body))
})

test('缺 value / selector 與非法 count 會明確拒絕', () => {
  assert.throws(() => cleanBrowserFlowSteps([step('selectOption', { selector: 'select' })]), /value is required/)
  assert.throws(() => cleanBrowserFlowSteps([step('assertCount', { selector: '.x', value: 'abc' })]), /non-negative integer/)
  assert.throws(() => cleanBrowserFlowSteps([step('click')]), /selector is required/)
  assert.throws(() => cleanBrowserFlowSteps([step('goto', { selector: 'h1' })]), /goto/)
  assert.throws(() => cleanBrowserFlowSteps([step('click', { selector: 'h1', timeoutMs: 0 })]), /timeout/)
})

test('空 value 的 goto 代表使用 startUrl，乾淨步驟不放 value', () => {
  const clean = cleanBrowserFlowSteps([step('goto'), step('assertVisible', { selector: 'h1' })])
  assert.equal(clean[0]!.value, undefined)
  assert.equal(clean[1]!.selector, 'h1')
  assert.doesNotThrow(() => parseBrowserFlowConfig({ steps: clean }))
})

test('新增動作保留 value 且通過 server schema', () => {
  const steps = [
    step('goto'),
    step('assertUrl', { value: 'https://example.com/done' }),
    step('assertTitle', { value: 'Done' }),
    step('assertHidden', { selector: '#error' }),
    step('press', { value: 'Enter' }),
    step('waitForTimeout', { value: '250' }),
  ]
  const payload = buildBrowserFlowPayload(input(steps))
  const body = JSON.parse(String(payload.body))
  assert.equal(body.steps[1].value, 'https://example.com/done')
  assert.equal(body.steps[4].value, 'Enter')
  assert.doesNotThrow(() => parseBrowserFlowConfig(body))
  assert.throws(() => cleanBrowserFlowSteps([step('waitForTimeout', { value: '99999' })]), /30000/)
  assert.throws(() => cleanBrowserFlowSteps([step('assertUrl', { value: 'javascript:alert(1)' })]), /http\/https/)
})

test('表單基本欄位驗證', () => {
  assert.throws(() => buildBrowserFlowPayload({ ...input([step('goto')]), name: '' }), /name/)
  assert.throws(() => buildBrowserFlowPayload({ ...input([step('goto')]), url: 'javascript:alert(1)' }), /http\/https/)
  assert.throws(() => buildBrowserFlowPayload({ ...input([step('goto')]), interval: 7 }), /interval/)
  assert.throws(() => buildBrowserFlowPayload({ ...input([]) }), /步骤/)
})
