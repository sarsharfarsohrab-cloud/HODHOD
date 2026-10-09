import type { AudioPlayer } from '../audio/audio.ts'
import type { Scheduler } from '../core/scheduler.ts'
import type { AppData } from '../data/appData.ts'
import type { SupabaseClient } from '../data/supabase.ts'

export interface ConfirmOptions {
  title: string
  body?: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

/** Everything a screen may use. Screens never reach for globals. */
export interface Ctx {
  client: SupabaseClient
  data: AppData
  audio: AudioPlayer
  /** The scheduler configured with the learner's current retention target. */
  scheduler(): Scheduler
  go(path: string, options?: { replace?: boolean }): void
  toast(message: string, kind?: 'info' | 'error'): void
  confirm(options: ConfirmOptions): Promise<boolean>
  now(): Date
}

export interface Screen {
  el: HTMLElement
  /** Called when the account's data changed (sync finished, a review was stored, …). */
  onData?(): void
  destroy?(): void
  /** False hides the main navigation (focused flows such as a study session). */
  nav?: boolean
  /** Return false to veto leaving the screen (e.g. an unsaved draft). */
  canLeave?(): boolean | Promise<boolean>
}

export type ScreenFactory = (ctx: Ctx, params: Record<string, string>) => Screen
