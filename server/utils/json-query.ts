// server/utils/json-query.ts
// JSON query evaluation utilities for monitors

import { JSONPath } from 'jsonpath-plus'

interface EvaluationResult {
  status: boolean
  response: any
}

/**
 * Evaluate a JSON value against a JSONPath query and expected value
 */
export async function evaluateJsonQuery(
  value: any,
  jsonPath: string | null,
  jsonPathOperator: string | null,
  expectedValue: string | null
): Promise<EvaluationResult> {
  // If no jsonPath, treat value as-is
  let response: any = value
  
  if (jsonPath) {
    try {
      // If value is a buffer, convert to string
      if (Buffer.isBuffer(value)) {
        value = value.toString()
      }
      
      // Parse JSON if it's a string
      let jsonObj = value
      if (typeof value === 'string') {
        try {
          jsonObj = JSON.parse(value)
        } catch {
          // Not JSON, use as-is
          jsonObj = value
        }
      }
      
      // Execute JSONPath query
      const result = JSONPath({
        path: jsonPath,
        json: jsonObj,
        wrap: false
      })
      
      response = result
    } catch (e: any) {
      return {
        status: false,
        response: `JSONPath error: ${e.message}`
      }
    }
  }
  
  // If no operator or expected value, just check if value exists
  if (!jsonPathOperator || !expectedValue) {
    return {
      status: response !== undefined && response !== null,
      response
    }
  }
  
  // Convert response to string for comparison
  const responseStr = String(response)
  const expected = expectedValue
  
  let status = false
  
  switch (jsonPathOperator) {
    case '==':
    case 'equals':
      status = responseStr === expected
      break
      
    case '!=':
    case 'not equals':
      status = responseStr !== expected
      break
      
    case '>':
    case 'greater than':
      status = parseFloat(responseStr) > parseFloat(expected)
      break
      
    case '>=':
    case 'greater than or equal':
      status = parseFloat(responseStr) >= parseFloat(expected)
      break
      
    case '<':
    case 'less than':
      status = parseFloat(responseStr) < parseFloat(expected)
      break
      
    case '<=':
    case 'less than or equal':
      status = parseFloat(responseStr) <= parseFloat(expected)
      break
      
    case 'contains':
      status = responseStr.includes(expected)
      break
      
    case 'not contains':
      status = !responseStr.includes(expected)
      break
      
    case 'starts with':
      status = responseStr.startsWith(expected)
      break
      
    case 'ends with':
      status = responseStr.endsWith(expected)
      break
      
    case 'regex':
      try {
        const regex = new RegExp(expected)
        status = regex.test(responseStr)
      } catch {
        status = false
      }
      break
      
    default:
      status = responseStr === expected
  }
  
  return { status, response }
}
