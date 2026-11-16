#!/usr/bin/env node
// Fails when components use raw colours instead of design tokens.
//   - Tailwind neutral / status palette utilities (text-gray-500, bg-red-100, dark:bg-gray-800 …)
//   - hex colours inside <style> blocks (except as a var() fallback)
// Use the semantic utilities from assets/css/main.css / tokens.css instead.
// Data colours (tag swatches, badge colour pickers) live in <script> and are not checked.
//
// Usage: node scripts/check-colors.mjs [--list]
import fs from 'node:fs'
import path from 'node:path'

const ROOTS = ['components', 'pages', 'layouts', 'app.vue', 'error.vue']
const PALETTE = '(?:gray|slate|zinc|neutral|stone|red|rose|green|emerald|yellow|amber)'
const UTILITY = new RegExp(String.raw`(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|divide|ring|from|to|via|fill|stroke|outline)-${PALETTE}-\d{2,3}(?:/\d+)?(?![\w-])`, 'g')
const DARK_PALETTE = /(?<![\w-])dark:(?:[a-z-]+:)*(?:bg|text|border|ring)-(?:white|black)(?![\w-])/g
const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g

function walk(p, out = []) {
  if (!fs.existsSync(p)) return out
  const stat = fs.statSync(p)
  if (stat.isFile()) {
    if (p.endsWith('.vue')) out.push(p)
    return out
  }
  for (const entry of fs.readdirSync(p)) walk(path.join(p, entry), out)
  return out
}

const problems = []
for (const file of ROOTS.flatMap(r => walk(r))) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)
  let inStyle = false
  lines.forEach((line, i) => {
    if (/<style\b/.test(line)) inStyle = true
    if (inStyle) {
      const withoutFallbacks = line.replace(/var\(--[\w-]+,\s*#[0-9a-fA-F]{3,8}\)/g, '')
      for (const m of withoutFallbacks.matchAll(HEX)) problems.push(`${file}:${i + 1}  hex ${m[0]}`)
    } else {
      for (const m of line.matchAll(UTILITY)) problems.push(`${file}:${i + 1}  ${m[0]}`)
      for (const m of line.matchAll(DARK_PALETTE)) problems.push(`${file}:${i + 1}  ${m[0]}`)
    }
    if (/<\/style>/.test(line)) inStyle = false
  })
}

if (problems.length) {
  if (process.argv.includes('--list') || problems.length <= 50) console.error(problems.join('\n'))
  console.error(`\n${problems.length} raw colour use(s). Use token utilities (bg-default, text-muted, text-down-fg …) or var(--uk-*).`)
  process.exit(1)
}
console.log('check-colors: OK')
