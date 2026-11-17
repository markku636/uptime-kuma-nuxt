// server/services/monitor/checkers/json-query-checker.ts
import { JSONPath } from 'jsonpath-plus'
import type { CheckResult } from '../checker'
import { isStatusAccepted } from '../status-codes'
import { sendMonitorRequest } from './http-request'

export async function checkJsonQuery(monitor: any, startTime: number): Promise<CheckResult> {
  try {
    const response = await sendMonitorRequest(monitor)
    const ping = Date.now() - startTime

    // Same accepted status codes as HTTP monitors (default 2xx/3xx)
    if (!isStatusAccepted(response.status, monitor.acceptedStatuscodes)) {
      return {
        status: monitor.upsideDown ? 1 : 0,
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
