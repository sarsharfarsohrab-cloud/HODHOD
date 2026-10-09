/**
 * Hodhod, the hoopoe. Original artwork drawn as SVG.
 *
 * The rest of the app only asks for a mood; replacing the drawing (or loading
 * illustrated assets later) means changing this file alone. The bird's signature
 * is its crest: folded back when calm, fanned open when it is pleased.
 *
 * Volume comes from gradients (light from the upper left) and a soft ground shadow.
 * The gradients are defined once per page in a shared, invisible <svg>, so every
 * bird on the page can use them however often it is drawn.
 */
import { svg } from './dom.ts'

export type MascotMood =
  | 'idle'
  | 'happy'
  | 'excited'
  | 'celebrating'
  | 'thinking'
  | 'encouraging'
  | 'proud'
  | 'surprised'
  | 'confused'
  | 'sleepy'
  | 'supportive'
  | 'disappointed'

interface Pose {
  /** Angle of each of the five crest feathers in degrees (0 = straight up, positive = swept back). */
  crest: [number, number, number, number, number]
  eye: 'open' | 'smile' | 'closed' | 'up' | 'wide' | 'soft'
  /** Head tilt in degrees. */
  tilt: number
  extras?: 'sparkles' | 'dots' | 'zzz' | 'heart' | 'question'
}

const FOLDED: Pose['crest'] = [52, 60, 68, 76, 84]
const HALF: Pose['crest'] = [10, 28, 46, 62, 78]
const OPEN: Pose['crest'] = [-38, -14, 10, 34, 58]
const WIDE: Pose['crest'] = [-52, -24, 4, 32, 60]

const POSES: Record<MascotMood, Pose> = {
  idle: { crest: HALF, eye: 'open', tilt: 0 },
  happy: { crest: OPEN, eye: 'smile', tilt: -4 },
  excited: { crest: WIDE, eye: 'wide', tilt: -6, extras: 'sparkles' },
  celebrating: { crest: WIDE, eye: 'smile', tilt: -8, extras: 'sparkles' },
  thinking: { crest: FOLDED, eye: 'up', tilt: 6, extras: 'dots' },
  encouraging: { crest: OPEN, eye: 'soft', tilt: -3 },
  proud: { crest: WIDE, eye: 'smile', tilt: -10, extras: 'heart' },
  surprised: { crest: WIDE, eye: 'wide', tilt: 4 },
  confused: { crest: HALF, eye: 'up', tilt: 10, extras: 'question' },
  sleepy: { crest: FOLDED, eye: 'closed', tilt: 8, extras: 'zzz' },
  supportive: { crest: HALF, eye: 'soft', tilt: -3, extras: 'heart' },
  disappointed: { crest: FOLDED, eye: 'soft', tilt: 7 },
}

/** Gradients shared by every bird on the page. Colours come from CSS variables (--m-*), so themes apply. */
const DEFS = `
  <radialGradient id="hh-body" cx="34%" cy="26%" r="82%">
    <stop offset="0" style="stop-color:var(--m-body-hi)"/><stop offset=".55" style="stop-color:var(--m-body)"/><stop offset="1" style="stop-color:var(--m-body-lo)"/>
  </radialGradient>
  <radialGradient id="hh-belly" cx="40%" cy="30%" r="75%">
    <stop offset="0" style="stop-color:var(--m-belly)"/><stop offset="1" style="stop-color:var(--m-belly-lo)"/>
  </radialGradient>
  <linearGradient id="hh-ink" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" style="stop-color:var(--m-ink-hi)"/><stop offset="1" style="stop-color:var(--m-ink)"/>
  </linearGradient>
  <linearGradient id="hh-feather" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0" style="stop-color:var(--m-body-lo)"/><stop offset=".6" style="stop-color:var(--m-body)"/><stop offset="1" style="stop-color:var(--m-body-hi)"/>
  </linearGradient>
  <radialGradient id="hh-shadow">
    <stop offset="0" style="stop-color:var(--m-ink);stop-opacity:.3"/><stop offset="1" style="stop-color:var(--m-ink);stop-opacity:0"/>
  </radialGradient>
  <radialGradient id="hh-blush">
    <stop offset="0" style="stop-color:var(--m-blush);stop-opacity:.75"/><stop offset="1" style="stop-color:var(--m-blush);stop-opacity:0"/>
  </radialGradient>`

