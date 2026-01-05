// server/services/monitor/checkers/real-browser-checker.ts
import type { CheckResult } from './index'

// Playwright chromium for browser automation
let chromium: any = null

try {
  // Try to import playwright-core
  const playwright = require('playwright-core')
  chromium = playwright.chromium
} catch (e) {
  console.log('[Real Browser] Playwright not available')
}

let browser: any = null

/**
 * Get or create browser instance
 */
async function getBrowser(executablePath?: string) {
  if (browser && browser.isConnected()) {
    return browser
  }

  if (!chromium) {
    throw new Error('Playwright is not installed. Run: npm install playwright-core')
  }

  const launchOptions: any = {
    headless: true,
  }

  if (executablePath && executablePath !== '#playwright_chromium') {
    launchOptions.executablePath = executablePath
  }

  browser = await chromium.launch(launchOptions)
  return browser
}

/**
 * Close browser instance
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close()
    browser = null
  }
}

/**
 * Check URL using real browser
 */
export async function checkRealBrowser(monitor: any, startTime: number): Promise<CheckResult> {
  const url = monitor.url
  const keyword = monitor.keyword
  const invertKeyword = monitor.invertKeyword
  const timeout = (monitor.timeout || 30) * 1000

  if (!chromium) {
    return {
      status: 0,
      msg: 'Playwright is not installed',
      ping: 0
    }
  }

  let context: any = null
  let page: any = null

  try {
    const browserInstance = await getBrowser(monitor.remote_browser || undefined)
    
    context = await browserInstance.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    page = await context.newPage()
    page.setDefaultTimeout(timeout)

    // Navigate to URL
    const response = await page.goto(url, {
      waitUntil: 'networkidle',
      timeout
    })

    const ping = Date.now() - startTime

    // Check response status
    if (!response) {
      return {
        status: 0,
        msg: 'No response from page',
        ping
      }
    }

    const statusCode = response.status()
    
    // Check for keyword if specified
    if (keyword) {
      const content = await page.content()
      const found = content.includes(keyword)
      
      if (invertKeyword) {
        // Keyword should NOT be found
        if (found) {
          return {
            status: 0,
            msg: `Keyword "${keyword}" found (should not be present)`,
            ping
          }
        }
      } else {
        // Keyword should be found
        if (!found) {
          return {
            status: 0,
            msg: `Keyword "${keyword}" not found`,
            ping
          }
        }
      }
    }

    // Take screenshot if enabled
    if (monitor.screenshot) {
      try {
        const screenshotBuffer = await page.screenshot({
          type: 'png',
          fullPage: false
        })
        // Could save screenshot to storage here
        // For now, we just indicate it was captured
      } catch (e) {
        console.error('[Real Browser] Screenshot error:', e)
      }
    }

    // Check status code
    if (statusCode >= 400) {
      return {
        status: 0,
        msg: `HTTP ${statusCode}`,
        ping
      }
    }

    return {
      status: 1,
      msg: `OK - HTTP ${statusCode}`,
      ping
    }

  } catch (error: any) {
    const ping = Date.now() - startTime
    return {
      status: 0,
      msg: error.message || 'Browser check failed',
      ping
    }
  } finally {
    // Clean up
    if (page) {
      try { await page.close() } catch (e) {}
    }
    if (context) {
      try { await context.close() } catch (e) {}
    }
  }
}
