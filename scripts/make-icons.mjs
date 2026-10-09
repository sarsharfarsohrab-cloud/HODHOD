// Regenerates the app icons from the mascot drawing. Needs the "sharp" package:
//   NODE_PATH=$(npm root -g) bun run scripts/make-icons.mjs
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { mascotMarkup } from '../src/ui/mascot.ts'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const COLORS = { '--m-body': '#f5a04a', '--m-belly': '#fddcae', '--m-ink': '#2c2945', '--m-blush': '#f0766a', '--m-spark': '#5546d6' }
const BACKGROUND = '#fff0dc'

const bird = mascotMarkup('happy').replace(/var\((--m-[a-z]+)\)/g, (_, name) => COLORS[name])
// CSS transforms in the markup → SVG attributes, which every rasteriser understands
const portable = bird
  .replace(/style="transform:translate\(([\d.]+)px,([\d.]+)px\) rotate\((-?[\d.]+)deg\);transition-delay:\d+ms"/g, 'transform="translate($1 $2) rotate($3)"')
  .replace(/style="transform:rotate\((-?[\d.]+)deg\);transform-origin:([\d.]+)px ([\d.]+)px"/g, 'transform="rotate($1 $2 $3)"')

/** `inset` is the share of the canvas kept free around the bird (maskable icons need a safe zone). */
const svg = (inset, rounded) => {
  const scale = 1 - inset * 2
  const offset = 60 * (1 - scale)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
  <rect width="120" height="120" rx="${rounded ? 26 : 0}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset + 2} ${offset + 1}) scale(${scale})">${portable}</g>
</svg>`
}

const out = new URL('../public/icons/', import.meta.url).pathname
await mkdir(out, { recursive: true })
const png = (markup, size, file) => sharp(Buffer.from(markup), { density: 600 }).resize(size, size).png().toFile(out + file)

await writeFile(out + 'favicon.svg', svg(0.06, true))
await png(svg(0.06, true), 192, 'icon-192.png')
await png(svg(0.06, true), 512, 'icon-512.png')
await png(svg(0.16, false), 512, 'maskable-512.png')
await png(svg(0.1, false), 180, 'apple-touch-icon.png') // iOS rounds the corners itself
console.log('icons written to public/icons')
