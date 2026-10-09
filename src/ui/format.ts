/** Number, date and duration formatting for the Persian interface (Persian digits, Gregorian dates). */

const number = new Intl.NumberFormat('fa-IR', { useGrouping: true })
const plain = new Intl.NumberFormat('fa-IR', { useGrouping: false })
const oneDecimal = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 })
const percent = new Intl.NumberFormat('fa-IR', { style: 'percent', maximumFractionDigits: 0 })
const dateFormat = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', year: 'numeric' })
const dateTimeFormat = new Intl.DateTimeFormat('fa-IR-u-ca-gregory', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
const weekdayFormat = new Intl.DateTimeFormat('fa-IR', { weekday: 'narrow' })

export const fa = (n: number) => number.format(n)
export const faPlain = (n: number) => plain.format(n)
export const faPercent = (ratio: number) => percent.format(ratio)
export const faDate = (iso: string | Date) => dateFormat.format(typeof iso === 'string' ? new Date(iso) : iso)
export const faDateTime = (iso: string | Date) => dateTimeFormat.format(typeof iso === 'string' ? new Date(iso) : iso)
export const faWeekday = (date: Date) => weekdayFormat.format(date)

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

/** "۱۰ دقیقه", "۳ ساعت", "۴ روز", "۲ ماه", "۱٫۵ سال" — the size of an interval, without direction. */
export function faDuration(ms: number): string {
  const abs = Math.abs(ms)
  if (abs < MIN) return 'کمتر از ۱ دقیقه'
  if (abs < HOUR) return `${fa(Math.round(abs / MIN))} دقیقه`
  if (abs < DAY) return `${fa(Math.round(abs / HOUR))} ساعت`
  const days = abs / DAY
  if (days < 31) return `${fa(Math.round(days))} روز`
  if (days < 365) return `${oneDecimal.format(days / 30.44)} ماه`
  return `${oneDecimal.format(days / 365.25)} سال`
}

/** When something is due, relative to now: "الان", "۳ ساعت دیگر", "۲ روز پیش". */
export function faRelative(iso: string, now: Date): string {
  const diff = new Date(iso).getTime() - now.getTime()
  if (Math.abs(diff) < MIN) return 'الان'
  return diff > 0 ? `${faDuration(diff)} دیگر` : `${faDuration(diff)} پیش`
}

/** Folds Persian/Arabic letter variants and half-spaces so search matches what people type. */
export function foldPersian(text: string): string {
  return text
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[ۀة]/g, 'ه')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[‌‍ً-ْ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Lower-cases German and folds umlauts/ß so "strasse", "Straße" and "apfel"/"Äpfel" find each other. */
export function foldGerman(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}
