import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PNG } from 'pngjs'
import { normalizeVisualConfig } from '../server/utils/visual-config'
import { comparePngBuffers, isVisualRegression } from '../server/services/monitor/checkers/visual-pixel-diff'

type Rgba = [number, number, number, number]

function makePng(
  width: number,
  height: number,
  paint?: (x: number, y: number) => Rgba,
): Buffer {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = paint?.(x, y) ?? [255, 255, 255, 255]
      const index = (width * y + x) << 2
      png.data[index] = r
      png.data[index + 1] = g
      png.data[index + 2] = b
      png.data[index + 3] = a
    }
  }
  return PNG.sync.write(png)
}

const base = makePng(100, 100)
const changed = makePng(100, 100, (x, y) =>
  x >= 10 && x < 20 && y >= 10 && y < 20 ? [255, 0, 0, 255] : [255, 255, 255, 255],
)
const configFor = (diffThreshold: number, maxDiffPixels?: number) =>
  normalizeVisualConfig({
    viewports: [{ label: 'desktop', width: 320, height: 400 }],
    diffThreshold,
    ...(maxDiffPixels != null ? { maxDiffPixels } : {}),
  })

test('相同的圖沒有差異', () => {
  const result = comparePngBuffers(base, base)
  assert.equal(result.diffPixels, 0)
  assert.equal(result.diffRatio, 0)
  assert.equal(result.dimensionMismatch, false)
  assert.equal(isVisualRegression(result, configFor(0.02)), false)
})

test('10x10 色塊 = 100 像素差異，比例 1%', () => {
  const result = comparePngBuffers(base, changed)
  assert.equal(result.diffPixels, 100)
  assert.equal(result.diffRatio, 0.01)
  assert.equal(isVisualRegression(result, configFor(0.02)), false)
  assert.equal(isVisualRegression(result, configFor(0.005)), true)
})

test('ignore rect 可遮蔽動態區塊', () => {
  const result = comparePngBuffers(base, changed, {
    ignoreRects: [{ x: 10, y: 10, width: 10, height: 10 }],
  })
  assert.equal(result.diffPixels, 0)
})

test('絕對像素數閾值任一超標即算跑版', () => {
  const result = comparePngBuffers(base, changed)
  assert.equal(isVisualRegression(result, configFor(0.5, 50)), true)
  assert.equal(isVisualRegression(result, configFor(0.5, 200)), false)
})

test('尺寸不同視為跑版（viewport 改變）', () => {
  const result = comparePngBuffers(base, makePng(120, 100))
  assert.equal(result.dimensionMismatch, true)
  assert.equal(result.width, 120)
  assert.equal(isVisualRegression(result, configFor(0.9, 100000)), true)
})

test('IncludeDiffImage 時回傳可讀的 PNG', () => {
  const result = comparePngBuffers(base, changed, { includeDiffImage: true })
  assert.ok(result.diffImage)
  const png = PNG.sync.read(result.diffImage!)
  assert.equal(png.width, 100)
  assert.equal(png.height, 100)
})
