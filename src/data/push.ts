/**
 * Reminders as phone notifications (Web Push). The server keeps the keys and decides
 * when to send (see the push function); this file asks for permission and registers
 * this device. On iPhone it only works for the app added to the home screen (iOS 16.4+).
 */
import type { SupabaseClient } from './supabase.ts'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && location.protocol === 'https:'
}

/** "BASE64URL" → bytes, as PushManager wants the server key. */
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null
  return (await navigator.serviceWorker.getRegistration()) ?? null
}

export async function pushState(): Promise<PushState> {
  if (!pushSupported()) return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Asks for permission and registers this device. Returns the resulting state. */
export async function enablePush(client: SupabaseClient): Promise<PushState> {
  if (!pushSupported()) return pushState()
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready)
  const { publicKey } = await client.invoke<{ publicKey: string }>('push', { action: 'public-key' }, { timeoutMs: 20_000 })
  let sub = await reg.pushManager.getSubscription()
  if (sub && !sameKey(sub, publicKey)) {
    await sub.unsubscribe()
    sub = null
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
  const json = sub.toJSON() as { endpoint: string; keys?: { p256dh?: string; auth?: string } }
  if (!json.keys?.p256dh || !json.keys.auth) throw new Error('push subscription without keys')
  await client.upsert('push_subscriptions', [{ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 300) }], 'endpoint')
  return 'on'
}

function sameKey(sub: PushSubscription, publicKey: string): boolean {
  const key = sub.options.applicationServerKey
  if (!key) return true
  const a = new Uint8Array(key)
  const b = base64UrlToBytes(publicKey)
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export async function disablePush(client: SupabaseClient): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await client.remove('push_subscriptions', { endpoint: `eq.${sub.endpoint}` }).catch(() => undefined)
  await sub.unsubscribe()
}

export async function sendTestPush(client: SupabaseClient): Promise<number> {
  const res = await client.invoke<{ sent: number }>('push', { action: 'test' }, { timeoutMs: 30_000 })
  return Number(res?.sent) || 0
}
