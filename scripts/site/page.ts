/**
 * The introduction site's home page, written out once per language.
 * Plain HTML and CSS with a few lines of script: fast, readable by search engines, no framework.
 */
import { SITE_CONFIG } from './config.ts'
import { SITE_COPY, type SiteCopy } from './copy.ts'

export const SITE_LANGUAGES = ['en', 'fa', 'de', 'fr', 'it', 'tr', 'uk', 'ru', 'ar', 'es', 'nl'] as const
export type SiteLanguage = (typeof SITE_LANGUAGES)[number]

const INFO: Record<SiteLanguage, { english: string; own: string; rtl: boolean; locale: string; og: string }> = {
  en: { english: 'English', own: 'English', rtl: false, locale: 'en-GB', og: 'en_GB' },
  fa: { english: 'Persian', own: 'فارسی', rtl: true, locale: 'fa-IR', og: 'fa_IR' },
  de: { english: 'German', own: 'Deutsch', rtl: false, locale: 'de-DE', og: 'de_DE' },
  fr: { english: 'French', own: 'Français', rtl: false, locale: 'fr-FR', og: 'fr_FR' },
  it: { english: 'Italian', own: 'Italiano', rtl: false, locale: 'it-IT', og: 'it_IT' },
  tr: { english: 'Turkish', own: 'Türkçe', rtl: false, locale: 'tr-TR', og: 'tr_TR' },
  uk: { english: 'Ukrainian', own: 'Українська', rtl: false, locale: 'uk-UA', og: 'uk_UA' },
  ru: { english: 'Russian', own: 'Русский', rtl: false, locale: 'ru-RU', og: 'ru_RU' },
  ar: { english: 'Arabic', own: 'العربية', rtl: true, locale: 'ar', og: 'ar_AR' },
  es: { english: 'Spanish', own: 'Español', rtl: false, locale: 'es-ES', og: 'es_ES' },
  nl: { english: 'Dutch', own: 'Nederlands', rtl: false, locale: 'nl-NL', og: 'nl_NL' },
}

/** The languages one can learn, with their own names. */
const LEARN = [
  ['en', 'English'],
  ['de', 'Deutsch'],
  ['fr', 'Français'],
  ['it', 'Italiano'],
  ['es', 'Español'],
  ['nl', 'Nederlands'],
] as const

const ORIGIN = 'https://apphodhod.com'
const pathOf = (lang: SiteLanguage) => (lang === 'en' ? '/' : `/${lang}/`)

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const flag = (code: string, w = 28) => `<img class="flag" src="/img/flags/${code}.svg" alt="" width="${w}" height="${Math.round((w * 3) / 4)}" loading="lazy" decoding="async">`

const ICONS = {
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10.5 18.5h3"/></svg>',
  android: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="9" width="14" height="11" rx="2.5"/><path d="M8 9a4 4 0 0 1 8 0M9 5.5 7.8 3.8M15 5.5l1.2-1.7"/></svg>',
  globe: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
}

const FEATURE_ICONS = ['✨', '🧠', '🔊', '🎒', '📖', '🎧', '⏰', '👥']

function money(n: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n)
}

function storeButtons(c: SiteCopy, place: string, app: string): string {
  const store = (kind: 'ios' | 'android', icon: string, label: string) => {
    const url = SITE_CONFIG.stores[kind]
    return url
      ? `<a class="store" href="${esc(url)}" rel="noopener">${icon}<span><small>${esc(c.stores.get)}</small><b>${esc(label)}</b></span></a>`
      : `<span class="store soon" aria-disabled="true">${icon}<span><small>${esc(c.stores.soon)}</small><b>${esc(label)}</b></span></span>`
  }
  return `<div class="stores" data-place="${place}">
      ${store('ios', ICONS.phone, c.stores.ios)}
      ${store('android', ICONS.android, c.stores.android)}
      <a class="store web" href="${app}">${ICONS.globe}<span><small>${esc(c.stores.open)}</small><b>${esc(c.stores.web)}</b></span></a>
    </div>`
}

