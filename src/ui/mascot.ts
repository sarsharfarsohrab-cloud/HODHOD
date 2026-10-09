/**
 * Hodhod, the hoopoe. Original artwork drawn as SVG.
 *
 * The rest of the app only asks for a mood; replacing the drawing (or loading
 * illustrated assets later) means changing this file alone. The bird's signature
 * is its crest: folded back when calm, fanned open when it is pleased.
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

const EYES: Record<Pose['eye'], string> = {
  open: '<circle cx="39" cy="45" r="3.6" fill="var(--m-ink)"/><circle cx="37.800" cy="43.800" r="1.200" fill="#fff"/>',
  wide: '<circle cx="39" cy="45" r="4.600" fill="#fff"/><circle cx="39" cy="45" r="3" fill="var(--m-ink)"/><circle cx="38" cy="44" r="1" fill="#fff"/>',
  smile: '<path d="M35 46 Q39 41.500 43 46" fill="none" stroke="var(--m-ink)" stroke-width="2.400" stroke-linecap="round"/>',
  closed: '<path d="M35 45 Q39 48.500 43 45" fill="none" stroke="var(--m-ink)" stroke-width="2.400" stroke-linecap="round"/>',
  up: '<circle cx="39" cy="45" r="4.200" fill="#fff"/><circle cx="40.200" cy="43.200" r="2.600" fill="var(--m-ink)"/>',
  soft: '<circle cx="39" cy="45.500" r="3.400" fill="var(--m-ink)"/><circle cx="37.800" cy="44.300" r="1.300" fill="#fff"/><path d="M34.500 40.500 Q38 38.800 42 40" fill="none" stroke="var(--m-ink)" stroke-width="1.400" stroke-linecap="round"/>',
}

const EXTRAS: Record<NonNullable<Pose['extras']>, string> = {
  sparkles:
    '<g fill="var(--m-spark)"><path d="M96 20l2.200 6.300L104.500 28.500 98.200 30.700 96 37l-2.200-6.300L87.500 28.500l6.300-2.200z"/><path d="M14 18l1.400 4 4 1.400-4 1.400-1.400 4-1.400-4-4-1.400 4-1.400z"/><circle cx="106" cy="50" r="2.200"/></g>',
  dots: '<g fill="var(--m-ink)" opacity=".55"><circle cx="84" cy="24" r="2.600"/><circle cx="93" cy="19" r="3.200"/><circle cx="104" cy="15" r="4"/></g>',
  zzz: '<g fill="none" stroke="var(--m-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".6"><path d="M86 26h7l-7 8h7"/><path d="M98 12h9l-9 10h9"/></g>',
  heart: '<path d="M98 30c-5-3.500-8-6.500-8-10a4.500 4.500 0 0 1 8-2.500A4.500 4.500 0 0 1 106 20c0 3.500-3 6.500-8 10z" fill="var(--m-blush)"/>',
  question: '<path d="M93 22a5.500 5.500 0 1 1 8 5c-1.500 1-2.500 2-2.500 4" fill="none" stroke="var(--m-ink)" stroke-width="2.600" stroke-linecap="round" opacity=".6"/><circle cx="98.500" cy="36" r="1.700" fill="var(--m-ink)" opacity=".6"/>',
}

const FEATHER =
  '<path d="M0 0C-4.500-8-4.200-22 0-29 4.200-22 4.500-8 0 0Z" fill="var(--m-body)"/><path d="M-3.300-20.500Q0-24.500 3.300-20.500 3-25.500 0-29-3-25.500-3.300-20.500Z" fill="var(--m-ink)"/><circle cx="0" cy="-19" r="1.150" fill="#fff"/>'

function markup(pose: Pose): string {
  const crest = pose.crest
    .map((angle, i) => `<g class="mascot-feather" style="transform:translate(49px,31px) rotate(${angle}deg);transition-delay:${i * 35}ms">${FEATHER}</g>`)
    .join('')
  return `
    <ellipse cx="62" cy="111" rx="26" ry="3.500" fill="var(--m-ink)" opacity=".12"/>
    <path d="M90 84l19 3-1 9-17 2z" fill="var(--m-ink)"/><path d="M97 85.200l4.500.700-.500 9.500-4.300.500z" fill="#fff"/>
    <g stroke="var(--m-ink)" stroke-width="2.600" stroke-linecap="round" fill="none"><path d="M56 101v8m-4 0h8M70 101v8m-4 0h8"/></g>
    <ellipse cx="64" cy="79" rx="30" ry="25" fill="var(--m-body)"/>
    <ellipse cx="55" cy="86" rx="17" ry="14" fill="var(--m-belly)"/>
    <path d="M62 62c16-6 34 2 36 18 1 10-9 19-23 19-10 0-17-7-17-16 0-9 0-18 4-21z" fill="var(--m-ink)"/>
    <g stroke="#fff" stroke-width="3.600" fill="none" stroke-linecap="round"><path d="M67 71q13-4 26 4M64 80.500q15-3 30 5M67 90q12-1 22 4.500"/></g>
    <g class="mascot-head" style="transform:rotate(${pose.tilt}deg);transform-origin:46px 60px">
      ${crest}
      <path d="M28 49Q13 51 4 61 16 57 30 54.500Z" fill="var(--m-ink)"/>
      <circle cx="45" cy="47" r="19" fill="var(--m-body)"/>
      <circle cx="49" cy="54" r="4.400" fill="var(--m-blush)" opacity=".55"/>
      ${EYES[pose.eye]}
    </g>
    ${pose.extras ? `<g class="mascot-extras">${EXTRAS[pose.extras]}</g>` : ''}`
}

/** Inner SVG markup of a pose (viewBox 0 0 120 120). Colours are CSS variables --m-*. */
export function mascotMarkup(mood: MascotMood): string {
  return markup(POSES[mood])
}

export function mascot(mood: MascotMood, options: { size?: number; label?: string } = {}): SVGSVGElement {
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

/** Changes the mood of a mascot already on screen (the crest animates between poses). */
export function setMascotMood(el: SVGSVGElement, mood: MascotMood): void {
  if (el.dataset.mood === mood) return
  const next = mascot(mood, { size: Number(el.getAttribute('width')) || 96, label: el.getAttribute('aria-label') ?? undefined })
  const feathers = el.querySelectorAll<SVGGElement>('.mascot-feather')
  const nextFeathers = next.querySelectorAll<SVGGElement>('.mascot-feather')
  if (feathers.length !== nextFeathers.length) {
    el.replaceWith(next)
    return
  }
  // keep the feather elements so their transforms transition; swap everything else
  feathers.forEach((feather, i) => (feather.style.transform = nextFeathers[i]!.style.transform))
  const head = el.querySelector<SVGGElement>('.mascot-head')!
  const nextHead = next.querySelector<SVGGElement>('.mascot-head')!
  head.style.transform = nextHead.style.transform
  for (const node of [...head.children]) if (!node.classList.contains('mascot-feather')) node.remove()
  for (const node of [...nextHead.children]) if (!node.classList.contains('mascot-feather')) head.appendChild(node)
  el.querySelector('.mascot-extras')?.remove()
  const extras = next.querySelector('.mascot-extras')
  if (extras) el.appendChild(extras)
  el.dataset.mood = mood
  el.setAttribute('class', `mascot mascot-${mood}`)
}
