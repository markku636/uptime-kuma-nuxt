// server/services/monitor/checkers/visual-diff-checker.ts
// 真瀏覽器 + 基準比對。DB 與瀏覽器都可注入，方便用 fixture 測試。
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { chromium } from 'playwright'
import type { CheckResult } from '../checker'
import { prisma } from '../../../utils/prisma'
import { normalizeVisualConfig } from '../../../utils/visual-config'
import type { VisualConfig } from '../../../../shared/types/visual-config'
import {
  evaluateLayoutRules,
  layoutFailureMessage,
  type LayoutObservation,
} from './visual-layout-rules'
import {
  comparePngBuffers,
  isVisualRegression,
  type IgnoreRect,
} from './visual-pixel-diff'

export interface BaselineRow {
  configVersion: number
  image: Buffer
  sha256: string
}

export interface VisualDb {
  findBaseline(monitorId: number, viewportLabel: string): Promise<BaselineRow | null>
  saveBaseline(
    monitorId: number,
    viewportLabel: string,
    width: number,
    height: number,
    image: Buffer,
    sha256: string,
    configVersion: number,
  ): Promise<void>
  saveArtifact(data: {
    monitorId: number
    viewportLabel: string
    status: number
    diffRatio: number | null
    diffPixels: number | null
    diffImage: Buffer | null
    currentImage: Buffer
    metrics: Record<string, unknown>
  }): Promise<void>
}

const prismaDb: VisualDb = {
  async findBaseline(monitorId, viewportLabel) {
    const row = await prisma.visualBaseline.findUnique({
      where: { monitorId_viewportLabel: { monitorId, viewportLabel } },
    })
    if (!row) return null
    return { configVersion: row.configVersion, image: Buffer.from(row.image), sha256: row.sha256 }
  },
  async saveBaseline(monitorId, viewportLabel, width, height, image, sha256, configVersion) {
    await prisma.visualBaseline.upsert({
      where: { monitorId_viewportLabel: { monitorId, viewportLabel } },
      create: { monitorId, viewportLabel, width, height, image: new Uint8Array(image), sha256, configVersion },
      update: { width, height, image: new Uint8Array(image), sha256, configVersion },
    })
  },
  async saveArtifact(data) {
    await prisma.visualCheckArtifact.create({
      data: {
        ...data,
        diffImage: data.diffImage ? new Uint8Array(data.diffImage) : null,
        currentImage: new Uint8Array(data.currentImage),
        metrics: data.metrics as Prisma.InputJsonValue,
      },
    })
  },
}

/** 優先用 Playwright 自帶 chromium；沒下載時退回系統 Chrome。 */
async function launchBrowser(): Promise<any> {
  try {
    return await chromium.launch({ headless: true })
  } catch {
    return await chromium.launch({ headless: true, channel: 'chrome' })
  }
}

async function observePage(page: any, config: VisualConfig): Promise<{
  observation: LayoutObservation
  screenshot: Buffer
  ignoreRects: IgnoreRect[]
}> {
  // server 端 typecheck 沒有 DOM lib；頁面內的全域一律走 any。
  const geometry = await page.evaluate(() => {
    const globals: any = globalThis
    return {
      scrollWidth: globals.document.documentElement.scrollWidth,
      viewportWidth: globals.window.innerWidth,
    }
  })

  const required: LayoutObservation['required'] = []
  for (const expected of config.requiredSelectors) {
    try {
      const measured = await page.$$eval(expected.selector, (elements: any[]) => {
        const globals: any = globalThis
        let visibleCount = 0
        let maxWidth = 0
        let maxHeight = 0
        for (const element of elements) {
          const rect = element.getBoundingClientRect()
          const style = globals.getComputedStyle(element)
          if (rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none') {
            visibleCount++
          }
          maxWidth = Math.max(maxWidth, rect.width)
          maxHeight = Math.max(maxHeight, rect.height)
        }
        return { count: elements.length, visibleCount, maxWidth, maxHeight }
      })
      required.push({ selector: expected.selector, ...measured })
    } catch {
      required.push({ selector: expected.selector, count: 0, visibleCount: 0, maxWidth: 0, maxHeight: 0 })
    }
  }

  const brokenImages: string[] = await page.$$eval('img', (images: any[]) =>
    images
      .filter((image) => image.complete && image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src || '(no src)'),
  )

  const ignoreRects: IgnoreRect[] = []
  for (const selector of config.ignoreSelectors) {
    try {
      const rects = await page.$$eval(selector, (elements: any[]) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect()
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        }),
      )
      ignoreRects.push(...rects)
    } catch {
      // 無效 selector 不該讓整個檢查失敗，只是少了這塊遮罩。
    }
  }

  return {
    observation: {
      httpStatus: 200,
      viewportWidth: geometry.viewportWidth,
      documentScrollWidth: geometry.scrollWidth,
      required,
      brokenImages,
      pageErrors: [],
    },
    screenshot: await page.screenshot({ type: 'png', fullPage: config.fullPage }),
    ignoreRects,
  }
}

