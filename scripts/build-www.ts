/**
 * Everything Cloudflare publishes → www/
 *   www/app   the built app (scripts/build.ts → dist/)
 *   www/site  the introduction site (site/), plus sitemap.xml
 * worker/index.js picks the folder by host name.
 */
import { $ } from 'bun'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dir, '..')
const www = join(root, 'www')

await $`bun run ${join(root, 'scripts/build.ts')}`.quiet()
await rm(www, { recursive: true, force: true })
await mkdir(www, { recursive: true })
await cp(join(root, 'dist'), join(www, 'app'), { recursive: true })
await cp(join(root, 'site'), join(www, 'site'), { recursive: true })
// the site uses the same font as the app
await cp(join(root, 'src/ui/fonts/Vazirmatn-wght.woff2'), join(www, 'site/fonts/Vazirmatn-wght.woff2'))

const pages = ['', 'impressum', 'datenschutz', 'nutzungsbedingungen']
const today = new Date().toISOString().slice(0, 10)
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((p) => `  <url><loc>https://apphodhod.com/${p}</loc><lastmod>${today}</lastmod></url>`).join('\n')}
</urlset>
`
await writeFile(join(www, 'site/sitemap.xml'), sitemap)
const size = (await readFile(join(www, 'site/index.html'))).byteLength
console.log(`www/ ready (site index ${(size / 1024).toFixed(1)} kB)`)
