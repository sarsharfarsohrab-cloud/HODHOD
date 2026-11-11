/**
 * One Cloudflare Worker serves every address of Hodhod from the built files in www/:
 *   apphodhod.com          → www/site  (the public introduction site, for people and search engines)
 *   app.apphodhod.com      → www/app   (the app itself)
 *   admin.apphodhod.com    → www/app   (the same app, opening on the admin panel; locked by
 *                                       Cloudflare Access to the owner's e-mail)
 *   test.apphodhod.com     → www/app   (the test mode: the app against a stand-in server in the
 *                                       browser, see src/demo/demo.ts; never indexed)
 *   www.apphodhod.com      → permanent redirect to apphodhod.com
 * Any other host (the *.workers.dev preview address) shows the site.
 *
 * Until the introduction site is ready (SITE_LIVE), apphodhod.com keeps showing the app, so the app
 * stays where its learners installed it and nothing changes for sign-in links. The *.workers.dev
 * address shows the site already, as a preview.
 */
const APEX = 'apphodhod.com'

/** The site's languages besides English (which lives at /). */
const SITE_LANGUAGES = ['fa', 'de', 'fr', 'it', 'tr', 'uk', 'ru', 'ar', 'es', 'nl']
/** When the browser names none of our languages, the visitor's country gives a hint. */
const COUNTRY_LANGUAGE = {
  IR: 'fa', AF: 'fa', TJ: 'fa',
  DE: 'de', AT: 'de', LI: 'de',
  FR: 'fr', LU: 'fr', MC: 'fr',
  IT: 'it', SM: 'it', VA: 'it',
  TR: 'tr', UA: 'uk', RU: 'ru', BY: 'ru', KZ: 'ru',
  SA: 'ar', AE: 'ar', EG: 'ar', IQ: 'ar', SY: 'ar', JO: 'ar', LB: 'ar', KW: 'ar', QA: 'ar', BH: 'ar', OM: 'ar', YE: 'ar', LY: 'ar', TN: 'ar', DZ: 'ar', MA: 'ar', SD: 'ar', PS: 'ar',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es',
  NL: 'nl', SR: 'nl',
}

/**
 * Which language a visitor to apphodhod.com/ should see: the one they picked before (cookie),
 * else the first of ours their browser asks for, else a guess from their country; null = English.
 */
function siteLanguage(request) {
  const cookie = /(?:^|;\s*)site_lang=([a-z]{2})/.exec(request.headers.get('cookie') ?? '')?.[1]
  if (cookie) return SITE_LANGUAGES.includes(cookie) ? cookie : null
  const wanted = (request.headers.get('accept-language') ?? '')
    .split(',')
    .map((part) => part.trim().slice(0, 2).toLowerCase())
    .filter(Boolean)
  for (const code of wanted) {
    if (code === 'en') return null
    if (SITE_LANGUAGES.includes(code)) return code
  }
  return COUNTRY_LANGUAGE[request.cf?.country] ?? null
}
const SITE_LIVE = true

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname

    if (host === `www.${APEX}`) {
      url.hostname = APEX
      return Response.redirect(url.toString(), 301)
    }

    const preview = host.endsWith('.workers.dev') || host.startsWith('test.')
    const appHost = host.startsWith('app.') || host.startsWith('admin.') || host.startsWith('test.')
    const folder = appHost || (!SITE_LIVE && !preview) ? '/app' : '/site'
    // the site's front door opens in the visitor's language (search engines get English)
    if (folder === '/site' && url.pathname === '/' && request.method === 'GET' && !url.search) {
      const lang = siteLanguage(request)
      if (lang) {
        return new Response(null, {
          status: 302,
          headers: { location: `/${lang}/`, vary: 'Accept-Language, Cookie', 'cache-control': 'private, no-store' },
        })
      }
    }

    const assetUrl = new URL(url)
    assetUrl.pathname = folder + url.pathname
    const response = await env.ASSETS.fetch(new Request(assetUrl, request))

    // the folder is an internal detail: never let it show up in a redirect
    const location = response.headers.get('location')
    if (location) {
      const target = new URL(location, assetUrl)
      if (target.pathname.startsWith(folder + '/') || target.pathname === folder) {
        target.pathname = target.pathname.slice(folder.length) || '/'
        target.hostname = url.hostname
        target.protocol = url.protocol
        target.port = url.port
        const headers = new Headers(response.headers)
        headers.set('location', target.toString())
        return new Response(response.body, { status: response.status, headers })
      }
    }
    if (preview) {
      // the preview must never compete with apphodhod.com in search engines
      const headers = new Headers(response.headers)
      headers.set('x-robots-tag', 'noindex')
      return new Response(response.body, { status: response.status, headers })
    }
    return response
  },
}
