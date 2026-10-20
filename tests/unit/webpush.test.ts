import { describe, expect, test } from 'bun:test'
import { b64urlDecode, b64urlEncode, encryptPayload, generateVapidKeys, sendPush, vapidAuthorization } from '../../supabase/functions/_shared/webpush.ts'

const enc = new TextEncoder()
const dec = new TextDecoder()
const buf = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer

async function receiver() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  return { pair, keys: { endpoint: 'https://push.example.test/send/abc', p256dh: b64urlEncode(pub), auth: b64urlEncode(auth) }, pub, auth }
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8))
}

/** What a browser does with the body (RFC 8291), written independently of the sender code. */
async function decrypt(body: Uint8Array, r: Awaited<ReturnType<typeof receiver>>): Promise<string> {
  const salt = body.slice(0, 16)
  const rs = new DataView(body.buffer, body.byteOffset).getUint32(16)
  const idlen = body[20]!
  const senderPub = body.slice(21, 21 + idlen)
  const cipher = body.slice(21 + idlen)
  expect(rs).toBe(4096)
  expect(idlen).toBe(65)
  const senderKey = await crypto.subtle.importKey('raw', buf(senderPub), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey } as EcdhKeyDeriveParams, r.pair.privateKey, 256))
  const info = new Uint8Array([...enc.encode('WebPush: info\0'), ...r.pub, ...senderPub])
  const ikm = await hkdf(r.auth, shared, info, 32)
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)
  const key = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['decrypt'])
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: buf(nonce) }, key, buf(cipher)))
  expect(plain[plain.length - 1]).toBe(2)
  return dec.decode(plain.slice(0, -1))
}

describe('web push', () => {
  test('base64url round-trips without padding', () => {
    const bytes = new Uint8Array([251, 255, 0, 1, 2, 3, 4])
    expect(b64urlEncode(bytes)).not.toMatch(/[+/=]/)
    expect([...b64urlDecode(b64urlEncode(bytes))]).toEqual([...bytes])
  })

  test('a payload encrypted for a subscription can be decrypted by that browser only', async () => {
    const r = await receiver()
    const text = JSON.stringify({ title: 'وقت مرور است', body: '۱۲ کارت منتظرت است.', url: '#/study' })
    const body = await encryptPayload(enc.encode(text), r.keys)
    expect(await decrypt(body, r)).toBe(text)
    const other = await receiver()
    await expect(decrypt(body, other)).rejects.toThrow()
  })

  test('every message uses a fresh salt and sender key', async () => {
    const r = await receiver()
    const a = await encryptPayload(enc.encode('x'), r.keys)
    const b = await encryptPayload(enc.encode('x'), r.keys)
    expect(b64urlEncode(a.slice(0, 86))).not.toBe(b64urlEncode(b.slice(0, 86)))
  })

  test('the VAPID token is a valid ES256 JWT for the push service origin', async () => {
    const keys = await generateVapidKeys()
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/xyz', keys, 'mailto:admin@example.test', Date.UTC(2026, 9, 20))
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!
    expect(match).not.toBeNull()
    const claims = JSON.parse(dec.decode(b64urlDecode(match[2]!))) as { aud: string; exp: number; sub: string }
    expect(claims).toEqual({ aud: 'https://fcm.googleapis.com', exp: Date.UTC(2026, 9, 20) / 1000 + 12 * 3600, sub: 'mailto:admin@example.test' })
    expect(match[4]).toBe(keys.publicKey)
    const pub = await crypto.subtle.importKey('raw', buf(b64urlDecode(keys.publicKey)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, buf(b64urlDecode(match[3]!)), enc.encode(`${match[1]}.${match[2]}`))
    expect(ok).toBe(true)
  })

  test('sendPush posts an encrypted body and recognises expired subscriptions', async () => {
    const r = await receiver()
    const keys = await generateVapidKeys()
    const seen: { url: string; headers: Headers; body: Uint8Array }[] = []
    const fetchOk = async (url: string, init?: RequestInit) => {
      seen.push({ url, headers: new Headers(init?.headers), body: new Uint8Array(init?.body as ArrayBuffer) })
      return new Response(null, { status: 201 })
    }
    expect(await sendPush(r.keys, { title: 't', body: 'b', tag: 'daily reminder!' }, keys, 'mailto:a@b.test', fetchOk)).toBe('sent')
    expect(seen[0]!.url).toBe(r.keys.endpoint)
    expect(seen[0]!.headers.get('content-encoding')).toBe('aes128gcm')
    expect(seen[0]!.headers.get('topic')).toBe('dailyreminder')
    expect(JSON.parse(await decrypt(seen[0]!.body, r))).toEqual({ title: 't', body: 'b', tag: 'daily reminder!' })
    expect(await sendPush(r.keys, { title: 't', body: 'b' }, keys, 'mailto:a@b.test', async () => new Response(null, { status: 410 }))).toBe('gone')
    expect(await sendPush(r.keys, { title: 't', body: 'b' }, keys, 'mailto:a@b.test', async () => new Response(null, { status: 500 }))).toBe('failed')
    expect(await sendPush(r.keys, { title: 't', body: 'b' }, keys, 'mailto:a@b.test', async () => { throw new TypeError('offline') })).toBe('failed')
  })
})
