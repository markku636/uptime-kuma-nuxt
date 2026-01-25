/**
 * Composable for rendering Markdown to sanitized HTML
 * Used for description, footer, incident content, etc.
 */
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export function useMarkdown() {
  /**
   * Convert markdown string to sanitized HTML
   */
  function renderMarkdown(content: string | null | undefined): string {
    if (!content) return ''
    
    try {
      const html = marked(content) as string
      return DOMPurify.sanitize(html)
    } catch (e) {
      console.error('Failed to render markdown:', e)
      return content
    }
  }

  /**
   * Create a computed property that renders markdown
   */
  function useMarkdownComputed(source: Ref<string | null | undefined> | (() => string | null | undefined)) {
    return computed(() => {
      const value = typeof source === 'function' ? source() : source.value
      return renderMarkdown(value)
    })
  }

  return {
    renderMarkdown,
    useMarkdownComputed
  }
}
