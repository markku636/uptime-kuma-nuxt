declare module 'rss' {
  interface RSSOptions {
    title: string
    description?: string
    feed_url?: string
    site_url?: string
    language?: string
    pubDate?: Date
    ttl?: number
    [key: string]: unknown
  }
  interface RSSItem {
    title?: string
    description?: string
    url?: string
    date?: Date
    guid?: string
    [key: string]: unknown
  }
  class RSS {
    constructor(options: RSSOptions)
    item(input: RSSItem): void
    xml(options?: { indent?: boolean }): string
  }
  export default RSS
}
