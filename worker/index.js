/**
 * One Cloudflare Worker serves every address of Hodhod from the built files in www/:
 *   apphodhod.com          → www/site  (the public introduction site, for people and search engines)
 *   app.apphodhod.com      → www/app   (the app itself)
 *   www.apphodhod.com      → permanent redirect to apphodhod.com
 * Any other host (the *.workers.dev preview address) shows the site.
 */
const APEX = 'apphodhod.com'

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const host = url.hostname

    if (host === `www.${APEX}`) {
      url.hostname = APEX
      return Response.redirect(url.toString(), 301)
    }

    const folder = host.startsWith('app.') ? '/app' : '/site'
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
    return response
  },
}
