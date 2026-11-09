/**
 * Number, date and duration formatting in the interface language. Persian keeps its own
 * wording (Persian digits, Gregorian dates); every other language uses Intl.
 */

let locale = 'fa-IR'
let isPersian = true
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat | Intl.RelativeTimeFormat>()

/** Called when the interface language changes (see i18n). */
export function setFormatLocale(intlLocale: string): void {
  locale = intlLocale
  isPersian = intlLocale.startsWith('fa')
  cache.clear()
}

export function formatLocale(): string {
  return locale
}

function nf(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `n:${key}`
  let f = cache.get(k) as Intl.NumberFormat | undefined
  if (!f) cache.set(k, (f = new Intl.NumberFormat(locale, options)))
  return f
}

function df(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `d:${key}`
  let f = cache.get(k) as Intl.DateTimeFormat | undefined
  // dates are always Gregorian, also for Persian and Arabic
  if (!f) cache.set(k, (f = new Intl.DateTimeFormat(`${locale}-u-ca-gregory`, options)))
  return f
}

const toDate = (iso: string | Date) => (typeof iso === 'string' ? new Date(iso) : iso)

export const num = (n: number) => nf('num', { useGrouping: true }).format(n)
export const fmtPlain = (n: number) => nf('plain', { useGrouping: false }).format(n)
export const fmtPercent = (ratio: number) => nf('pct', { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
export const fmtDate = (iso: string | Date) => df('date', { day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(iso))
export const fmtDateTime = (iso: string | Date) => df('dt', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(toDate(iso))
export const fmtWeekday = (date: Date) => df('wd', { weekday: 'narrow' }).format(date)

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** "۱۰ دقیقه", "۳ ساعت", "۴ روز", "۲ ماه", "۱٫۵ سال" — the size of an interval, without direction. */
export function fmtDuration(ms: number): string {
  const abs = Math.abs(ms)
  if (!isPersian) return intlDuration(abs)
  const oneDecimal = nf('1d', { maximumFractionDigits: 1 })
  if (abs < MIN) return 'کمتر از ۱ دقیقه'
  if (abs < HOUR) return `${num(Math.round(abs / MIN))} دقیقه`
  if (abs < DAY) return `${num(Math.round(abs / HOUR))} ساعت`
  const days = abs / DAY
  if (days < 31) return `${num(Math.round(days))} روز`
  if (days < 365) return `${oneDecimal.format(days / 30.44)} ماه`
  return `${oneDecimal.format(days / 365.25)} سال`
}

/** When something is due, relative to now: "الان", "۳ ساعت دیگر", "۲ روز پیش". */
export function fmtRelative(iso: string, now: Date): string {
  const diff = new Date(iso).getTime() - now.getTime()
  if (!isPersian) return intlRelative(diff)
  if (Math.abs(diff) < MIN) return 'الان'
  return diff > 0 ? `${fmtDuration(diff)} دیگر` : `${fmtDuration(diff)} پیش`
}

function unitFor(abs: number): [number, 'minute' | 'hour' | 'day' | 'month' | 'year'] {
  if (abs < HOUR) return [Math.max(1, Math.round(abs / MIN)), 'minute']
  if (abs < DAY) return [Math.round(abs / HOUR), 'hour']
  const days = abs / DAY
  if (days < 31) return [Math.round(days), 'day']
  if (days < 365) return [Math.round((days / 30.44) * 10) / 10, 'month']
  return [Math.round((days / 365.25) * 10) / 10, 'year']
}

function intlDuration(abs: number): string {
  const [value, unit] = unitFor(abs)
  return nf(`u:${unit}`, { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 }).format(value)
}

function intlRelative(diff: number): string {
  const k = 'r:auto'
  let f = cache.get(k) as Intl.RelativeTimeFormat | undefined
  if (!f) cache.set(k, (f = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })))
  if (Math.abs(diff) < MIN) return f.format(0, 'second')
  const [value, unit] = unitFor(Math.abs(diff))
  return f.format(diff > 0 ? value : -value, unit)
}

export { foldGerman, foldPersian } from '../core/text.ts'
