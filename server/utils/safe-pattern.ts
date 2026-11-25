/**
 * Bounded, linear-time matcher for the safe subset of Bruno's regex assertions.
 * Supports literals, `.`, character classes, escapes, ^/$ anchors and *, +, ? quantifiers.
 * Groups, alternation, backreferences and lookarounds are rejected so a malicious pattern
 * cannot trigger catastrophic backtracking. Returns null when the pattern is unsupported.
 */
interface Token { test: (char: string) => boolean; min: number; max: number }
interface Pattern { tokens: Token[]; anchoredStart: boolean; anchoredEnd: boolean }

const MAX_PATTERN = 256
const MAX_VALUE = 65536
const MAX_TOKENS = 64

function characterClass(pattern: string, start: number): {test: (char: string) => boolean; next: number} | null {
  let index = start + 1, negated = false
  if (pattern[index] === '^') { negated = true; index++ }
  const ranges: Array<[string, string]> = [], singles = new Set<string>()
  let closed = false
  while (index < pattern.length) {
    const char = pattern[index++]!
    if (char === ']') { closed = true; break }
    if (char === '\\') {
      const escaped = pattern[index++]
      if (escaped === undefined) return null
      singles.add(escaped)
    } else if (pattern[index] === '-' && pattern[index + 1] !== ']' && pattern[index + 1] !== undefined) {
      const end = pattern[index + 1]!
      index += 2
      ranges.push([char, end])
    } else singles.add(char)
  }
  if (!closed || (!ranges.length && !singles.size)) return null
  return {
    next: index,
    test: char => {
      const inside = singles.has(char) || ranges.some(([from, to]) => char >= from && char <= to)
      return negated ? !inside : inside
    },
  }
}

function parse(pattern: string): Pattern | null {
  if (!pattern || Buffer.byteLength(pattern) > MAX_PATTERN) return null
  let body = pattern, anchoredStart = false, anchoredEnd = false
  if (body.startsWith('^')) { anchoredStart = true; body = body.slice(1) }
  if (body.endsWith('$') && !body.endsWith('\\$')) { anchoredEnd = true; body = body.slice(0, -1) }
  const tokens: Token[] = []
  let index = 0
  while (index < body.length) {
    const char = body[index]!
    if (char === '(' || char === ')' || char === '|' || char === '^' || char === '$' || char === '{' || char === '}') return null
    let test: (value: string) => boolean
    if (char === '.') { test = () => true; index++ }
    else if (char === '[') {
      const parsed = characterClass(body, index)
      if (!parsed) return null
      test = parsed.test
      index = parsed.next
    } else if (char === '\\') {
      const escaped = body[index + 1]
      if (escaped === undefined) return null
      if (escaped === 'd') test = value => /[0-9]/.test(value)
      else if (escaped === 'w') test = value => /[A-Za-z0-9_]/.test(value)
      else if (escaped === 's') test = value => /\s/.test(value)
      else test = value => value === escaped
      index += 2
    } else {
      test = value => value === char
      index++
    }
    let min = 1, max = 1
    const quantifier = body[index]
    if (quantifier === '*') { min = 0; max = Infinity; index++ }
    else if (quantifier === '+') { min = 1; max = Infinity; index++ }
    else if (quantifier === '?') { min = 0; max = 1; index++ }
    if (tokens.length >= MAX_TOKENS) return null
    tokens.push({test, min, max})
  }
  return {tokens, anchoredStart, anchoredEnd}
}

export function safePatternMatch(value: string, pattern: string): boolean | null {
  const parsed = parse(pattern)
  if (!parsed || typeof value !== 'string' || Buffer.byteLength(value) > MAX_VALUE) return null
  const {tokens, anchoredStart, anchoredEnd} = parsed
  const length = value.length, width = length + 1
  // Hard work budget keeps a short pattern from stalling a checker on a large body.
  if (tokens.length * width > 8_000_000) return null
  let previous = new Uint8Array(width), current = new Uint8Array(width)
  // An unanchored pattern may start at any position in the value.
  if (anchoredStart) previous[0] = 1
  else previous.fill(1)
  for (const token of tokens) {
    current.fill(0)
    const unbounded = token.max === Infinity
    for (let pos = 0; pos <= length; pos++) {
      if (unbounded) {
        // Zero-width star/plus closure: one left-to-right pass, no quadratic restart.
        if (token.min === 0 ? previous[pos] : false) current[pos] = 1
        if (pos > 0 && token.test(value[pos - 1]!) && (previous[pos - 1] || current[pos - 1])) current[pos] = 1
      } else if (token.max === 1) {
        if ((token.min === 0 && previous[pos]) || (pos > 0 && previous[pos - 1] && token.test(value[pos - 1]!))) current[pos] = 1
      } else if (pos > 0 && previous[pos - 1] && token.test(value[pos - 1]!)) {
        current[pos] = 1
      }
    }
    const swap = previous; previous = current; current = swap
  }
  for (let end = 0; end <= length; end++) {
    if (previous[end] && (!anchoredEnd || end === length)) return true
  }
  return false
}
