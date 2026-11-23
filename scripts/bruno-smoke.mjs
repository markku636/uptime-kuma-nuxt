#!/usr/bin/env node
// Runs the tagged smoke requests in bruno/ with plain Node fetch.
// No Bruno CLI required. Set BRUNO_BASE_URL / BRUNO_API_KEY to override the
// Production environment defaults.
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import brunoLang from '@usebruno/lang'

const root = new URL('../bruno', import.meta.url).pathname
const envFile = join(root, 'environments', 'Production.bru')
const envSource = readFileSync(envFile, 'utf8')
const envBlock = envSource.match(/vars\s*\{([\s\S]*?)\}/)?.[1] || ''
const env = Object.fromEntries(envBlock.split('\n').map(line => line.match(/^\s*([\w.-]+):\s*(.*?)\s*$/)).filter(Boolean).map(m => [m[1], m[2]]))

if (process.env.BRUNO_PASSWORD) env.password = process.env.BRUNO_PASSWORD
if (process.env.BRUNO_USERNAME) env.username = process.env.BRUNO_USERNAME
const baseUrl = (process.env.BRUNO_BASE_URL || env.baseUrl || 'http://localhost:32400').replace(/\/$/, '')
const apiKey = process.env.BRUNO_API_KEY || process.env.GLOBAL_API_KEY || ''
const cookie = process.env.BRUNO_COOKIE || ''
const timeoutMs = Number(process.env.BRUNO_TIMEOUT_MS || 10000)

function bruFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'environments' ? [] : bruFiles(path)
    return entry.name.endsWith('.bru') && !entry.name.startsWith('collection.bru') ? [path] : []
  })
}

function fill(text) {
  return String(text || '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (match, name) => env[name] ?? match)
}

function check(assertions, status, body) {
  for (const item of assertions || []) {
    if (item.enabled === false) continue
    const [expression, ...rest] = String(item.value || '').trim().split(/\s+/)
    const expected = rest.join(' ').replace(/^"|"$/g, '')
    if (item.name === 'res.status') {
      const op = expression
      const value = Number(expected)
      const ok = op === 'eq' ? status === value : op === 'gte' ? status >= value : op === 'lt' ? status < value : false
      if (!ok) return `status ${status} ${op} ${value} failed`
      continue
    }
    if (item.name === 'res.text' && expression === 'contains' && !body.includes(expected)) {
      return `body does not contain ${expected}`
    }
  }
  return null
}

const files = bruFiles(root).filter(path => {
  const json = brunoLang.bruToJsonV2(readFileSync(path, 'utf8'))
  return (json.meta?.tags || []).includes('smoke')
})

let failed = 0, skipped = 0, passed = 0
for (const file of files) {
  const json = brunoLang.bruToJsonV2(readFileSync(file, 'utf8'))
  const url = fill(json.http?.url)
  const method = String(json.http?.method || 'get').toUpperCase()
  const headers = { accept: '*/*' }
  const requestBody = json.body?.json ? fill(json.body.json) : ''
  if (requestBody) headers['content-type'] = 'application/json'
  if (apiKey && url.includes('/api/v1/')) headers['x-api-key'] = apiKey
  if (cookie) headers.cookie = cookie
  const path = new URL(url).pathname
  // Without credentials, only run requests that are public in this deployment.
  if (path === '/api/auth/login' && !process.env.BRUNO_PASSWORD) {
    skipped++
    console.log(`SKIP ${relative(root, file)} — set BRUNO_PASSWORD to run login`)
    continue
  }
  if (!apiKey && !cookie && /^\/api\/(v1|settings|auth|swagger-json)/.test(path)) {
    skipped++
    console.log(`SKIP ${relative(root, file)} — requires session or API key`)
    continue
  }
  try {
    const response = await fetch(url, {
      method,
      headers,
      ...(requestBody ? { body: requestBody } : {}),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    })
    const body = await response.text()
    const error = check(json.assertions, response.status, body)
    if (error) { failed++; console.error(`FAIL ${relative(root, file)} — ${error}`) }
    else { passed++; console.log(`PASS ${relative(root, file)} — ${response.status}`) }
  } catch (error) {
    failed++
    console.error(`FAIL ${relative(root, file)} — ${error.message}`)
  }
}

console.info(`\nBruno smoke: ${passed} passed, ${skipped} skipped, ${failed} failed (${baseUrl})`)
process.exitCode = failed ? 1 : 0
