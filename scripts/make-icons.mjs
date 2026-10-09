// Regenerates the app icons from the mascot drawing. Needs the "sharp" package:
//   NODE_PATH=$(npm root -g) bun run scripts/make-icons.mjs
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { mascotDocument } from '../src/ui/mascot.ts'

const require = createRequire(import.meta.url)
const sharp = require('sharp')

const COLORS = {
  '--m-body': '#f59a3e', '--m-body-hi': '#ffc98a', '--m-body-lo': '#d9741f', '--m-belly': '#fff1da', '--m-belly-lo': '#f6cf99',
  '--m-ink': '#262341', '--m-ink-hi': '#4d497a', '--m-eye': '#211e3a', '--m-blush': '#ee6f66', '--m-spark': '#5546d6',
}
const BACKGROUND = '#fff0dc'

// the bird as a stand-alone drawing; CSS transforms → SVG attributes, which every rasteriser understands
const document = mascotDocument('happy', COLORS)
const portable = document
  .replace(/^<svg[^>]*>/, '')
  .replace(/<\/svg>$/, '')
  .replace(/style="transform:translate\(([\d.]+)px,([\d.]+)px\) rotate\((-?[\d.]+)deg\);transition-delay:\d+ms"/g, 'transform="translate($1 $2) rotate($3)"')
  .replace(/style="transform:rotate\((-?[\d.]+)deg\);transform-origin:([\d.]+)px ([\d.]+)px"/g, 'transform="rotate($1 $2 $3)"')
  .replace(/style="stop-color:(#[0-9a-f]+);stop-opacity:([\d.]+)"/g, 'stop-color="$1" stop-opacity="$2"')
  .replace(/style="stop-color:(#[0-9a-f]+)"/g, 'stop-color="$1"')

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