const EYES: Record<Pose['eye'], string> = {
  open: '<g class="m-eye-open"><circle cx="39" cy="45" r="4.700" fill="#fff"/><circle cx="39.300" cy="45.200" r="3.500" fill="var(--m-eye)"/><circle cx="37.900" cy="43.700" r="1.300" fill="#fff"/><circle cx="40.700" cy="46.600" r=".600" fill="#fff" opacity=".8"/></g>',
  wide: '<circle cx="39" cy="45" r="5.400" fill="#fff"/><circle cx="39" cy="45" r="3.200" fill="var(--m-eye)"/><circle cx="37.700" cy="43.700" r="1.200" fill="#fff"/>',
  smile: '<path d="M34.500 46.500Q39 41 43.500 46.500" fill="none" stroke="var(--m-eye)" stroke-width="2.600" stroke-linecap="round"/>',
  closed: '<path d="M34.500 45Q39 49 43.500 45" fill="none" stroke="var(--m-eye)" stroke-width="2.600" stroke-linecap="round"/>',
  up: '<circle cx="39" cy="45" r="4.700" fill="#fff"/><circle cx="40.300" cy="43.200" r="2.800" fill="var(--m-eye)"/><circle cx="39.500" cy="42.300" r=".900" fill="#fff"/>',
  soft: '<g class="m-eye-open"><circle cx="39" cy="45.500" r="4.400" fill="#fff"/><circle cx="39.200" cy="45.800" r="3.300" fill="var(--m-eye)"/><circle cx="37.900" cy="44.400" r="1.300" fill="#fff"/></g><path d="M34 40Q38 38.200 42.500 39.600" fill="none" stroke="var(--m-eye)" stroke-width="1.500" stroke-linecap="round"/>',
}

const EXTRAS: Record<NonNullable<Pose['extras']>, string> = {
  sparkles:
    '<g fill="var(--m-spark)"><path d="M96 20l2.200 6.300L104.500 28.500 98.200 30.700 96 37l-2.200-6.300L87.500 28.500l6.300-2.200z"/><path d="M14 18l1.400 4 4 1.400-4 1.400-1.400 4-1.400-4-4-1.400 4-1.400z"/><circle cx="106" cy="50" r="2.200"/></g>',
  dots: '<g fill="var(--m-spark)" opacity=".7"><circle cx="84" cy="24" r="2.600"/><circle cx="93" cy="19" r="3.200"/><circle cx="104" cy="15" r="4"/></g>',
  zzz: '<g fill="none" stroke="var(--m-spark)" stroke-width="2.200" stroke-linecap="round" stroke-linejoin="round" opacity=".75"><path d="M86 26h7l-7 8h7"/><path d="M98 12h9l-9 10h9"/></g>',
  heart: '<path d="M98 30c-5-3.500-8-6.500-8-10a4.500 4.500 0 0 1 8-2.500A4.500 4.500 0 0 1 106 20c0 3.500-3 6.500-8 10z" fill="var(--m-blush)"/><path d="M93.500 19.500a2 2 0 0 1 2.500-1.500" fill="none" stroke="#fff" stroke-width="1.200" stroke-linecap="round" opacity=".7"/>',
  question: '<path d="M93 22a5.500 5.500 0 1 1 8 5c-1.500 1-2.500 2-2.500 4" fill="none" stroke="var(--m-spark)" stroke-width="2.800" stroke-linecap="round" opacity=".8"/><circle cx="98.500" cy="36" r="1.800" fill="var(--m-spark)" opacity=".8"/>',
}

const FEATHER =
  '<path d="M0 0C-4.800-8-4.400-22 0-29.500 4.400-22 4.800-8 0 0Z" fill="url(#hh-feather)"/><path d="M-3.400-20.500Q0-24.800 3.400-20.500 3.100-25.800 0-29.500-3.100-25.800-3.400-20.500Z" fill="var(--m-ink)"/><circle cx="0" cy="-18.800" r="1.200" fill="#fff"/><path d="M-1.300-4C-2.400-10-2.300-16-1-21" fill="none" stroke="#fff" stroke-width=".900" stroke-linecap="round" opacity=".35"/>'

const face = (pose: Pose) => `<g class="m-face">${EYES[pose.eye]}</g>`

