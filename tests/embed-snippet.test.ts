import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildStatusEmbedSnippet } from '../utils/embed-snippet'

test('embed snippet points to the compact public view', () => {
  const snippet = buildStatusEmbedSnippet('https://uptime.226network.com/', 'my-status', 'My Status')
  assert.match(snippet, /src="https:\/\/uptime\.226network\.com\/status\/my-status\/embed"/)
  assert.match(snippet, /title="My Status status"/)
  assert.match(snippet, /loading="lazy"/)
})

test('embed snippet rejects unsafe slugs, origins and titles', () => {
  assert.equal(buildStatusEmbedSnippet('https://example.com', 'Bad Slug'), '')
  assert.equal(buildStatusEmbedSnippet('javascript:alert(1)', 'slug'), '')
  const snippet = buildStatusEmbedSnippet('https://example.com', 'slug', '<script>"x"</script>')
  assert.ok(!snippet.includes('<script>'))
  assert.ok(!snippet.includes('"x"'))
})
