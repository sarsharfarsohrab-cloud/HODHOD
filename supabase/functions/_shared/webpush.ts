/**
 * Web Push without third-party code: VAPID authentication (RFC 8292) and the
 * "aes128gcm" payload encryption (RFC 8291), built on WebCrypto only, so the same
 * code runs in Deno (Edge Functions), Bun (tests) and browsers.
 */

export interface PushSubscriptionKeys {
  endpoint: string
  /** Receiver public key, base64url, uncompressed P-256 point (65 bytes). */
  p256dh: string
  /** Receiver auth secret, base64url (16 bytes). */
  auth: string
}

export interface VapidKeys {
  /** base64url of the raw uncompressed public key — given to browsers as applicationServerKey. */
  publicKey: string
  /** Private key as JWK (kept server-side only). */
  privateJwk: JsonWebKey
}

const enc = new TextEncoder()

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(text: string): Uint8Array {
  const normal = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normal + '='.repeat((4 - (normal.length % 4)) % 4)
  const bin = atob(padded)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

const buf = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer

export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return { publicKey: b64urlEncode(raw), privateJwk }
}

/** The Authorization header value for one push service (one origin). */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, subject: string, now = Date.now()): Promise<string> {
  const aud = new URL(endpoint).origin
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(enc.encode(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject })))
  const key = await crypto.subtle.importKey('jwk', { ...keys.privateJwk, key_ops: ['sign'] }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  // WebCrypto returns the raw r||s form that JWS ES256 expects
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${header}.${claims}`)))
  return `vapid t=${header}.${claims}.${b64urlEncode(signature)}, k=${keys.publicKey}`
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', buf(ikm), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(salt), info: buf(info) }, key, length * 8)
  return new Uint8Array(bits)
}

const RECORD_SIZE = 4096

/** Encrypts `payload` for one subscription (RFC 8291, single record). */
export async function encryptPayload(
  payload: Uint8Array,
  subscription: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>,
  testing?: { salt?: Uint8Array; senderKeys?: CryptoKeyPair },
): Promise<Uint8Array> {
  const receiverPublic = b64urlDecode(subscription.p256dh)
  const authSecret = b64urlDecode(subscription.auth)
  if (receiverPublic.length !== 65 || authSecret.length < 16) throw new Error('invalid subscription keys')
  if (payload.length > RECORD_SIZE - 16 - 1 - 86) throw new Error('payload too large')

  const sender = testing?.senderKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const senderPublic = new Uint8Array(await crypto.subtle.exportKey('raw', sender.publicKey))
  const receiverKey = await crypto.subtle.importKey('raw', buf(receiverPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: receiverKey } as EcdhKeyDeriveParams, sender.privateKey, 256))

  const keyInfo = concat(enc.encode('WebPush: info\0'), receiverPublic, senderPublic)
  const ikm = await hkdf(authSecret, shared, keyInfo, 32)
  const salt = testing?.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const padded = concat(payload, new Uint8Array([2])) // 0x02: last (and only) record
  const aesKey = await crypto.subtle.importKey('raw', buf(cek), 'AES-GCM', false, ['encrypt'])
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(nonce) }, aesKey, buf(padded)))

  const header = new Uint8Array(16 + 4 + 1 + senderPublic.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = senderPublic.length
  header.set(senderPublic, 21)
  return concat(header, cipher)
}

export interface PushMessage {
  title: string
  body: string
  /** In-app route to open, e.g. "#/study". */
  url?: string
  tag?: string
}

export type PushOutcome = 'sent' | 'gone' | 'failed'

/** Sends one message. 'gone' means the subscription no longer exists and should be deleted. */
export async function sendPush(
  subscription: PushSubscriptionKeys,
  message: PushMessage,
  keys: VapidKeys,
  subject: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<PushOutcome> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), subscription)
  let res: Response
  try {
    res = await fetchImpl(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuthorization(subscription.endpoint, keys, subject),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '43200',
        Urgency: 'normal',
        ...(message.tag ? { Topic: message.tag.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) } : {}),
      },
      body: buf(body),
    })
  } catch {
    return 'failed'
  }
  if (res.status === 404 || res.status === 410) return 'gone'
  return res.ok ? 'sent' : 'failed'
}