function languageMenu(current: SiteLanguage, c: SiteCopy): string {
  const items = SITE_LANGUAGES.map(
    (l) =>
      `<a href="${pathOf(l)}" hreflang="${l}" lang="${l}"${l === current ? ' aria-current="page"' : ''}>${flag(l === 'en' ? 'en' : l, 22)}<span>${INFO[l].english}</span>${INFO[l].own !== INFO[l].english ? `<small dir="${INFO[l].rtl ? 'rtl' : 'ltr'}">${INFO[l].own}</small>` : ''}</a>`,
  ).join('')
  return `<details class="langmenu" dir="ltr">
        <summary aria-label="${esc(c.nav.language)}">${flag(current, 22)}<span>${INFO[current].english}</span>${ICONS.chevron}</summary>
        <div class="langmenu-list">${items}</div>
      </details>`
}

export function renderHome(lang: SiteLanguage, publishableKey: string): string {
  const c = SITE_COPY[lang]
  const info = INFO[lang]
  const dir = info.rtl ? 'rtl' : 'ltr'
  const app = `${SITE_CONFIG.appUrl}?lang=${lang}`
  const alternates = SITE_LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l}" href="${ORIGIN}${pathOf(l)}">`).join('\n')
  const plus = SITE_CONFIG.plus
  const reviews = SITE_CONFIG.reviews
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Hodhod',
    url: `${ORIGIN}${pathOf(lang)}`,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web, iOS, Android',
    inLanguage: lang,
    description: c.description,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
  }

  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(c.title)}</title>
<meta name="description" content="${esc(c.description)}">
<link rel="canonical" href="${ORIGIN}${pathOf(lang)}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${ORIGIN}/">
<meta name="theme-color" content="#2d1166">
<link rel="icon" type="image/png" sizes="32x32" href="/img/favicon-32.png">
<link rel="apple-touch-icon" href="/img/apple-touch-icon.png">
<link rel="preload" href="/fonts/Vazirmatn-wght.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/media/hero.webp" as="image" media="(min-width: 761px)">
<link rel="preload" href="/media/hero-square.webp" as="image" media="(max-width: 760px)">
<link rel="stylesheet" href="/style.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Hodhod">
<meta property="og:locale" content="${info.og}">
<meta property="og:url" content="${ORIGIN}${pathOf(lang)}">
<meta property="og:title" content="${esc(c.hero.h1)}">
<meta property="og:description" content="${esc(c.hero.lead)}">
<meta property="og:image" content="${ORIGIN}/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<script>
  // old links and installed copies of the app from when it lived on this address
  if (location.hash.startsWith('#/') || location.hash.includes('access_token=')) location.replace(${JSON.stringify(SITE_CONFIG.appUrl)} + location.hash)
  else if (matchMedia('(display-mode: standalone)').matches) location.replace(${JSON.stringify(SITE_CONFIG.appUrl)})
</script>
</head>
<body>
<a class="skip" href="#main">${esc(c.hero.start)}</a>

<header class="top" id="top">
  <div class="wrap">
    <a class="logo" href="${pathOf(lang)}"><img src="/img/icon-192.png" alt="" width="36" height="36"><span>${lang === 'fa' || lang === 'ar' ? 'هدهد' : 'Hodhod'}</span></a>
    <nav class="nav" aria-label="${esc(c.nav.menu)}">
      <a href="#features">${esc(c.nav.features)}</a>
      <a href="#languages">${esc(c.nav.languages)}</a>
      <a href="#pricing">${esc(c.nav.pricing)}</a>
      <a href="#faq">${esc(c.nav.faq)}</a>
    </nav>
    <div class="top-actions">
      ${languageMenu(lang, c)}
      <a class="btn primary small" href="${app}">${esc(c.nav.openApp)}</a>
    </div>
  </div>
</header>