function markup(pose: Pose): string {
  const crest = pose.crest
    .map((angle, i) => `<g class="mascot-feather" style="transform:translate(49px,31px) rotate(${angle}deg);transition-delay:${i * 35}ms">${FEATHER}</g>`)
    .join('')
  return `
    <ellipse cx="62" cy="111" rx="29" ry="5" fill="url(#hh-shadow)"/>
    <g class="m-bob">
      <g class="m-tail"><path d="M89 83l21 3.500-1.200 9.500L90 98z" fill="url(#hh-ink)"/><path d="M97 84.300l4.800.800-.600 9.700-4.500.500z" fill="#fff"/><path d="M104.500 85.600l3 .500-.800 9.200-2.800.300z" fill="#fff" opacity=".85"/></g>
      <g stroke="var(--m-ink)" stroke-width="2.800" stroke-linecap="round" fill="none"><path d="M56 100v9m-4.500 0h9M70 100v9m-4.500 0h9"/></g>
      <ellipse cx="64" cy="79" rx="30.500" ry="25.500" fill="url(#hh-body)"/>
      <ellipse cx="54.500" cy="86" rx="17.500" ry="14.500" fill="url(#hh-belly)"/>
      <path d="M40 70Q44 58 58 55.500" fill="none" stroke="#fff" stroke-width="2.600" stroke-linecap="round" opacity=".28"/>
      <g class="m-wing">
        <path d="M62 62c16-6 34 2 36 18 1 10-9 19-23 19-10 0-17-7-17-16 0-9 0-18 4-21z" fill="url(#hh-ink)"/>
        <g stroke="#fff" stroke-width="3.700" fill="none" stroke-linecap="round"><path d="M67 71q13-4 26 4M64 80.500q15-3 30 5M67 90q12-1 22 4.500"/></g>
        <path d="M63.500 64.500Q76 59.500 89 66" fill="none" stroke="#fff" stroke-width="1.400" stroke-linecap="round" opacity=".3"/>
      </g>
      <g class="mascot-head" style="transform:rotate(${pose.tilt}deg);transform-origin:46px 60px">
        ${crest}
        <path d="M28 48.500Q13 50.500 3.500 61 16 57.500 30.500 54.500Z" fill="url(#hh-ink)"/>
        <path d="M27.500 50.800Q15 53 6.500 59.500" fill="none" stroke="#fff" stroke-width="1.100" stroke-linecap="round" opacity=".3"/>
        <circle cx="45" cy="47" r="19.500" fill="url(#hh-body)"/>
        <path d="M31 40Q35.500 31 46 29.500" fill="none" stroke="#fff" stroke-width="2.800" stroke-linecap="round" opacity=".32"/>
        <circle cx="50" cy="55" r="6.500" fill="url(#hh-blush)"/>
        ${face(pose)}
      </g>
    </g>
    ${pose.extras ? `<g class="mascot-extras">${EXTRAS[pose.extras]}</g>` : ''}`
}

/** Puts the shared gradients on the page once. Zero-sized but rendered, so references always resolve. */
function ensureDefs(): void {
  if (typeof document === 'undefined' || document.getElementById('hh-defs')) return
  const holder = svg(`<defs>${DEFS}</defs>`, { id: 'hh-defs', width: '0', height: '0', 'aria-hidden': 'true', focusable: 'false' })
  holder.style.position = 'absolute'
  document.body.appendChild(holder)
}

/** A complete, self-contained SVG document of the bird (for icons and other files outside the app). */
export function mascotDocument(mood: MascotMood, colors: Record<string, string>): string {
  const resolve = (text: string) => text.replace(/var\((--m-[a-z-]+)\)/g, (_, name: string) => colors[name] ?? '#000')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs>${resolve(DEFS)}</defs>${resolve(markup(POSES[mood]))}</svg>`
}

export function mascot(mood: MascotMood, options: { size?: number; label?: string } = {}): SVGSVGElement {
  ensureDefs()
  const size = String(options.size ?? 96)
  const el = svg(markup(POSES[mood]), {
    viewBox: '0 0 120 120',
    width: size,
    height: size,
    class: `mascot mascot-${mood}`,
    role: 'img',
    'aria-label': options.label ?? 'هدهد',
  })
  el.dataset.mood = mood
  return el
}

/** Changes the mood of a bird already on screen: crest and head move to the new pose instead of jumping. */
export function setMascotMood(el: SVGSVGElement, mood: MascotMood): void {
  if (el.dataset.mood === mood) return
  const pose = POSES[mood]
  const feathers = el.querySelectorAll<SVGGElement>('.mascot-feather')
  pose.crest.forEach((angle, i) => feathers[i] && (feathers[i].style.transform = `translate(49px,31px) rotate(${angle}deg)`))
  const head = el.querySelector<SVGGElement>('.mascot-head')
  if (head) head.style.transform = `rotate(${pose.tilt}deg)`
  const holder = svg(`${face(pose)}${pose.extras ? `<g class="mascot-extras">${EXTRAS[pose.extras]}</g>` : ''}`)
  el.querySelector('.m-face')?.replaceWith(holder.querySelector('.m-face')!)
  el.querySelector('.mascot-extras')?.remove()
  const extras = holder.querySelector('.mascot-extras')
  if (extras) el.appendChild(extras)
  el.dataset.mood = mood
  // restart the mood's entrance animation (wing flap, hop) even when the class was there before
  el.setAttribute('class', 'mascot')
  void el.getBoundingClientRect()
  el.setAttribute('class', `mascot mascot-${mood}`)
}

const reactionTimers = new WeakMap<SVGSVGElement, ReturnType<typeof setTimeout>>()

/** Shows a mood for a moment — a reaction to something the learner did — then returns to `after`. */
export function reactMascot(el: SVGSVGElement, mood: MascotMood, after: MascotMood = 'idle', ms = 1600): void {
  clearTimeout(reactionTimers.get(el))
  setMascotMood(el, mood)
  reactionTimers.set(el, setTimeout(() => el.isConnected && setMascotMood(el, after), ms))
}
