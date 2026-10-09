/**
 * Production build → dist/ (plain static files, ready for any static host).
 *   bun run scripts/build.ts          minified
 *   bun run scripts/build.ts --dev    readable, with source maps
 */
import { createHash } from 'node:crypto'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import pkg from '../package.json'

const root = join(import.meta.dir, '..')
const dist = join(root, 'dist')
const dev = process.argv.includes('--dev')

await rm(dist, { recursive: true, force: true })
await mkdir(join(dist, 'assets'), { recursive: true })

const app = await Bun.build({
  entrypoints: [join(root, 'src/main.ts'), join(root, 'src/ui/app.css')],
  outdir: join(dist, 'assets'),
  target: 'browser',
  format: 'esm',
  minify: !dev,
  sourcemap: dev ? 'linked' : 'none',
  naming: { entry: '[name].[hash].[ext]', asset: '[name].[hash].[ext]', chunk: '[name].[hash].[ext]' },
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
})
if (!app.success) {
  for (const log of app.logs) console.error(log)
  process.exit(1)
}

const hashOf = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex').slice(0, 10)

// The font stays a separate, cacheable file (bundling would inline it into the CSS as base64).
const fontData = await readFile(join(root, 'src/ui/fonts/Vazirmatn-wght.woff2'))
const fontName = `Vazirmatn.${hashOf(fontData)}.woff2`
await writeFile(join(dist, 'assets', fontName), fontData)
const font = `./assets/${fontName}`

const built = (await readdir(join(dist, 'assets'))).filter((f) => !f.endsWith('.map'))
const find = (test: (name: string) => boolean) => {
  const name = built.find(test)
  if (!name) throw new Error('build output is missing an expected file')
  return name
}
const appJs = `./assets/${find((f) => f.startsWith('main.') && f.endsWith('.js'))}`

const bundledCss = find((f) => f.startsWith('app.') && f.endsWith('.css'))
const fontFace = `@font-face{font-family:Vazirmatn;src:url(./${fontName}) format("woff2");font-weight:100 900;font-display:swap}`
const css = fontFace + (await readFile(join(dist, 'assets', bundledCss), 'utf8'))
await rm(join(dist, 'assets', bundledCss))
const cssName = `app.${hashOf(css)}.css`
await writeFile(join(dist, 'assets', cssName), css)
const appCss = `./assets/${cssName}`

// static files
for (const entry of await readdir(join(root, 'public'))) {
  if (entry === 'index.html' || entry === 'config.example.js') continue
  await cp(join(root, 'public', entry), join(dist, entry), { recursive: true })
}

// Applies the saved theme before first paint. Inline, so the CSP carries its hash.
const themeScript =
  "try{var t=localStorage.getItem('hodhod.theme')||'system';document.documentElement.dataset.theme=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch(e){}"
const themeHash = createHash('sha256').update(themeScript).digest('base64')

const html = (await readFile(join(root, 'public/index.html'), 'utf8'))
  .replace('%APP_JS%', appJs)
  .replace('%APP_CSS%', appCss)
  .replace('%FONT_URL%', font)
  .replace('%THEME_SCRIPT%', themeScript)
  .replace('%THEME_SCRIPT_HASH%', themeHash)
await writeFile(join(dist, 'index.html'), html)

// service worker
const icons = (await readdir(join(dist, 'icons'))).map((f) => `./icons/${f}`)
const precache = ['./', './index.html', './manifest.webmanifest', appJs, appCss, font, ...icons]
const buildId = createHash('sha256').update(precache.join('|') + html).digest('hex').slice(0, 12)
const sw = await Bun.build({
  entrypoints: [join(root, 'src/sw.ts')],
  outdir: dist,
  target: 'browser',
  minify: !dev,
  naming: 'sw.js',
  define: { __BUILD_ID__: JSON.stringify(buildId), __PRECACHE__: JSON.stringify(precache) },
})
if (!sw.success) {
  for (const log of sw.logs) console.error(log)
  process.exit(1)
}

// GitHub Pages: serve files as they are
await writeFile(join(dist, '.nojekyll'), '')

const size = async (path: string) => ((await readFile(join(dist, path))).byteLength / 1024).toFixed(1)
console.log(`built ${pkg.version} (${buildId})`)
console.log(`  ${basename(appJs)}  ${await size(appJs)} kB`)
console.log(`  ${basename(appCss)}  ${await size(appCss)} kB`)