<main id="main">
  <section class="hero">
    <div class="hero-media" aria-hidden="true">
      <picture>
        <source media="(max-width: 760px)" srcset="/media/hero-square.webp">
        <img class="hero-poster" src="/media/hero.webp" alt="" width="1600" height="900" fetchpriority="high">
      </picture>
      <video class="hero-video" muted loop playsinline preload="none" data-wide="/media/hero.mp4" data-square="/media/hero-square.mp4"></video>
    </div>
    <div class="wrap hero-inner">
      <div class="hero-text">
        <span class="eyebrow">${esc(c.hero.eyebrow)}</span>
        <h1>${esc(c.hero.h1)}</h1>
        <p class="lead">${esc(c.hero.lead)}</p>
        <div class="cta">
          <a class="btn primary big" href="${app}">${esc(c.hero.start)}</a>
          <a class="btn ghost big" href="#how">${esc(c.hero.how)}</a>
        </div>
        <p class="note">${ICONS.check}${esc(c.hero.free)}</p>
        ${storeButtons(c, 'hero', app)}
      </div>
    </div>
    <svg class="hero-curve" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true"><path d="M0 80V40C240 0 480 0 720 26s480 50 720 10v44Z"/></svg>
  </section>

  <section class="stats" id="stats" hidden aria-label="${esc(c.stats.title)}">
    <div class="wrap stats-row">
      <div class="stat"><b data-stat="learners">–</b><span>${esc(c.stats.learners)}</span></div>
      <div class="stat"><b data-stat="words">–</b><span>${esc(c.stats.words)}</span></div>
      <div class="stat"><b data-stat="reviews">–</b><span>${esc(c.stats.reviews)}</span></div>
      <div class="stat"><b>6</b><span>${esc(c.stats.languages)}</span></div>
    </div>
  </section>

  <section class="block langs" id="languages">
    <div class="wrap">
      <h2>${esc(c.langs.title)}</h2>
      <p class="sub">${esc(c.langs.sub)}</p>
      <div class="lang-rows">
        <div class="lang-row">
          <h3>${esc(c.langs.speak)}</h3>
          <ul class="chips">${SITE_LANGUAGES.map((l) => `<li lang="${l}">${flag(l)}<span>${INFO[l].own}</span></li>`).join('')}</ul>
        </div>
        <div class="lang-arrow" aria-hidden="true">${ICONS.chevron}</div>
        <div class="lang-row learn">
          <h3>${esc(c.langs.learn)}</h3>
          <ul class="chips">${LEARN.map(([code, name]) => `<li lang="${code}">${flag(code)}<span>${name}</span></li>`).join('')}</ul>
        </div>
      </div>
    </div>
  </section>

  <section class="block" id="features">
    <div class="wrap">
      <h2>${esc(c.features.title)}</h2>
      <p class="sub">${esc(c.features.sub)}</p>
      <div class="bento">
        ${c.features.items
          .map(
            ([title, text], i) => `<article class="tile t${i + 1}">
          <span class="tile-icon" aria-hidden="true">${FEATURE_ICONS[i]}</span>
          <h3>${esc(title)}</h3>
          <p>${esc(text)}</p>
          ${i === 0 ? '<div class="word-cards" aria-hidden="true" dir="ltr"><span class="wc der">der Tisch</span><span class="wc fr">la table</span><span class="wc es">la mesa</span></div>' : ''}
          ${i === 1 ? '<img class="tile-bird" src="/img/thinking.webp" alt="" width="120" height="120" loading="lazy">' : ''}
          ${i === 7 ? '<img class="tile-bird" src="/img/streak.webp" alt="" width="120" height="120" loading="lazy">' : ''}
          ${i === 6 ? '<div class="times" aria-hidden="true" dir="ltr"><span>08:15</span><span>12:30</span><span>19:00</span></div>' : ''}
        </article>`,
          )
          .join('\n        ')}
      </div>
    </div>
  </section>

  <section class="block how" id="how">
    <div class="wrap">
      <h2>${esc(c.how.title)}</h2>
      <ol class="steps">
        ${c.how.steps.map(([t, p]) => `<li><h3>${esc(t)}</h3><p>${esc(p)}</p></li>`).join('\n        ')}
      </ol>
      <div class="screens">
        ${[
          ['card', c.how.shots[0]],
          ['home', c.how.shots[1]],
          ['study', c.how.shots[2]],
        ]
          .map(
            ([img, cap], i) =>
              `<figure class="shot s${i + 1}"><div class="phone"><img src="/img/shots/${lang}/${img}.webp" alt="${esc(cap!)}" width="780" height="1688" loading="lazy"></div><figcaption>${esc(cap!)}</figcaption></figure>`,
          )
          .join('\n        ')}
        <img class="screens-bird" src="/img/teacher.webp" alt="" width="150" height="150" loading="lazy">
      </div>
    </div>
  </section>

  <section class="block pricing" id="pricing">
    <div class="wrap">
      <h2>${esc(c.pricing.title)}</h2>
      <p class="sub">${esc(c.pricing.sub)}</p>
      <div class="plans">
        <article class="plan">
          <h3>${esc(c.pricing.freeName)}</h3>
          <p class="plan-for">${esc(c.pricing.freeFor)}</p>
          <p class="price"><b>${money(0, info.locale)}</b></p>
          <ul>${c.pricing.free.map((f) => `<li>${ICONS.check}${esc(f)}</li>`).join('')}</ul>
          <a class="btn primary wide" href="${app}">${esc(c.pricing.start)}</a>
        </article>
        <article class="plan plus">
          <img class="plan-bird" src="/img/trophy.webp" alt="" width="110" height="110" loading="lazy">
          <h3>${esc(c.pricing.plusName)}${plus.available ? '' : ` <span class="badge">${esc(c.pricing.soon)}</span>`}</h3>
          <p class="plan-for">${esc(c.pricing.plusFor)}</p>
          <div class="prices">
            <p><b>${money(plus.month, info.locale)}</b><span>${esc(c.pricing.month)}</span></p>
            <p class="best"><em>${esc(c.pricing.popular)}</em><b>${money(plus.year, info.locale)}</b><span>${esc(c.pricing.year)}</span></p>
            <p><b>${money(plus.lifetime, info.locale)}</b><span>${esc(c.pricing.lifetime)}</span></p>
          </div>
          <ul>${c.pricing.plus.map((f) => `<li>${ICONS.check}${esc(f)}</li>`).join('')}</ul>
          ${plus.available ? `<a class="btn wide" href="${app}">${esc(c.pricing.plusName)}</a>` : `<span class="btn wide disabled" aria-disabled="true">${esc(c.pricing.soon)}</span>`}
        </article>
      </div>
    </div>
  </section>

  ${
    reviews.length
      ? `<section class="block reviews" id="reviews">
    <div class="wrap">
      <h2>${esc(c.reviews.title)}</h2>
      <div class="review-list">
        ${reviews
          .map(
            (r) =>
              `<figure class="review"><div class="stars" aria-label="${r.stars}/5">${'★'.repeat(r.stars)}</div><blockquote lang="${esc(r.lang)}">${esc(r.text)}</blockquote><figcaption><b>${esc(r.name)}</b> · ${esc(r.place)}</figcaption></figure>`,
          )
          .join('\n        ')}
      </div>
    </div>
  </section>`
      : ''
  }

  <section class="block" id="faq">
    <div class="wrap narrow">
      <h2>${esc(c.faq.title)}</h2>
      <div class="faq">
        ${c.faq.items.map(([q, a]) => `<details><summary>${esc(q)}${ICONS.chevron}</summary><p>${esc(a)}</p></details>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="final">
    <div class="wrap">
      <img src="/img/happy.webp" alt="" width="140" height="140" loading="lazy">
      <h2>${esc(c.final.title)}</h2>
      <p>${esc(c.final.sub)}</p>
      <a class="btn primary big" href="${app}">${esc(c.hero.start)}</a>
      ${storeButtons(c, 'final', app)}
    </div>
  </section>
</main>

<footer class="foot">
  <div class="wrap foot-grid">
    <div>
      <a class="logo" href="${pathOf(lang)}"><img src="/img/icon-192.png" alt="" width="32" height="32"><span>${lang === 'fa' || lang === 'ar' ? 'هدهد' : 'Hodhod'}</span></a>
      <p>${esc(c.footer.tagline)}</p>
      ${SITE_CONFIG.contactEmail ? `<p><a href="mailto:${esc(SITE_CONFIG.contactEmail)}">${esc(c.footer.contact)}: ${esc(SITE_CONFIG.contactEmail)}</a></p>` : ''}
    </div>
    <nav aria-label="${esc(c.footer.languages)}">
      <h3>${esc(c.footer.languages)}</h3>
      <ul>${SITE_LANGUAGES.map((l) => `<li><a href="${pathOf(l)}" hreflang="${l}" lang="${l}">${INFO[l].own}</a></li>`).join('')}</ul>
    </nav>
    <nav aria-label="${esc(c.footer.legal)}">
      <h3>${esc(c.footer.legal)}</h3>
      <ul lang="de"><li><a href="/impressum">Impressum</a></li><li><a href="/datenschutz">Datenschutz</a></li><li><a href="/nutzungsbedingungen">Nutzungsbedingungen</a></li></ul>
    </nav>
  </div>
  <p class="wrap copy">© ${new Date().getFullYear()} Hodhod</p>
</footer>

<script>
(() => {
  // the hero film: only when motion is welcome, sized for the screen, and only while visible
  const video = document.querySelector('.hero-video')
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
  const save = navigator.connection && navigator.connection.saveData
  if (video && !calm && !save) {
    video.src = matchMedia('(max-width: 760px)').matches ? video.dataset.square : video.dataset.wide
    video.addEventListener('playing', () => video.classList.add('on'), { once: true })
    new IntersectionObserver(([e]) => (e.isIntersecting ? video.play().catch(() => {}) : video.pause())).observe(video)
  }

  // the header gets a background once the page scrolls
  const top = document.getElementById('top')
  const onScroll = () => top.classList.toggle('scrolled', scrollY > 20)
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // sections float in as they come into view
  const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('in'), io.unobserve(e.target))), { rootMargin: '0px 0px -10% 0px' })
  document.querySelectorAll('.block h2, .tile, .steps li, .shot, .plan, .lang-row, .faq details').forEach((el) => (el.classList.add('rise'), io.observe(el)))

  // close the language menu when tapping elsewhere
  const menu = document.querySelector('.langmenu')
  document.addEventListener('click', (e) => menu && !menu.contains(e.target) && menu.removeAttribute('open'))

  // live totals, shown only once they are large enough
  const stats = document.getElementById('stats')
  fetch(${JSON.stringify(SITE_CONFIG.supabaseUrl + '/rest/v1/rpc/public_stats')}, {
    method: 'POST',
    headers: { apikey: ${JSON.stringify(publishableKey)}, 'content-type': 'application/json' },
    body: '{}',
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((s) => {
      if (!s || s.learners < ${SITE_CONFIG.statsMinLearners}) return
      const fmt = new Intl.NumberFormat(${JSON.stringify(info.locale)}, { notation: 'compact', maximumFractionDigits: 1 })
      for (const el of stats.querySelectorAll('[data-stat]')) el.textContent = fmt.format(s[el.dataset.stat] || 0) + '+'
      stats.hidden = false
    })
    .catch(() => {})
  // a language picked by hand is remembered, so apphodhod.com/ opens in it next time (see worker/index.js)
  document.querySelectorAll('a[hreflang]').forEach((a) =>
    a.addEventListener('click', () => (document.cookie = 'site_lang=' + a.getAttribute('hreflang') + '; path=/; max-age=31536000; samesite=lax; secure')),
  )
})()
</script>
</body>
</html>
`
}
