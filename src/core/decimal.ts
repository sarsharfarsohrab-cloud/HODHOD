/**
 * Reads a number typed by a person: "4,90", "4.90", " 4 " and "1.234,5" all work, so a German
 * keyboard (which only has a comma) can type amounts. Returns NaN when it is not a number.
 */
export function parseDecimal(text: string): number {
  let s = text.trim().replace(/\s/g, '')
  if (s === '') return Number.NaN
  const comma = s.lastIndexOf(',')
  const dot = s.lastIndexOf('.')
  // the last separator is the decimal one; the other is a thousands separator
  if (comma > dot) s = s.replace(/\./g, '').replace(',', '.')
  else if (dot > comma && comma >= 0) s = s.replace(/,/g, '')
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return Number.NaN
  return Number(s)
}
