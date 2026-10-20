/**
 * Hodhod, the hoopoe — illustrated poses (public/mascot/*.webp).
 *
 * The rest of the app only asks for a mood; this file decides which picture and which
 * movement go with it. A bird already on screen changes mood in place (the picture
 * pops to the new pose), and can arrive flying in with flapping wings.
 */
import { h } from './dom.ts'

export type MascotMood =
  | 'idle'
  | 'morning'
  | 'happy'
  | 'excited'
  | 'celebrating'
  | 'proud'
  | 'thinking'
  | 'encouraging'
  | 'sad'
  | 'disappointed'
  | 'supportive'
  | 'comforting'
  | 'surprised'
  | 'sleepy'
  | 'confused'
  | 'reading'
  | 'card'
  | 'writing'
  | 'teacher'
  | 'streak'
  | 'trophy'
  | 'waiting'
  | 'goodbye'
  | 'pointing'

type Picture =
  | 'idle' | 'morning' | 'happy' | 'celebrating' | 'proud' | 'thinking' | 'encouraging' | 'sad' | 'comforting' | 'surprised' | 'sleepy'
  | 'confused' | 'reading' | 'card' | 'writing' | 'teacher' | 'streak' | 'trophy' | 'waiting' | 'goodbye' | 'pointing'

/** Moods that share a picture with another mood (kept so older call sites keep working). */
const PICTURE: Record<MascotMood, Picture> = {
  idle: 'idle', morning: 'morning', happy: 'happy', excited: 'happy', celebrating: 'celebrating', proud: 'proud', thinking: 'thinking',
  encouraging: 'encouraging', sad: 'sad', disappointed: 'sad', supportive: 'comforting', comforting: 'comforting', surprised: 'surprised',
  sleepy: 'sleepy', confused: 'confused', reading: 'reading', card: 'card', writing: 'writing', teacher: 'teacher', streak: 'streak',
  trophy: 'trophy', waiting: 'waiting', goodbye: 'goodbye', pointing: 'pointing',
}

/** The movement that plays when a mood starts. */
const MOVE: Partial<Record<MascotMood, string>> = {
  happy: 'hop', excited: 'hop', celebrating: 'jump', proud: 'puff', encouraging: 'nod', surprised: 'jolt', sad: 'droop', disappointed: 'droop',
  supportive: 'sway', comforting: 'sway', confused: 'tilt', morning: 'wave', goodbye: 'wave', trophy: 'jump', streak: 'puff', thinking: 'tilt',
}

const src = (picture: Picture) => `./mascot/${picture}.webp`

let preloaded = false
/** Loads every pose once in the background, so mood changes never flash. */
export function preloadMascot(): void {
  if (preloaded || typeof Image === 'undefined') return
  preloaded = true
  const all = [...new Set(Object.values(PICTURE)), 'fly-sprite'] as string[]
  const load = () => all.forEach((name) => (new Image().src = `./mascot/${name}.webp`))
  if ('requestIdleCallback' in window) (window as Window & { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(load)
  else setTimeout(load, 1500)
}

export type MascotEl = HTMLElement

export interface MascotOptions {
  size?: number
  label?: string
  /** How the bird appears: flying in from above, a small hop, or simply there. */
  enter?: 'fly' | 'hop' | 'none'
}

export function mascot(mood: MascotMood, options: MascotOptions = {}): MascotEl {
  const size = options.size ?? 96
  const img = h('img', { src: src(PICTURE[mood]), alt: '', draggable: false, decoding: 'async', width: size, height: size })
  const el = h(
    'span',
    { class: `mascot mood-${mood}`, role: 'img', 'aria-label': options.label ?? 'هدهد', style: { width: `${size}px`, height: `${size}px` } },
    h('span', { class: 'm-body' }, img),
    h('span', { class: 'm-wings', 'aria-hidden': 'true', style: { backgroundImage: 'url(./mascot/fly-sprite.webp)' } }),
  )
  el.dataset.mood = mood
  if (options.enter === 'fly') flyIn(el)
  else if (options.enter === 'hop') play(el, 'hop')
  else if (MOVE[mood] && options.enter !== 'none') play(el, MOVE[mood]!)
  return el
}

function play(el: MascotEl, move: string): void {
  const body = el.querySelector<HTMLElement>('.m-body')
  if (!body) return
  body.dataset.move = ''
  void body.offsetWidth // restart even when the same move plays again
  body.dataset.move = move
}

/** The bird flies in from above with flapping wings and lands in its pose. */
export function flyIn(el: MascotEl): void {
  el.classList.remove('flying')
  void el.offsetWidth
  el.classList.add('flying')
  const done = () => el.classList.remove('flying')
  el.addEventListener('animationend', (e) => e.target === el && done(), { once: true })
  setTimeout(done, 2000) // in case animations are switched off
}

/** Changes the mood of a bird already on screen. */
export function setMascotMood(el: MascotEl, mood: MascotMood): void {
  if (el.dataset.mood === mood) return
  el.dataset.mood = mood
  el.className = el.className.replace(/\bmood-[a-z]+\b/, `mood-${mood}`)
  const img = el.querySelector('img')
  const next = src(PICTURE[mood])
  if (img && !img.src.endsWith(next.slice(1))) {
    const swap = () => {
      img.src = next
      play(el, MOVE[mood] ?? 'pop')
    }
    const probe = new Image()
    probe.src = next
    // swap once decoded, so the old pose never blinks away first
    probe.decode().then(swap, swap)
  } else {
    play(el, MOVE[mood] ?? 'pop')
  }
}

const reactionTimers = new WeakMap<MascotEl, ReturnType<typeof setTimeout>>()

/** Shows a mood for a moment — a reaction to something the learner did — then returns to `after`. */
export function reactMascot(el: MascotEl, mood: MascotMood, after: MascotMood = 'idle', ms = 1600): void {
  clearTimeout(reactionTimers.get(el))
  setMascotMood(el, mood)
  reactionTimers.set(el, setTimeout(() => el.isConnected && setMascotMood(el, after), ms))
}

/**
 * A short burst of small shapes around an element (hearts for a right answer, stars for
 * a streak). Purely decorative; nothing happens when motion is reduced.
 */
export function burst(anchor: Element, kind: 'hearts' | 'stars' | 'sparks' = 'sparks', count = 9): void {
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const rect = anchor.getBoundingClientRect()
  const layer = h('div', { class: 'burst', 'aria-hidden': 'true', style: { left: `${rect.left + rect.width / 2}px`, top: `${rect.top + rect.height / 2}px` } })
  const glyph = kind === 'hearts' ? '❤' : kind === 'stars' ? '★' : '✦'
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const distance = 46 + Math.random() * 44
    const piece = h('span', { class: `burst-piece ${kind}` }, glyph)
    piece.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
    piece.style.setProperty('--dy', `${Math.sin(angle) * distance - 20}px`)
    piece.style.setProperty('--r', `${Math.round(Math.random() * 60 - 30)}deg`)
    piece.style.animationDelay = `${Math.random() * 90}ms`
    layer.appendChild(piece)
  }
  document.body.appendChild(layer)
  setTimeout(() => layer.remove(), 1300)
}
