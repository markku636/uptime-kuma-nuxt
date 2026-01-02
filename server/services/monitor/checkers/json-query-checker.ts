// server/services/monitor/checkers/json-query-checker.ts
import axios from 'axios'
import { JSONPath } from 'jsonpath-plus'
import type { CheckResult } from '../checker'

export async function checkJsonQuery(monitor: any, startTime: number): Promise<CheckResult> {
  const https = await import('https')
  
  const config: any = {
    method: monitor.method || 'GET',
    url: monitor.url,
    timeout: (monitor.timeout || 48) * 1000,
    headers: monitor.headers || {},
    validateStatus: () => true,
  }

  if (monitor.body) {
    config.data = monitor.body
  }

  if (monitor.ignoreTls) {
    config.httpsAgent = new https.Agent({ rejectUnauthorized: false })
  }

  if (monitor.authMethod === 'basic' && monitor.basicAuthUser) {
    config.auth = {
      username: monitor.basicAuthUser,
      password: monitor.basicAuthPass || ''
    }
  }

  try {
    const response = await axios(config)
    const ping = Date.now() - startTime

    if (response.status < 200 || response.status >= 400) {
      return {
        status: 0,
        ping,
        msg: `HTTP ${response.status} - ${response.statusText}`
      }
    }

    // Parse JSON response
    let jsonData: any
    if (typeof response.data === 'string') {
      try {
        jsonData = JSON.parse(response.data)
      } catch {
        return {
          status: 0,
          ping,
          msg: 'Response is not valid JSON'
        }
      }
    } else {
      jsonData = response.data
    }

    // Apply JSONPath query
    if (!monitor.jsonPath) {
      return {
        status: 0,
        ping,
        msg: 'JSON Path is required'
      }
    }

    const results = JSONPath({
      path: monitor.jsonPath,
      json: jsonData
    })

    if (results.length === 0) {
      return {
        status: 0,
        ping,
        msg: `No results found for JSONPath: ${monitor.jsonPath}`
      }
    }

    const actualValue = results[0]
    const actualValueStr = typeof actualValue === 'object' 
      ? JSON.stringify(actualValue) 
      : String(actualValue)

    // Check against expected value if provided
    if (monitor.expectedValue !== undefined && monitor.expectedValue !== null && monitor.expectedValue !== '') {
      const expectedValue = monitor.expectedValue

      let isMatch = false
      
      // Try numeric comparison
      if (!isNaN(Number(actualValueStr)) && !isNaN(Number(expectedValue))) {
        isMatch = Number(actualValueStr) === Number(expectedValue)
      } else {
        // String comparison
        isMatch = actualValueStr === expectedValue
      }

      if (monitor.invertKeyword) {
        isMatch = !isMatch
      }

      if (!isMatch) {
        return {
          status: monitor.upsideDown ? 1 : 0,
          ping,
          msg: `Expected: ${expectedValue}, Got: ${actualValueStr}`
        }
      }
    }

    return {
      status: monitor.upsideDown ? 0 : 1,
      ping,
      msg: `JSON Query Result: ${actualValueStr}`
    }
  } catch (error: any) {
    return {
      status: 0,
      ping: Date.now() - startTime,
      msg: error.message || 'JSON Query check failed'
    }
  }
}
