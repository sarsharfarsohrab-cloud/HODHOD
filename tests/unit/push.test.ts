import { expect, test } from 'bun:test'
import { base64UrlToBytes } from '../../src/data/push.ts'

test('server key in base64url becomes the bytes PushManager expects', () => {
  expect([...base64UrlToBytes('AQID_-8')]).toEqual([1, 2, 3, 255, 239])
  expect(base64UrlToBytes('BP' + 'A'.repeat(85)).length).toBe(65)
})
