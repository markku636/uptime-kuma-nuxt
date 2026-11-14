process.env.APP_ROLE='worker'
// Resolve at runtime so Nuxt's application type graph never imports generated JS.
const entry=new URL('../.output/server/index.mjs',import.meta.url)
await import(entry.href)
