import { expect, test } from 'bun:test'
// @ts-expect-error plain JavaScript module
import worker from '../../worker/index.js'

const env = { ASSETS: { fetch: async (req: Request) => new Response(new URL(req.url).pathname) } }
const visit = (url: string, headers: Record<string, string> = {}, country?: string) => {
  const req = new Request(url, { headers }) as Request & { cf?: { country: string } }
  if (country) Object.defineProperty(req, 'cf', { value: { country } })
  return worker.fetch(req, env) as Promise<Response>
}

test('the front door opens in the language the browser asks for', async () => {
  const r = await visit('https://apphodhod.com/', { 'accept-language': 'fa-IR,fa;q=0.9,en;q=0.8' })
  expect(r.status).toBe(302)
  expect(r.headers.get('location')).toBe('/fa/')
})

test('English first, search engines and unknown visitors stay on English', async () => {
  expect((await visit('https://apphodhod.com/', { 'accept-language': 'en-US,de;q=0.8' })).status).toBe(200)
  expect(await (await visit('https://apphodhod.com/')).text()).toBe('/site/')
})

test('the country helps when the browser names none of our languages', async () => {
  const r = await visit('https://apphodhod.com/', { 'accept-language': 'ja' }, 'AT')
  expect(r.headers.get('location')).toBe('/de/')
})

test('a language picked by hand wins', async () => {
  expect((await visit('https://apphodhod.com/', { cookie: 'site_lang=en', 'accept-language': 'de' })).status).toBe(200)
  expect((await visit('https://apphodhod.com/', { cookie: 'a=1; site_lang=ar' })).headers.get('location')).toBe('/ar/')
})

test('the app and admin addresses always get the app', async () => {
  expect(await (await visit('https://app.apphodhod.com/', { 'accept-language': 'de' })).text()).toBe('/app/')
  expect(await (await visit('https://admin.apphodhod.com/')).text()).toBe('/app/')
  const test = await visit('https://test.apphodhod.com/')
  expect(await test.text()).toBe('/app/')
  expect(test.headers.get('x-robots-tag')).toBe('noindex')
})
