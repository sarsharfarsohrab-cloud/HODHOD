import { expect, test } from 'bun:test'
import { parseDecimal } from '../../src/core/decimal.ts'

test('amounts typed with a comma or a dot', () => {
  expect(parseDecimal('4,90')).toBe(4.9)
  expect(parseDecimal('4.90')).toBe(4.9)
  expect(parseDecimal(' 5 ')).toBe(5)
  expect(parseDecimal('1.234,5')).toBe(1234.5)
  expect(parseDecimal('1,234.5')).toBe(1234.5)
  expect(parseDecimal(',5')).toBe(0.5)
})

test('anything else is not a number', () => {
  expect(parseDecimal('')).toBeNaN()
  expect(parseDecimal('abc')).toBeNaN()
  expect(parseDecimal('4,9,0x')).toBeNaN()
})
