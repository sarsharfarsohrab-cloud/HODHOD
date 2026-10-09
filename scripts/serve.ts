/** Serves dist/ on http://localhost:4173 for a local look at the production build. */
import { join, normalize } from 'node:path'

const dist = join(import.meta.dir, '..', 'dist')
const port = Number(process.env.PORT ?? 4173)

Bun.serve({
  port,
  async fetch(req) {
    const path = normalize(decodeURIComponent(new URL(req.url).pathname)).replace(/^(\.\.[/\\])+/, '')
    const file = Bun.file(join(dist, path === '/' ? 'index.html' : path))
    return (await file.exists()) ? new Response(file) : new Response('not found', { status: 404 })
  },
})
console.log(`http://localhost:${port}`)
