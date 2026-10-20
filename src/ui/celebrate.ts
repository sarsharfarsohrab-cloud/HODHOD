/**
 * Big moments: a full-screen celebration when a streak reaches a milestone.
 * Each milestone is celebrated once (remembered in the settings, and on the device).
 */
import { computeStreak } from '../core/activity.ts'
import type { Ctx } from './context.ts'
import { h } from './dom.ts'
import { fa } from './format.ts'
import { burst, mascot } from './mascot.ts'
import { t } from './strings.ts'

export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 150, 200, 365] as const
const LOCAL_KEY = 'hodhod.celebrated'

function localCelebrated(userId: string): number[] {
  try {
    return (JSON.parse(localStorage.getItem(`${LOCAL_KEY}.${userId}`) ?? '[]') as number[]).filter(Number.isFinite)
  } catch {
    return []
  }
}

function rememberLocally(userId: string, list: number[]): void {
  try {
    localStorage.setItem(`${LOCAL_KEY}.${userId}`, JSON.stringify(list))
  } catch {
    // storage blocked: the server copy still prevents most repeats
  }
}

/** The milestone reached today that has not been celebrated yet, if any. */
export function pendingMilestone(ctx: Ctx): number | null {
  const streak = computeStreak(ctx.data.activity, ctx.now())
  if (!streak.activeToday) return null
  const done = new Set([...ctx.data.settings.celebratedStreaks, ...localCelebrated(ctx.data.userId)])
  const reached = STREAK_MILESTONES.filter((m) => m <= streak.current && !done.has(m))
  // only the milestone of today counts; older ones missed while away are marked silently
  const today = reached.find((m) => m === streak.current) ?? null
  if (reached.length > 0) {
    const list = [...done, ...reached].sort((a, b) => a - b)
    rememberLocally(ctx.data.userId, list)
    void ctx.data.updateSettings({ celebratedStreaks: list }).catch(() => undefined)
  }
  return today
}

function confetti(): HTMLElement {
  const colors = ['#f5922b', '#5546d6', '#fff1da', '#14936a', '#ef4f7a', '#2468dc']
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' })
  for (let i = 0; i < 60; i++) {
    const piece = h('i')
    piece.style.left = `${Math.random() * 100}%`
    piece.style.background = colors[i % colors.length]!
    piece.style.animationDuration = `${2.2 + Math.random() * 2}s`
    piece.style.animationDelay = `${Math.random() * 0.8}s`
    piece.style.transform = `rotate(${Math.random() * 180}deg)`
    layer.appendChild(piece)
  }
  return layer
}

/** Shows the celebration for `days` in a row; resolves when it is closed. */
export function celebrateStreak(days: number): Promise<void> {
  return new Promise((resolve) => {
    const close = () => {
      overlay.remove()
      document.removeEventListener('keydown', onKey)
      resolve()
    }
    const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && close()
    const bird = mascot(days >= 30 ? 'trophy' : 'streak', { size: 190, enter: 'fly' })
    const button = h('button', { class: 'btn primary big block', type: 'button', onclick: close }, t.celebrate.continue)
    const overlay = h(
      'div',
      { class: 'celebration', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.celebrate.title(days) },
      confetti(),
      h(
        'div',
        { class: 'celebration-inner' },
        bird,
        h('div', { class: 'celebration-number' }, fa(days)),
        h('h2', null, t.celebrate.title(days)),
        h('p', null, t.celebrate.body(days)),
        button,
      ),
    )
    document.body.appendChild(overlay)
    document.addEventListener('keydown', onKey)
    button.focus()
    setTimeout(() => overlay.isConnected && burst(bird, 'stars', 12), 1200)
  })
}
