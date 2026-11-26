// server/services/monitor/checkers/visual-pixel-diff.ts
// 純函式：比對兩張 PNG（基準 vs 本次），可遮罩動態區塊。不碰 DB／Playwright。
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import type { VisualConfig } from '../../../../shared/types/visual-config'

export interface IgnoreRect {
  x: number
  y: number
  width: number
  height: number
}

export interface PixelDiffResult {
  diffRatio: number
  diffPixels: number
  width: number
  height: number
  dimensionMismatch: boolean
  diffImage?: Buffer
}

export interface CompareOptions {
  ignoreRects?: IgnoreRect[]
  includeDiffImage?: boolean
  /** pixelmatch 的 YIQ 色彩閾值，與使用者設定的 diffThreshold（面積比例）不同。 */
  pixelThreshold?: number
}

/** 把動態區塊在兩張圖上都塗白，讓它不計入差異。 */
function maskPng(png: PNG, rects: IgnoreRect[]): void {
  for (const rect of rects) {
    const x0 = Math.max(0, Math.floor(rect.x))
    const y0 = Math.max(0, Math.floor(rect.y))
    const x1 = Math.min(png.width, Math.ceil(rect.x + rect.width))
    const y1 = Math.min(png.height, Math.ceil(rect.y + rect.height))
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const index = (png.width * y + x) << 2
        png.data[index] = 255
        png.data[index + 1] = 255
        png.data[index + 2] = 255
        png.data[index + 3] = 255
      }
    }
  }
}

export function comparePngBuffers(baseline: Buffer, current: Buffer, options: CompareOptions = {}): PixelDiffResult {
  const before = PNG.sync.read(baseline)
  const after = PNG.sync.read(current)
  const ignoreRects = options.ignoreRects ?? []
  maskPng(before, ignoreRects)
  maskPng(after, ignoreRects)

  const dimensionMismatch = before.width !== after.width || before.height !== after.height
  if (dimensionMismatch) {
    const width = Math.max(before.width, after.width)
    const height = Math.max(before.height, after.height)
    return {
      diffRatio: 1,
      diffPixels: width * height,
      width,
      height,
      dimensionMismatch: true,
      ...(options.includeDiffImage ? { diffImage: current } : {}),
    }
  }

  const diff = new PNG({ width: before.width, height: before.height })
  const diffPixels = pixelmatch(
    before.data,
    after.data,
    diff.data,
    before.width,
    before.height,
    { threshold: options.pixelThreshold ?? 0.1 },
  )
  return {
    diffRatio: diffPixels / (before.width * before.height),
    diffPixels,
    width: before.width,
    height: before.height,
    dimensionMismatch: false,
    ...(options.includeDiffImage ? { diffImage: PNG.sync.write(diff) } : {}),
  }
}

/** 面積比例或絕對像素數任一超標就算跑版。 */
export function isVisualRegression(result: PixelDiffResult, config: VisualConfig): boolean {
  if (result.dimensionMismatch) return true
  if (config.maxDiffPixels != null && result.diffPixels > config.maxDiffPixels) return true
  return result.diffRatio > config.diffThreshold
}
