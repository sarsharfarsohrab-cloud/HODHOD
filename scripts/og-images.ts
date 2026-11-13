/**
 * Draws the link-preview picture (what WhatsApp, Telegram, iMessage… show when the site is shared)
 * for every site language, from the same words as the page itself, so it never says something the
 * site no longer says.
 *
 *   NODE_PATH=$(npm root -g) bun run scripts/og-images.ts   → site/img/og/<lang>.jpg (1200 × 630)
 *
 * Run it again whenever hero.eyebrow or hero.h1 change in scripts/site/copy.ts.
 */
import { mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { SITE_COPY } from './site/copy.ts'
import { SITE_LANGUAGES } from './site/page.ts'

const root = new URL('..', import.meta.url).pathname
const font = readFileSync(`${root}src/ui/fonts/Vazirmatn-wght.woff2`).toString('base64')
const bird = readFileSync(`${root}site/img/celebrating.webp`).toString('base64')
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

const page = (lang: string) => {
  const c = SITE_COPY[lang as keyof typeof SITE_COPY]
  const rtl = lang === 'fa' || lang === 'ar'
  const name = lang === 'fa' ? 'هدهد' : lang === 'ar' ? 'هدهد' : 'Hodhod'
  return `<!doctype html><html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
@font-face { font-family: V; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; overflow: hidden; font-family: V, sans-serif; color: #f1effc;
  background: radial-gradient(circle at ${rtl ? '22%' : '78%'} 45%, #3d3470 0, #241f45 46%, #1a1633 100%);
  display: grid; grid-template-columns: 1fr 470px; align-items: center; padding: 0 70px; gap: 30px; }
.text { display: grid; gap: 26px; }
.eyebrow { justify-self: start; font-size: 30px; font-weight: 700; color: #ffb766; }
h1 { font-size: ${lang === 'fa' || lang === 'ar' ? 66 : 62}px; line-height: 1.3; font-weight: 800; text-wrap: balance; }
.foot { display: flex; align-items: center; gap: 18px; }
.name { font-size: 40px; font-weight: 900; }
.url { font-size: 26px; font-weight: 700; color: #241f45; background: #f5922b; padding: 6px 22px 9px; border-radius: 999px; direction: ltr; }
img { width: 470px; height: 470px; object-fit: contain; filter: drop-shadow(0 20px 40px rgb(0 0 0 / 35%)); }
</style></head><body>
<div class="text"><p class="eyebrow">${esc(c.hero.eyebrow)}</p><h1>${esc(c.hero.h1)}</h1>
<div class="foot"><span class="name">${name}</span><span class="url">apphodhod.com</span></div></div>
<img src="data:image/webp;base64,${bird}" alt="">
</body></html>`
}

const { chromium } = createRequire(import.meta.url)('playwright')
mkdirSync(`${root}site/img/og`, { recursive: true })
const browser = await chromium.launch()
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
for (const lang of SITE_LANGUAGES) {
  await tab.setContent(page(lang))
  await tab.evaluate(() => document.fonts.ready)
  await tab.screenshot({ path: `${root}site/img/og/${lang}.jpg`, type: 'jpeg', quality: 84 })
  console.log(lang)
}
await browser.close()