export interface VisualCheckDeps {
  db: VisualDb
  launch: () => Promise<any>
}

const defaultDeps: VisualCheckDeps = { db: prismaDb, launch: launchBrowser }

export async function checkVisualDiff(
  monitor: any,
  startTime: number,
  signal?: AbortSignal,
  deps: VisualCheckDeps = defaultDeps,
): Promise<CheckResult> {
  const config = normalizeVisualConfig(monitor.visualConfig)
  if (!monitor.url) {
    return { status: 0, ping: Date.now() - startTime, msg: 'URL is required for visual-diff monitors', code: 'CONFIG_ERROR' }
  }

  const timeoutMs = (monitor.timeout || 48) * 1000
  const configVersion = Number(monitor.configVersion ?? 1)
  const failures: string[] = []
  const notes: string[] = []
  let createdBaselines = 0
  let refreshedBaselines = 0
  let code: string | undefined
  let browser: any = null

  try {
    browser = await deps.launch()
    for (const viewport of config.viewports) {
      if (signal?.aborted) throw new Error('ABORTED')
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
      const page = await context.newPage()
      page.setDefaultTimeout(Math.min(timeoutMs, config.waitTimeoutMs || 5000))
      const pageErrors: string[] = []
      page.on('pageerror', (error: Error) => pageErrors.push(error.message))
      try {
        const response = await page.goto(monitor.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs })
        const httpStatus = response?.status() ?? 0
        if (config.waitForSelector) {
          await page.waitForSelector(config.waitForSelector, { timeout: config.waitTimeoutMs })
        }
        if (config.settleMs > 0) await page.waitForTimeout(config.settleMs)

        const { observation, screenshot, ignoreRects } = await observePage(page, config)
        observation.httpStatus = httpStatus
        observation.pageErrors = pageErrors

        const rules = evaluateLayoutRules(observation, config)
        const sha256 = createHash('sha256').update(screenshot).digest('hex')
        const label = viewport.label
        const baseline = await deps.db.findBaseline(monitor.id, label)

        let diffRatio: number | null = null
        let diffPixels: number | null = null
        let diffImage: Buffer | null = null
        let viewportFailed = false

        if (rules.length > 0) {
          failures.push(`[${label}] ${layoutFailureMessage(rules)}`)
          code = code ?? 'LAYOUT_RULE'
          viewportFailed = true
        }

        if (!baseline) {
          await deps.db.saveBaseline(monitor.id, label, viewport.width, viewport.height, screenshot, sha256, configVersion)
          createdBaselines++
        } else if (baseline.configVersion !== configVersion) {
          if (config.baselineStrategy === 'auto') {
            await deps.db.saveBaseline(monitor.id, label, viewport.width, viewport.height, screenshot, sha256, configVersion)
            refreshedBaselines++
          } else {
            failures.push(`[${label}] BASELINE_STALE: 設定已變更，請接受新基準`)
            code = code ?? 'BASELINE_STALE'
            viewportFailed = true
          }
        } else {
          const diff = comparePngBuffers(baseline.image, screenshot, {
            ignoreRects,
            includeDiffImage: true,
          })
          diffRatio = diff.diffRatio
          diffPixels = diff.diffPixels
          if (isVisualRegression(diff, config)) {
            diffImage = diff.diffImage ?? null
            failures.push(
              `[${label}] VISUAL_DIFF: 差異 ${(diff.diffRatio * 100).toFixed(2)}%（${diff.diffPixels}px）${diff.dimensionMismatch ? '，尺寸不符' : ''}`,
            )
            code = code ?? 'VISUAL_DIFF'
            viewportFailed = true
          }
        }

        await deps.db.saveArtifact({
          monitorId: monitor.id,
          viewportLabel: label,
          status: viewportFailed ? 0 : 1,
          diffRatio,
          diffPixels,
          diffImage,
          currentImage: screenshot,
          metrics: {
            httpStatus,
            overflow: observation.documentScrollWidth - observation.viewportWidth,
            required: observation.required,
            brokenImages: observation.brokenImages,
            pageErrors: observation.pageErrors,
            viewports: { width: viewport.width, height: viewport.height },
          },
        })
      } finally {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
      }
    }
  } catch (error: any) {
    const message = error?.message || 'Visual diff check failed'
    if (message !== 'ABORTED') failures.push(message)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }

  if (createdBaselines > 0) notes.push(`已建立 ${createdBaselines} 個基準（待人工確認）`)
  if (refreshedBaselines > 0) notes.push(`已自動更新 ${refreshedBaselines} 個基準`)

  const ping = Date.now() - startTime
  if (failures.length > 0) {
    return { status: 0, ping, msg: failures.join('；').slice(0, 2000), code: code ?? 'CHECK_ERROR' }
  }
  return { status: 1, ping, msg: [...notes, '版面與截圖皆正常'].join('；'), code: 'VISUAL_OK' }
}
