import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { chromium } from 'playwright'
import { checkVisualDiff, type BaselineRow, type VisualDb } from '../server/services/monitor/checkers/visual-diff-checker'

class MemoryDb implements VisualDb {
  baselines = new Map<string, BaselineRow>()
  artifacts: any[] = []
  async findBaseline(monitorId: number, label: string) {
    return this.baselines.get(`${monitorId}:${label}`) ?? null
  }
  async saveBaseline(
    monitorId: number,
    label: string,
    _width: number,
    _height: number,
    image: Buffer,
    sha256: string,
    configVersion: number,
  ) {
    this.baselines.set(`${monitorId}:${label}`, { configVersion, image, sha256 })
  }
  async saveArtifact(data: any) {
    this.artifacts.push(data)
  }
}

const okHtml = `<!doctype html><html><body style="margin:0;background:#fff">
  <h1 id="title" style="font:24px sans-serif;color:#000">SealWatch test page</h1>
  <img src="/logo.png" width="40" height="40" alt="logo">
</body></html>`

const brokenHtml = okHtml.replace(
  '</body>',
  '<div style="position:absolute;left:0;top:100px;width:3000px;height:50px;background:#f00"></div></body>',
)

async function serve(html: () => string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http.createServer((_req, res) => {
    if (_req.url === '/logo.png') {
      // 1x1 PNG，讓 broken image 判定不會誤報。
      res.writeHead(200, { 'content-type': 'image/png' })
      res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'))
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(html())
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  }
}

const launch = () => chromium.launch({ headless: true, channel: 'chrome' })
const visualConfig = {
  viewports: [{ label: 'desktop', width: 800, height: 600 }],
  waitTimeoutMs: 5000,
  settleMs: 0,
  fullPage: false,
  requiredSelectors: [{ selector: '#title', minCount: 1, minWidth: 100 }],
  detectBrokenImages: true,
  diffThreshold: 0.001,
  baselineStrategy: 'manual' as const,
}

test('版面規則失敗時不建立基準', { timeout: 120000 }, async () => {
  const server = await serve(() => brokenHtml)
  const db = new MemoryDb()
  const monitor = { id: 7777, url: server.url, timeout: 20, configVersion: 1, visualConfig }
  try {
    const broken = await checkVisualDiff(monitor, Date.now(), undefined, { db, launch })
    assert.equal(broken.status, 0, broken.msg)
    assert.equal(db.baselines.size, 0, '壞掉的頁面不該被存成基準')
  } finally {
    await server.close()
  }
})

test('visual-diff 完整流程：建立基準 → UP → 改版 DOWN → 設定變更後基準失效', { timeout: 120000 }, async () => {
  let currentHtml = okHtml
  const server = await serve(() => currentHtml)
  const db = new MemoryDb()
  const monitor = { id: 4242, url: server.url, timeout: 20, configVersion: 1, visualConfig }

  try {
    const first = await checkVisualDiff(monitor, Date.now(), undefined, { db, launch })
    assert.equal(first.status, 1, first.msg)
    assert.match(first.msg, /建立基準|正常/) // 首次建立基準後回 UP
    assert.equal(db.baselines.size, 1)
    assert.equal(db.artifacts.length, 1)

    const second = await checkVisualDiff(monitor, Date.now(), undefined, { db, launch })
    assert.equal(second.status, 1, second.msg)

    currentHtml = brokenHtml
    const changed = await checkVisualDiff(monitor, Date.now(), undefined, { db, launch })
    assert.equal(changed.status, 0, changed.msg)
    assert.match(changed.msg, /LAYOUT_RULE|VISUAL_DIFF/)
    assert.ok(db.artifacts.some((artifact) => artifact.status === 0))

    currentHtml = okHtml
    const stale = await checkVisualDiff({ ...monitor, configVersion: 2 }, Date.now(), undefined, { db, launch })
    assert.equal(stale.status, 0, stale.msg)
    assert.match(stale.msg, /BASELINE_STALE/)
  } finally {
    await server.close()
  }
})
