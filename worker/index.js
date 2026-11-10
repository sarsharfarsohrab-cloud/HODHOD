/**
 * One Cloudflare Worker serves every address of Hodhod from the built files in www/:
 *   apphodhod.com          → www/site  (the public introduction site, for people and search engines)
 *   app.apphodhod.com      → www/app   (the app itself)
 *   www.apphodhod.com      → permanent redirect to apphodhod.com
 * Any other host (the *.workers.dev preview address) shows the site.
 *
 * Until the introduction site is ready (SITE_LIVE), apphodhod.com keeps showing the app, so the app
 * stays where its learners installed it and nothing changes for sign-in links. The *.workers.dev
 * address shows the site already, as a preview.
 */
const APEX = 'apphodhod.com'
const SITE_LIVE = false

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname

    if (host === `www.${APEX}`) {
      url.hostname = APEX
      return Response.redirect(url.toString(), 301)
    }

    const preview = host.endsWith('.workers.dev')
    const folder = host.startsWith('app.') || (!SITE_LIVE && !preview) ? '/app' : '/site'
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
