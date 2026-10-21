/**
 * Browser tests of the complete user flows on an iPhone-sized screen (Chromium via Playwright),
 * against the in-memory test backend. Screenshots land in tests/e2e/output/.
 *
 *   bun run scripts/build.ts --dev && NODE_PATH=$(npm root -g) node tests/e2e/run.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'output')
const PORT = 4175
const BASE = `http://localhost:${PORT}`
const only = process.argv[2]

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const server = spawn('bun', ['run', join(here, 'server.ts')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((resolve) => server.stdout.once('data', resolve))

const control = (path, body = {}) => fetch(`${BASE}/__test/${path}`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json())
const state = () => fetch(`${BASE}/__test/state`).then((r) => r.json())

const browser = await chromium.launch()
const results = []
let shot = 0
let lastPage = null

const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fa-IR', timezoneId: 'Europe/Berlin' }

function assert(condition, message) {
  if (!condition) throw new Error(`assertion failed: ${message}`)
}

async function newPage(options = {}) {
  const context = await browser.newContext({ ...PHONE, ...options })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const text = m.text()
    // expected: failed requests in the failure tests are logged by the browser itself
    if (/Failed to load resource|net::ERR/.test(text)) return
    problems.push(`console: ${text}`)
  })
  page.problems = problems
  lastPage = page
  return page
}

const snap = async (page, name) => {
  shot++
  await page.waitForTimeout(350) // let transitions finish
  await page.screenshot({ path: join(out, `${String(shot).padStart(2, '0')}-${name}.png`) })
}

async function signUp(page, { email = 'sohrab@example.test', name = 'سهراب' } = {}) {
  await page.goto(BASE)
  await page.getByRole('button', { name: 'ساخت حساب', exact: true }).click()
  await page.getByLabel('نام').fill(name)
  await page.getByLabel('ایمیل').fill(email)
  await page.getByLabel('رمز عبور').fill('correct horse battery')
  await page.getByRole('button', { name: 'حساب بساز' }).click()
  await page.getByRole('heading', { name: new RegExp(name) }).waitFor()
}

async function createWord(page, word, { confirm = true } = {}) {
  await page.goto(`${BASE}/#/create`)
  await page.getByLabel('کلمه یا عبارت آلمانی').fill(word)
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('پیش‌نویس است و هنوز ذخیره نشده').waitFor()
  if (confirm) {
    await page.getByRole('button', { name: 'تأیید و ذخیره' }).click()
    await page.waitForURL(/#\/words\/[0-9a-f-]+$/) // saved: the app moves on to the word's page
    await page.getByText('وضعیت یادگیری').waitFor() // …and has shown it
  }
}

const noHorizontalScroll = async (page, where) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  assert(overflow <= 0, `${where}: page scrolls sideways by ${overflow}px`)
}

async function test(name, fn) {
  if (only && !name.includes(only)) return
  await control('reset')
  const started = Date.now()
  let page
  lastPage = null
  try {
    page = await fn()
    if (page?.problems?.length) throw new Error(`browser errors:\n  ${page.problems.join('\n  ')}`)
    results.push({ name, ok: true, ms: Date.now() - started })
    console.log(`  ok    ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error })
    console.log(`  FAIL  ${name}\n        ${String(error.message).split('\n').slice(0, 6).join('\n        ')}`)
    await lastPage?.screenshot({ path: join(out, `FAIL-${name.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}.png`) }).catch(() => {})
  } finally {
    await lastPage?.context().close().catch(() => {})
  }
}

// ---------------------------------------------------------------------------------------------

await test('complete flow: account → word → bank → study → home → settings → sign out/in', async () => {
  const page = await newPage()
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'هدهد' }).waitFor()
  assert((await page.evaluate(() => document.documentElement.dir)) === 'rtl', 'document is right-to-left')
  await snap(page, 'sign-in')

  await signUp(page)
  await page.getByText('اولین کلمه‌ات را اضافه کن').first().waitFor()
  await noHorizontalScroll(page, 'home (empty)')
  await snap(page, 'home-empty')

  // --- create: input rules
  await page.getByRole('link', { name: 'کلمهٔ تازه' }).click()
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('یک کلمه بنویس.', { exact: true }).waitFor()
  await page.getByLabel('کلمه یا عبارت آلمانی').fill('ich gehe heute Abend nach Hause und dann sofort ins Bett, weil ich morgen sehr früh aufstehen muss und den ganzen Tag arbeite')
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('خیلی بلند است', { exact: false }).waitFor()
  await page.getByLabel('کلمه یا عبارت آلمانی').fill('میز')
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('کلمه را به آلمانی بنویس، نه فارسی.').waitFor()
  assert((await state()).aiCalls === 0, 'invalid input never reaches the AI')

  // --- create: draft → edit → confirm
  await page.getByLabel('کلمه یا عبارت آلمانی').fill('aufgeben')
  await snap(page, 'create-input')
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('پیش‌نویس است و هنوز ذخیره نشده').waitFor()
  assert((await state()).words.length === 0, 'a draft is not saved')
  await page.getByText('تسلیم شدن، دست کشیدن').waitFor()
  await noHorizontalScroll(page, 'draft')
  await snap(page, 'draft-preview')

  await page.getByRole('button', { name: 'ویرایش' }).click()
  const translation = page.locator('[data-path="meanings.0.translation"]')
  await translation.fill('')
  await page.getByRole('button', { name: 'تأیید و ذخیره' }).click()
  await page.getByText('چند جا باید درست شود').waitFor()
  assert((await state()).words.length === 0, 'an invalid edit is not saved')
  await translation.fill('تسلیم شدن، منصرف شدن')
  await snap(page, 'draft-edit')
  await page.getByRole('button', { name: 'پیش‌نمایش' }).click()
  await page.getByText('تسلیم شدن، منصرف شدن').waitFor()
  await page.getByRole('button', { name: 'تأیید و ذخیره' }).click()
  await page.getByText('در بانک واژه ذخیره شد').waitFor()
  let s = await state()
  assert(s.words.length === 1 && s.words[0].primary_meaning === 'تسلیم شدن، منصرف شدن', 'the edited draft is what gets saved')
  assert(s.words[0].source === 'manual', 'an edited draft is marked as edited')
  assert(s.cards.length === 1 && s.cards[0].state === 'new', 'saving creates a new card that is not being learned yet')

  // --- word detail
  await page.getByRole('heading', { name: 'aufgeben' }).waitFor()
  await page.getByText('Präsens').first().waitFor()
  await page.getByText('gibt auf').first().waitFor()
  await page.locator('summary', { hasText: 'Perfekt' }).first().click()
  await page.getByText('hat aufgegeben').waitFor()
  await page.getByText('هنوز وارد مرور نشده').waitFor()
  assert((await page.getByRole('button', { name: /پخش تلفظ/ }).count()) > 5, 'audio buttons are present')
  await noHorizontalScroll(page, 'word detail')
  await snap(page, 'word-detail')
  await page.evaluate(() => window.scrollTo(0, 900))
  await snap(page, 'word-detail-conjugation')

  // --- a noun, and a duplicate attempt
  await createWord(page, 'der Tisch')
  await page.getByRole('heading', { name: 'der Tisch' }).waitFor()
  await snap(page, 'word-detail-noun')
  await page.goto(`${BASE}/#/create`)
  await page.getByLabel('کلمه یا عبارت آلمانی').fill('tisch')
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('این کلمه در بانک واژه‌ات هست').waitFor()
  await snap(page, 'duplicate')
  await page.getByRole('button', { name: 'باز کردن کلمه' }).click()
  await page.getByRole('heading', { name: 'der Tisch' }).waitFor()
  assert((await state()).words.length === 2, 'no duplicate was created')

  // --- word bank: search and filter
  await createWord(page, 'schnell')
  await page.getByRole('link', { name: 'واژه‌ها' }).click()
  await page.getByText('۳ کلمه').waitFor()
  await noHorizontalScroll(page, 'word bank')
  await snap(page, 'word-bank')
  await page.getByLabel('جست‌وجو در آلمانی یا فارسی').fill('ميز') // typed with an Arabic keyboard's ي
  await page.getByText('۱ از ۳ کلمه').waitFor()
  await page.getByLabel('جست‌وجو در آلمانی یا فارسی').fill('SCHN')
  await page.getByText('۱ از ۳ کلمه').waitFor()
  await page.getByRole('link', { name: /schnell/ }).waitFor()
  await page.getByLabel('جست‌وجو در آلمانی یا فارسی').fill('')
  await page.getByRole('button', { name: 'فیلتر و ترتیب' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'فعل' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'بستن' }).last().click()
  await page.getByText('۱ از ۳ کلمه').waitFor()
  await page.getByRole('button', { name: /فیلتر و ترتیب/ }).click()
  await page.getByRole('dialog').getByRole('group', { name: 'نوع کلمه' }).getByRole('button', { name: 'همه' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'بستن' }).last().click()
  await page.getByRole('listitem').filter({ hasText: 'Tisch' }).getByRole('button', { name: 'علاقه‌مندی' }).click()
  await page.getByRole('button', { name: 'علاقه‌مندی‌ها' }).click()
  await page.getByText('۱ از ۳ کلمه').waitFor()
  await page.getByRole('button', { name: 'همه', exact: true }).click()

  // --- home with a plan
  await page.getByRole('link', { name: 'خانه' }).click()
  await page.locator('.perch-plan .count-new', { hasText: '۳' }).waitFor()
  await snap(page, 'home-with-plan')

  // --- study: recall first, then the answer and the four ratings with their intervals
  await page.getByRole('link', { name: /شروع یادگیری|یادگیری کلمه‌های تازه/ }).click()
  await page.getByRole('button', { name: 'نمایش جواب' }).waitFor()
  assert((await page.getByText('تسلیم شدن').count()) === 0, 'the answer is hidden before recall')
  await snap(page, 'study-front')
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.getByText('تسلیم شدن، منصرف شدن').waitFor()
  const ratings = await page.locator('.rating').allInnerTexts()
  assert(ratings.length === 4, 'four rating buttons')
  assert(/یادم نیامد[\s\S]*۱ دقیقه/.test(ratings[0]) && /یادم آمد[\s\S]*۱۰ دقیقه/.test(ratings[2]), `intervals come from the scheduler: ${JSON.stringify(ratings)}`)
  assert(/خیلی راحت[\s\S]*روز/.test(ratings[3]), 'easy graduates to days')
  await noHorizontalScroll(page, 'study')
  await snap(page, 'study-back')

  await page.locator('.rating-1').click() // again on aufgeben
  await page.getByText('اشکالی ندارد، دوباره امتحانش می‌کنیم.').waitFor()
  await snap(page, 'study-after-again')
  for (let i = 0; i < 12; i++) {
    if (await page.getByText('این دور تمام شد').count()) break
    await page.getByRole('button', { name: 'نمایش جواب' }).click()
    await page.locator('.rating-4').click() // easy → straight to review
    await page.waitForTimeout(80)
  }
  await page.getByText('این دور تمام شد').waitFor()
  await snap(page, 'study-summary')
  s = await state()
  assert(s.reviews.length === 4, `every answer is stored as a review event (got ${s.reviews.length})`)
  assert(s.reviews.every((r) => r.scheduler_version === 'fsrs-6/ts-fsrs-5.4.2' && r.session_id), 'events record scheduler version and session')
  assert(s.cards.every((c) => c.state === 'review' && c.introduced_at), 'cards moved to review')

  await page.getByRole('button', { name: 'برگشت به خانه' }).click()
  await page.locator('.streak-mini .streak-number', { hasText: '۱' }).waitFor()
  await page.getByText('کار امروز', { exact: false }).first().waitFor({ timeout: 2000 }).catch(() => {})
  await snap(page, 'home-after-study')

  // --- "return later": the cards come due again according to the scheduler
  await control('shift-due', { days: 30 })
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'همگام‌سازی' }).click()
  await page.goto(`${BASE}/#/home`)
  await page.locator('.perch-plan .count-review', { hasText: '۳' }).waitFor()
  await snap(page, 'home-reviews-due')

  // --- word detail now shows learning data
  await page.goto(`${BASE}/#/words`)
  await page.getByRole('link', { name: /aufgeben/ }).click()
  await page.getByText('احتمال یادآوری الان').waitFor()
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await snap(page, 'word-detail-learning')

  // --- settings
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'کلمهٔ تازه در روز: +' }).click()
  await page.getByRole('button', { name: '۳۰ دقیقه' }).click()
  await page.getByRole('button', { name: 'تیره' }).click()
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark')
  await snap(page, 'settings-dark')
  await page.waitForTimeout(300)
  s = await state()
  assert(s.settings[0].new_per_day === 11 && s.settings[0].daily_goal_minutes === 30 && s.settings[0].theme === 'dark', 'settings reach the server')
  await page.goto(`${BASE}/#/home`)
  await page.getByText(/[۰-۹]+ دقیقهٔ دیگر تا هدف امروز/).waitFor()
  await snap(page, 'home-dark')

  // --- sign out, sign in: everything is still there
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'خروج از حساب' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'خروج از حساب' }).click()
  await page.getByRole('button', { name: 'وارد شو' }).waitFor()
  await page.getByLabel('ایمیل').fill('sohrab@example.test')
  await page.getByLabel('رمز عبور').fill('wrong password')
  await page.getByRole('button', { name: 'وارد شو' }).click()
  await page.getByText('ایمیل یا رمز درست نیست.').waitFor()
  await page.getByLabel('رمز عبور').fill('correct horse battery')
  await page.getByRole('button', { name: 'وارد شو' }).click()
  await page.getByRole('heading', { name: /سهراب/ }).waitFor()
  await page.locator('.perch-plan b').waitFor() // the words came back with the account
  assert((await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark', 'the theme setting came back with the account')
  return page
})

await test('new words per day limits the queue, not the bank', async () => {
  const page = await newPage()
  await signUp(page)
  // 12 words through the real create flow would be slow; the limit logic only needs the rows
  for (const letter of 'abcdefghijkl') {
    await control('clear-ai-logs') // twelve words in a few seconds would (rightly) hit the per-minute limit
    await createWord(page, `Wort${letter}`)
  }
  await page.goto(`${BASE}/#/home`)
  await page.locator('.perch-plan .count-new', { hasText: '۱۰' }).waitFor()
  await page.getByText('۲ کلمهٔ ذخیره‌شده در صف روزهای بعد است.').waitFor()
  await snap(page, 'home-queue-limit')
  await page.goto(`${BASE}/#/words`)
  await page.getByText('۱۲ کلمه').waitFor()
  return page
})

await test('AI problems: spelling suggestion, unknown word, outage, invalid answer, cancel', async () => {
  const page = await newPage()
  await signUp(page)
  await page.goto(`${BASE}/#/create`)
  const input = () => page.getByLabel('کلمه یا عبارت آلمانی')
  const go = () => page.getByRole('button', { name: 'ساخت کارت' }).click()

  await input().fill('Strase')
  await go()
  await page.getByText('منظورت این بود؟').waitFor()
  await snap(page, 'spelling-suggestion')
  await page.getByRole('button', { name: 'بله، همین' }).click()
  await page.getByText('خیابان').first().waitFor()
  await page.getByRole('button', { name: 'دور بریز' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'دور بریز' }).click()

  await input().fill('qwrtzx')
  await go()
  await page.getByText('را به‌عنوان یک کلمه یا عبارت آلمانی نشناختم').waitFor()

  await control('ai', { mode: 'error' })
  await input().fill('schnell')
  await go()
  await page.getByText('فعلاً نتوانستم این کلمه را آماده کنم.').waitFor()
  await snap(page, 'ai-failed')
  await control('ai', { mode: 'ok' })
  await page.getByRole('button', { name: 'دوباره امتحان کن' }).click()
  await page.getByText('سریع، تند').waitFor()
  await page.getByRole('button', { name: 'دور بریز' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'دور بریز' }).click()

  await control('ai', { mode: 'invalid' })
  await input().fill('Lampe')
  await go()
  await page.getByText('جوابی که هوش مصنوعی داد قابل استفاده نبود').waitFor()
  await page.getByRole('button', { name: 'انصراف' }).click()
  assert((await state()).words.length === 0, 'nothing invalid was saved')

  // slow answer: friendly loading state, repeated taps do nothing, leaving cancels cleanly
  await control('clear-ai-logs') // this test has used up the per-minute allowance on purpose-built failures
  await control('ai', { mode: 'slow' })
  await input().fill('Tisch')
  const before = (await state()).aiCalls
  await go()
  await page.getByText('دارم کارت این کلمه را آماده می‌کنم…').waitFor()
  await snap(page, 'ai-loading')
  await page.goBack() // back navigation during generation
  await page.waitForTimeout(1800)
  assert((await state()).aiCalls === before + 1, 'one request for one tap')
  assert((await state()).words.length === 0, 'an abandoned request saves nothing')
  return page
})

await test('offline: the app opens, shows the bank, reviews are kept and uploaded later', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'Tisch')
  await createWord(page, 'aufgeben')

  await page.context().setOffline(true)
  await page.goto(`${BASE}/#/home`).catch(() => {}) // no service worker on http://localhost; stay on the loaded page
  await page.evaluate(() => (location.hash = '#/home'))
  await page.getByText('آفلاین هستی', { exact: false }).first().waitFor()
  await snap(page, 'offline-home')

  await page.evaluate(() => (location.hash = '#/create'))
  await page.getByLabel('کلمه یا عبارت آلمانی').fill('schnell')
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('به اینترنت وصل نیستی.').waitFor()

  await page.evaluate(() => (location.hash = '#/study'))
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.rating-3').click()
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.rating-3').click()
  assert((await state()).reviews.length === 0, 'nothing reached the server while offline')

  await page.evaluate(() => (location.hash = '#/settings'))
  if (process.env.DEBUG_E2E) console.log(await page.locator('section', { hasText: 'داده و همگام‌سازی' }).innerText())
  await page.getByText('۲ تغییر در انتظار ارسال').waitFor()
  await snap(page, 'offline-settings')

  await page.context().setOffline(false)
  await page.getByText('تغییر در انتظار ارسال').waitFor({ state: 'detached', timeout: 5000 })
  const s = await state()
  assert(s.reviews.length === 2, `queued reviews were uploaded (got ${s.reviews.length})`)
  assert(s.cards.every((c) => c.state === 'learning'), 'server cards match the device')
  return page
})

await test('two accounts on one device never mix data', async () => {
  const page = await newPage()
  await signUp(page, { email: 'a@example.test', name: 'نگار' })
  await createWord(page, 'Tisch')
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'خروج از حساب' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'خروج از حساب' }).click()
  await page.getByRole('button', { name: 'وارد شو' }).waitFor()
  await signUp(page, { email: 'b@example.test', name: 'سهراب' })
  await page.getByText('اولین کلمه‌ات را اضافه کن').first().waitFor()
  await page.goto(`${BASE}/#/words`)
  await page.getByText('اولین کلمه‌ات را اضافه کن').first().waitFor()
  // B adds the same word: served from the shared cache, saved as B's own
  const calls = (await state()).aiCalls
  await createWord(page, 'Tisch')
  const s = await state()
  assert(s.aiCalls === calls, 'the second account reused the cached analysis')
  assert(s.words.length === 2 && new Set(s.words.map((w) => w.user_id)).size === 2, 'each account has its own copy')
  return page
})

await test('edit and delete a saved word; delete the account', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'Tisch')
  await page.getByRole('link', { name: 'ویرایش' }).click()
  await page.locator('[data-path="notes"]').fill('یادداشت خودم')
  await page.getByRole('button', { name: 'ذخیرهٔ تغییرها' }).click()
  await page.getByText('تغییرها ذخیره شد').waitFor()
  await page.getByText('یادداشت خودم').waitFor()

  // leaving a changed form asks first
  await page.getByRole('link', { name: 'ویرایش' }).click()
  await page.locator('[data-path="notes"]').fill('چیز دیگر')
  await page.getByRole('link', { name: 'خانه' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'انصراف' }).click()
  assert(page.url().endsWith('/edit'), 'stayed on the form')
  await page.getByRole('link', { name: 'انصراف' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'دور بریز' }).click()
  await page.getByText('یادداشت خودم').waitFor()

  await page.getByRole('button', { name: 'حذف از بانک واژه' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'حذف' }).click()
  await page.getByText('اولین کلمه‌ات را اضافه کن').first().waitFor()
  let s = await state()
  assert(s.words.length === 1 && s.words[0].deleted_at, 'the word is archived, not destroyed')

  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'حذف کامل حساب' }).click()
  const confirm = page.getByRole('button', { name: 'حسابم را برای همیشه پاک کن' })
  assert(await confirm.isDisabled(), 'deletion needs the typed e-mail')
  await page.getByLabel('برای تأیید، ایمیلت را بنویس').fill('sohrab@example.test')
  await snap(page, 'delete-account')
  await confirm.click()
  await page.getByRole('button', { name: 'وارد شو' }).waitFor()
  s = await state()
  assert(s.users === 0 && s.words.length === 0 && s.cards.length === 0, 'the account and its data are gone')
  return page
})

await test('desktop layout uses a side rail and stays readable', async () => {
  const page = await newPage({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 })
  await signUp(page)
  await createWord(page, 'aufgeben')
  await page.goto(`${BASE}/#/home`)
  const nav = await page.locator('.nav').boundingBox()
  assert(nav.height > 600 && nav.width < 300, 'navigation is a vertical rail on desktop')
  assert(nav.x > 900, 'in a right-to-left layout the rail sits on the right')
  await snap(page, 'desktop-home')
  await page.goto(`${BASE}/#/words`)
  await page.getByRole('link', { name: /aufgeben/ }).click()
  await snap(page, 'desktop-word')
  // keyboard: space reveals, digits rate
  await page.goto(`${BASE}/#/study`)
  await page.getByRole('button', { name: 'نمایش جواب' }).waitFor()
  await page.keyboard.press('Space')
  await page.locator('.rating-3').waitFor()
  await page.keyboard.press('3')
  await page.waitForTimeout(200)
  assert((await state()).reviews.length === 1, 'keyboard answers are recorded')
  return page
})

await test('small phone, large text and landscape do not break the layout', async () => {
  const page = await newPage({ viewport: { width: 320, height: 568 } })
  await signUp(page)
  await createWord(page, 'aufgeben')
  for (const route of ['home', 'words', 'create', 'settings', 'study']) {
    await page.goto(`${BASE}/#/${route}`)
    await page.waitForTimeout(150)
    await noHorizontalScroll(page, `${route} at 320px`)
  }
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await noHorizontalScroll(page, 'study answer at 320px')
  await snap(page, 'small-phone-study')
  await page.setViewportSize({ width: 844, height: 390 })
  await page.goto(`${BASE}/#/home`)
  await noHorizontalScroll(page, 'home in landscape')
  await snap(page, 'landscape-home')
  return page
})

await test('batch import: list → drafts → confirm, skip, groups', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'schnell')
  await page.goto(`${BASE}/#/create`)
  await page.getByRole('link', { name: 'وارد کردن گروهی از روی لیست' }).click()
  await page.getByLabel('لیست لغت‌ها').fill('1. der Tisch - میز\n2. Lampe\nBescheid sagen\nqwrtzx\nschnell\ntisch\nein ganzer Satz mit viel zu vielen Wörtern, die niemand auf eine Karte schreiben würde, weil er einfach viel zu lang ist')
  await page.getByRole('button', { name: 'افزودن به دسته' }).click()
  await page.getByLabel('دستهٔ تازه').fill('درس ۱')
  await page.getByRole('dialog').getByRole('button', { name: 'افزودن', exact: true }).click()
  await snap(page, 'import-input')
  const before = (await state()).aiCalls
  await page.getByRole('button', { name: 'بررسی لیست' }).click()
  await page.getByRole('heading', { name: '۴ لغت برای ساختن' }).waitFor()
  await page.getByText('از قبل در بانک هست').waitFor() // schnell
  await page.getByText('خیلی بلند است', { exact: false }).waitFor() // the overlong sentence
  assert((await page.getByRole('listitem').count()) === 6, 'the repeated "tisch" was merged')
  assert((await state()).aiCalls === before, 'checking the list costs nothing')
  await noHorizontalScroll(page, 'import list')
  await snap(page, 'import-list')

  await page.getByRole('button', { name: 'ساخت ۴ کارت' }).click()
  await page.getByRole('heading', { name: 'der Tisch' }).waitFor()
  assert((await state()).words.length === 1, 'generated drafts are not saved by themselves')
  await page.getByText('کارت ۱ از ۴').waitFor()
  await noHorizontalScroll(page, 'import review')
  await snap(page, 'import-review')
  await page.getByRole('button', { name: 'تأیید و ذخیره' }).click()

  await page.getByRole('heading', { name: 'die Lampe' }).waitFor()
  await page.getByRole('button', { name: 'رد کن' }).click()

  await page.getByRole('heading', { name: 'Bescheid sagen' }).waitFor()
  await page.getByText('عبارت', { exact: true }).first().waitFor()
  // edit before confirming
  await page.getByRole('button', { name: 'ویرایش' }).click()
  await page.locator('[data-path="meanings.0.translation"]').fill('خبر دادن')
  await page.getByRole('button', { name: 'تأیید و ذخیره' }).click()

  await page.getByText('لیست تمام شد').waitFor()
  await page.getByText('۲ لغت ذخیره شد، ۱ رد شد، ۱ ساخته نشد.').waitFor()
  await page.getByText('«qwrtzx» ساخته نشد', { exact: false }).waitFor()
  await snap(page, 'import-done')
  let s = await state()
  const saved = s.words.filter((w) => w.lemma !== 'schnell')
  assert(saved.length === 2, `two words saved (got ${saved.length})`)
  assert(saved.every((w) => JSON.stringify(w.tags) === JSON.stringify(['درس ۱'])), 'imported words carry the group')
  const phrase = saved.find((w) => w.lemma === 'Bescheid sagen')
  assert(phrase.pos === 'phrase' && phrase.primary_meaning === 'خبر دادن' && phrase.source === 'manual', 'the edited expression was saved as edited')

  // the group shows up as a filter and on the word's page
  await page.getByRole('button', { name: 'دیدن بانک واژه' }).click()
  await page.getByText('۳ کلمه').waitFor()
  await page.getByRole('button', { name: 'فیلتر و ترتیب' }).click()
  await page.getByRole('dialog').getByRole('group', { name: 'دسته' }).getByRole('button', { name: /درس ۱/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'بستن' }).last().click()
  await page.getByText('۲ از ۳ کلمه').waitFor()
  await snap(page, 'bank-group-filter')
  await page.getByRole('link', { name: /Tisch/ }).click()
  await page.getByRole('button', { name: 'برداشتن از دستهٔ درس ۱' }).waitFor()
  await page.getByRole('button', { name: 'افزودن به دسته' }).click()
  await page.getByLabel('دستهٔ تازه').fill('خانه')
  await page.getByRole('dialog').getByRole('button', { name: 'افزودن', exact: true }).click()
  await page.waitForTimeout(250)
  s = await state()
  assert(JSON.stringify(s.words.find((w) => w.lemma === 'Tisch').tags) === JSON.stringify(['درس ۱', 'خانه']), 'groups can be changed on the word page')
  await noHorizontalScroll(page, 'word page with groups')
  await snap(page, 'word-groups')
  return page
})

await test('undo takes back the last answer, also from the summary', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'Tisch')
  await createWord(page, 'Lampe')
  await page.goto(`${BASE}/#/study`)
  const undo = page.getByRole('button', { name: 'برگرداندن جواب قبلی' })
  assert(await undo.isDisabled(), 'nothing to undo at the start')
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.rating-4').click() // "easy" by mistake
  await page.getByRole('heading', { name: 'die Lampe' }).or(page.getByText('die Lampe')).first().waitFor()
  await undo.click()
  await page.getByText('جواب قبلی برگشت.').waitFor()
  await page.getByRole('button', { name: 'نمایش جواب' }).waitFor()
  assert((await page.locator('.flashcard .word-title').innerText()).includes('Tisch'), 'the undone card is shown again')
  await snap(page, 'study-undo')
  await page.waitForTimeout(200)
  let s = await state()
  assert(s.reviews.length === 1 && s.reviews[0].undone_at, 'the review is kept and marked as undone')
  assert(s.cards.every((c) => c.state === 'new'), 'the card is new again on the server')

  // answer properly this time, finish, then undo from the summary
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.rating-4').click()
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.rating-4').click()
  await page.getByText('این دور تمام شد').waitFor()
  await page.getByRole('button', { name: 'برگرداندن آخرین جواب' }).click()
  await page.getByRole('button', { name: 'نمایش جواب' }).waitFor()
  await page.waitForTimeout(200)
  s = await state()
  assert(s.reviews.filter((r) => !r.undone_at).length === 1, 'one answer counts, two were undone')
  await page.goto(`${BASE}/#/home`)
  await page.locator('.perch-plan .count-new', { hasText: '۱' }).waitFor()
  return page
})

await test('reverse cards: optional, start after the word is learned, ask Persian → German', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'Tisch')
  await page.goto(`${BASE}/#/settings`)
  await page.getByText('کارت معکوس (فارسی به آلمانی)').click()
  await page.waitForTimeout(400)
  let s = await state()
  assert(s.settings[0].reverse_cards === true, 'the setting reached the server')
  assert(s.cards.length === 2 && s.cards.some((c) => c.card_type === 'production'), 'the reverse card was created for the existing word')
  await snap(page, 'settings-reverse')

  await page.goto(`${BASE}/#/home`)
  await page.locator('.perch-plan .count-new', { hasText: '۱' }).waitFor() // not two: the reverse card waits

  await page.goto(`${BASE}/#/study`)
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.rating-4').click()
  await page.getByText('این دور تمام شد').waitFor() // the reverse card is not shown the same day

  await control('shift-due', { days: 2 })
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'همگام‌سازی' }).click()
  await page.goto(`${BASE}/#/study`)
  await page.getByText('فارسی به آلمانی').waitFor()
  const front = await page.locator('.flashcard').innerText()
  assert(front.includes('میز') && !front.includes('Tisch'), `the reverse card shows the meaning and hides the German word: ${front}`)
  await snap(page, 'study-reverse-front')
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.flashcard-back .word-title', { hasText: 'Tisch' }).waitFor()
  await snap(page, 'study-reverse-back')
  await page.locator('.rating-3').click()
  await page.waitForTimeout(250)
  s = await state()
  const production = s.cards.find((c) => c.card_type === 'production')
  assert(production.state === 'learning', 'the reverse card has its own schedule')

  await page.goto(`${BASE}/#/words`)
  await page.getByRole('link', { name: /Tisch/ }).click()
  await page.getByText('کارت معکوس (فارسی به آلمانی)').waitFor()
  return page
})

await test('quiz: der/die/das, multiple choice and typing; never touches the cards', async () => {
  const page = await newPage()
  await signUp(page)
  for (const word of ['Tisch', 'Lampe', 'Stuhl', 'Haus', 'aufgeben']) await createWord(page, word)
  const cardsBefore = JSON.stringify((await state()).cards.map((c) => [c.state, c.reps]))

  await page.getByRole('link', { name: 'آزمون' }).click()
  await page.getByRole('radio', { name: /der \/ die \/ das/ }).click()
  await page.getByRole('button', { name: '۵ سؤال' }).click()
  await noHorizontalScroll(page, 'quiz setup')
  await snap(page, 'quiz-setup')
  await page.getByRole('button', { name: 'شروع آزمون' }).click()

  const ARTICLE = { Tisch: 'der', Lampe: 'die', Stuhl: 'der', Haus: 'das' }
  for (let i = 0; i < 4; i++) {
    await page.getByText(`سؤال ${['۱', '۲', '۳', '۴'][i]} از ۴`).first().waitFor()
    const noun = (await page.locator('.quiz-card .word-title').innerText()).trim()
    const right = ARTICLE[noun]
    assert(right, `an article question about a noun (got "${noun}")`)
    const pick = i === 0 ? ['der', 'die', 'das'].find((a) => a !== right) : right // first one wrong on purpose
    if (i === 0) await snap(page, 'quiz-article')
    await page.locator('.quiz-options').getByRole('button', { name: pick, exact: true }).click()
    await page.getByText(i === 0 ? 'درست نبود.' : 'درست است!').waitFor()
    if (i === 0) await snap(page, 'quiz-feedback-wrong')
    await page.getByRole('button', { name: i === 3 ? 'دیدن نتیجه' : 'بعدی' }).click()
  }
  await page.getByText('نتیجهٔ آزمون').waitFor()
  await page.getByText('۳ از ۴').waitFor()
  await page.getByText('این‌ها را دوباره ببین').waitFor()
  await snap(page, 'quiz-result')
  let s = await state()
  assert(s.quizSessions.length === 1 && s.quizSessions[0].kind === 'article' && s.quizSessions[0].correct === 3, 'the quiz was stored')
  assert(s.quizAnswers.length === 4 && s.quizAnswers.filter((a) => !a.is_correct).length === 1, 'every answer was stored')

  // multiple choice by keyboard-free taps
  await page.getByRole('button', { name: 'یک آزمون دیگر' }).click()
  await page.getByRole('radio', { name: /چهارگزینه‌ای/ }).click()
  await page.getByRole('button', { name: 'شروع آزمون' }).click()
  await page.locator('.quiz-option').first().waitFor()
  assert((await page.locator('.quiz-option').count()) === 4, 'four options')
  await snap(page, 'quiz-choice')
  await page.locator('.quiz-option').first().click()
  await page.getByRole('button', { name: 'بعدی' }).waitFor()
  assert((await page.locator('.quiz-option.is-correct').count()) === 1, 'the right answer is marked')
  // leave half-way: what was answered is kept
  await page.getByRole('button', { name: 'خروج از آزمون' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'خروج از آزمون' }).click()
  await page.getByRole('button', { name: 'شروع آزمون' }).waitFor()
  await page.waitForTimeout(200)
  assert((await state()).quizSessions.length === 2, 'a quiz left half-way is still stored')

  // typing: a wrong article, a lower-case noun, "don't know"
  await page.getByRole('radio', { name: /نوشتاری/ }).click()
  await page.getByRole('button', { name: 'شروع آزمون' }).click()
  const MEANING = { 'میز': ['Tisch', 'der'], 'چراغ': ['Lampe', 'die'], 'صندلی': ['Stuhl', 'der'], 'خانه': ['Haus', 'das'], 'تسلیم شدن، دست کشیدن': ['aufgeben', null] }
  const seen = []
  for (let i = 0; i < 5; i++) {
    const meaning = (await page.locator('.quiz-card .meaning-title').innerText()).trim()
    const [lemma, article] = MEANING[meaning]
    const field = page.getByLabel('به آلمانی بنویس')
    if (i === 0) {
      await snap(page, 'quiz-typing')
      await page.getByRole('button', { name: 'نمی‌دانم' }).click()
      await page.getByText('درست نبود.').waitFor()
    } else if (article && !seen.includes('wrong-article')) {
      seen.push('wrong-article')
      await field.fill(`${article === 'der' ? 'die' : 'der'} ${lemma}`)
      await page.getByRole('button', { name: 'بررسی' }).click()
      await page.getByText('خود کلمه درست بود، ولی حرف تعریفش نه.').waitFor()
    } else if (article && !seen.includes('case')) {
      seen.push('case')
      await field.fill(lemma.toLowerCase())
      await field.press('Enter')
      await page.getByText('درست است؛ فقط حواست به حرف بزرگ و کوچک باشد.').waitFor()
    } else {
      await field.fill(article ? `${article} ${lemma}` : lemma)
      await page.getByRole('button', { name: 'بررسی' }).click()
      await page.getByText('درست است!').waitFor()
    }
    await page.getByRole('button', { name: i === 4 ? 'دیدن نتیجه' : 'بعدی' }).click()
  }
  await page.getByText('نتیجهٔ آزمون').waitFor()
  await page.getByText('۳ از ۵').waitFor()
  s = await state()
  assert(s.quizSessions.length === 3, 'three quizzes stored')
  assert(s.reviews.length === 0, 'quiz answers are not reviews')
  assert(JSON.stringify(s.cards.map((c) => [c.state, c.reps])) === cardsBefore, 'no card was moved by a quiz')
  return page
})

await test('statistics show progress on phone and desktop', async () => {
  const page = await newPage()
  await signUp(page)
  for (const word of ['Tisch', 'Lampe', 'aufgeben', 'schnell']) await createWord(page, word)
  await page.goto(`${BASE}/#/study`)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'نمایش جواب' }).click()
    await page.locator(i === 0 ? '.rating-1' : '.rating-4').click()
    await page.waitForTimeout(60)
  }
  await page.goto(`${BASE}/#/home`)
  await page.getByRole('link', { name: /آمار/ }).click()
  await page.getByRole('heading', { name: 'آمار' }).waitFor()
  await page.getByText('۴ لغت در بانک').waitFor()
  await page.getByText('پنج هفتهٔ اخیر').waitFor()
  assert((await page.locator('.journey .station').count()) === 4, 'the word journey has four stations')
  assert((await page.locator('.heat li').count()) === 35, 'five weeks of days')
  assert((await page.locator('.heat li.heat-1').count()) === 1, 'today is coloured')
  await page.locator('.said li', { hasText: 'کارت مرور کردی' }).locator('b', { hasText: '۳' }).waitFor()
  assert((await page.locator('.chart-col').count()) === 14, 'a fourteen-day forecast')
  await page.getByRole('button', { name: 'امروز', exact: true }).click()
  await page.locator('.summary-grid.four .plan-number b', { hasText: '۳' }).first().waitFor()
  await noHorizontalScroll(page, 'stats')
  await snap(page, 'stats-top')
  await page.evaluate(() => window.scrollTo(0, 900))
  await snap(page, 'stats-charts')
  await page.setViewportSize({ width: 320, height: 568 })
  await noHorizontalScroll(page, 'stats at 320px')
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await noHorizontalScroll(page, 'stats on desktop')
  await snap(page, 'stats-desktop')
  await page.getByRole('button', { name: 'تیره' }).count() // (settings not on this page)
  return page
})

await test('the bird is on every main screen and reacts', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'Tisch')
  await createWord(page, 'Lampe')
  for (const route of ['home', 'quiz', 'stats', 'study']) {
    await page.goto(`${BASE}/#/${route}`)
    await page.locator('main .mascot').first().waitFor()
  }
  await page.goto(`${BASE}/#/study`)
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.locator('.rating-1').click()
  await page.locator('.companion .mood-supportive').waitFor()
  await page.locator('.burst').count() // hearts come only for remembered words
  await page.getByText('اشکالی ندارد، دوباره امتحانش می‌کنیم.').waitFor()
  await snap(page, 'study-companion')
  await page.goto(`${BASE}/#/home`)
  await page.getByRole('button', { name: 'هدهد' }).click()
  await page.locator('.perch .mood-happy').waitFor()
  await page.locator('.burst-piece').first().waitFor({ state: 'attached' })
  await snap(page, 'home-bird')
  // five tabs fit on the smallest phone without wrapping
  await page.setViewportSize({ width: 320, height: 568 })
  const heights = await page.locator('.nav-item').evaluateAll((items) => items.map((i) => i.getBoundingClientRect().height))
  assert(heights.length === 5 && Math.max(...heights) - Math.min(...heights) < 2, `nav labels stay on one line: ${heights}`)
  await noHorizontalScroll(page, 'home with five tabs at 320px')
  return page
})

await test('welcome tour for a new account; its answers become the settings', async () => {
  await control('reset', { welcome: true })
  const page = await newPage()
  await signUp(page, { name: 'مریم' }).catch(() => undefined)
  await page.getByRole('heading', { name: 'سلام مریم، خوش آمدی!' }).waitFor()
  await page.locator('.welcome-bird .mascot').waitFor()
  await page.waitForTimeout(1400) // the bird has flown in
  await snap(page, 'welcome-hello')
  await page.getByRole('button', { name: 'شروع کنیم' }).click()
  await page.getByRole('radio', { name: /۲۰ دقیقه/ }).click()
  await snap(page, 'welcome-time')
  await page.getByRole('button', { name: 'ادامه' }).click()
  await page.getByRole('radio', { name: /کمی بلدم/ }).click()
  await page.locator('.welcome-perday .big-number', { hasText: '۱۰' }).waitFor() // 20 minutes, some German
  await page.getByRole('button', { name: 'بیشتر' }).click()
  await snap(page, 'welcome-level')
  await page.getByRole('button', { name: 'ادامه' }).click()
  await page.getByRole('heading', { name: 'برنامه‌ات آماده است!' }).waitFor()
  await page.getByText('هر روز ۲۰ دقیقه، با ۱۱ کلمهٔ تازه', { exact: false }).waitFor()
  await noHorizontalScroll(page, 'welcome')
  await snap(page, 'welcome-ready')
  await page.getByRole('button', { name: 'برو به صفحهٔ اصلی' }).click()
  await page.locator('.perch').waitFor()
  await page.waitForTimeout(300)
  const s = await state()
  assert(s.settings[0].daily_goal_minutes === 20 && s.settings[0].new_per_day === 11, 'the answers are saved')
  assert(s.settings[0].onboarded_at && s.settings[0].time_zone === 'Europe/Berlin', 'the tour is marked as done, with the time zone')
  // the tour does not come back
  await page.reload()
  await page.locator('.perch').waitFor()
  assert(!page.url().includes('welcome'), 'no second tour')
  await control('reset', {})
  return page
})

await test('a three-day streak gets a big celebration, once', async () => {
  const page = await newPage()
  await signUp(page)
  for (let day = 0; day < 3; day++) {
    await createWord(page, ['Tisch', 'Lampe', 'Stuhl'][day])
    await page.goto(`${BASE}/#/study`)
    await page.getByRole('button', { name: 'نمایش جواب' }).click()
    await page.locator('.rating-4').click()
    if (day < 2) {
      await page.getByText('این دور تمام شد').waitFor()
      await control('shift-due', { days: 1 })
      await page.goto(`${BASE}/#/settings`)
      await page.getByRole('button', { name: 'همگام‌سازی' }).click()
      await page.waitForTimeout(300)
    }
  }
  await page.getByRole('dialog', { name: '۳ روز پشت سر هم!' }).waitFor()
  await page.locator('.celebration-number', { hasText: '۳' }).waitFor()
  await page.waitForTimeout(1300)
  await snap(page, 'celebration')
  await page.getByRole('button', { name: 'ادامه' }).click()
  await page.goto(`${BASE}/#/home`)
  await page.locator('.streak-mini .streak-number', { hasText: '۳' }).waitFor()
  await page.waitForTimeout(500)
  assert((await page.locator('.celebration').count()) === 0, 'celebrated only once')
  await snap(page, 'home-streak')
  await page.goto(`${BASE}/#/stats`)
  await page.locator('.heat li.heat-1').nth(2).waitFor()
  await snap(page, 'stats-new-top')
  await page.evaluate(() => window.scrollTo(0, 700))
  await snap(page, 'stats-new-middle')
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto(`${BASE}/#/home`)
  await page.locator('.perch').waitFor()
  await page.waitForTimeout(400)
  await snap(page, 'home-new-dark')
  return page
})

await test('sentences and idioms get their own card details', async () => {
  const page = await newPage()
  await signUp(page)
  await page.goto(`${BASE}/#/create`)
  await page.getByLabel('کلمه یا عبارت آلمانی').fill("wie geht's dir?")
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('پیش‌نویس است و هنوز ذخیره نشده').waitFor()
  await page.getByRole('heading', { name: 'ترجمه' }).waitFor()
  await page.getByText('حالت چطور است؟').waitFor()
  await page.getByText('خودمانی', { exact: true }).waitFor()
  await page.getByText('Danke, gut. Und dir?').waitFor()
  await page.getByText('Wie geht es dir?').waitFor()
  await noHorizontalScroll(page, 'sentence draft')
  await snap(page, 'sentence-draft')
  await page.getByRole('button', { name: 'تأیید و ذخیره' }).click()
  await page.getByText('وضعیت یادگیری').waitFor()
  let s = await state()
  assert(s.words[0].pos === 'sentence' && s.words[0].content.reply.de === 'Danke, gut. Und dir?', 'the sentence is stored with its details')

  await createWord(page, 'die Nase voll haben')
  await page.getByText('«دماغ را پُر داشتن»').waitFor()
  await snap(page, 'idiom-detail')
  // the editor shows the new fields
  await page.getByRole('button', { name: 'ویرایش' }).first().click()
  await page.getByText('جزئیات عبارت و جمله').waitFor()
  await page.locator('[data-path="literal"]').fill('«بینی را پر داشتن»')
  await page.getByRole('button', { name: /ذخیره/ }).first().click()
  await page.getByText('«بینی را پر داشتن»').waitFor()

  // studying a sentence: the long German text fits the card
  await page.goto(`${BASE}/#/study`)
  await page.getByRole('button', { name: 'نمایش جواب' }).waitFor()
  await noHorizontalScroll(page, 'sentence card')
  await snap(page, 'study-sentence')
  return page
})


await test('admin builds a pack; a learner takes a lesson from the store', async () => {
  const page = await newPage()
  await signUp(page)
  await control('make-admin', { email: 'sohrab@example.test' })
  await page.reload()
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('link', { name: 'پنل مدیریت' }).click()

  // money: a top-up makes the remaining credit known
  await page.getByRole('heading', { name: 'اعتبار هوش مصنوعی' }).waitFor()
  await page.getByLabel('مبلغ (دلار)').fill('5')
  await page.getByRole('button', { name: 'ثبت شارژ' }).click()
  await page.getByText('$5.00', { exact: true }).first().waitFor()
  await noHorizontalScroll(page, 'admin overview')
  await snap(page, 'admin-overview')

  // a new pack
  await page.getByRole('link', { name: 'بسته‌ها' }).click()
  await page.getByLabel('عنوان', { exact: true }).fill('وسایل خانه')
  await page.getByLabel('نشانی (حروف انگلیسی کوچک و خط تیره)').fill('home-things')
  await page.getByRole('button', { name: 'بستهٔ تازه' }).click()
  await page.waitForURL(/#\/admin\/packs\/[^/]+$/)
  await page.getByText('ویرایش', { exact: true }).click()
  await page.getByLabel('تعداد مورد در هر درس').fill('5')
  await page.getByLabel('ایموجی').fill('🏠')
  await page.getByRole('button', { name: 'ذخیرهٔ مشخصات' }).click()
  await page.getByText('ذخیره شد').first().waitFor()

  await page.getByLabel('افزودن فهرست').fill('die Lampe\nder Stuhl\ndas Haus | خانه\ndas Fenster\nder Tisch\nschnell\nder Stuhl')
  await page.getByRole('button', { name: 'افزودن به فهرست' }).click()
  await page.getByText('۶ مورد اضافه شد').waitFor()
  let p = await control('platform')
  assert(p.pack_items.length === 6 && p.pack_items.filter((i) => i.lesson === 2).length === 1, 'six items in lessons of five')
  assert(p.pack_items.find((i) => i.input === 'das Haus').hint === 'خانه', 'the meaning hint is kept')
  await page.getByRole('button', { name: /ساختن ۶ کارت/ }).click()
  await page.getByText('۶ کارت ساخته شد').waitFor()
  await noHorizontalScroll(page, 'pack builder')
  await snap(page, 'admin-pack-builder')
  await page.getByRole('button', { name: 'انتشار در فروشگاه' }).click()
  await page.getByRole('button', { name: 'برگرداندن به پیش‌نویس' }).waitFor()

  // the learner's side
  await page.goto(`${BASE}/#/home`)
  await page.getByRole('link', { name: /بسته‌های واژه/ }).click()
  await page.getByText('وسایل خانه').waitFor()
  await noHorizontalScroll(page, 'store')
  await snap(page, 'store')
  await page.getByText('وسایل خانه').click()
  await page.getByRole('button', { name: 'شروع درس ۱' }).waitFor()
  await page.getByText('این درس وقتی باز می‌شود').waitFor() // lesson 2 waits for lesson 1
  await noHorizontalScroll(page, 'pack page')
  await snap(page, 'pack-page')
  await page.getByRole('button', { name: 'شروع درس ۱' }).click()
  await page.waitForURL(/#\/study\?pack=/)
  await page.getByRole('button', { name: 'نمایش جواب' }).waitFor()
  const s = await state()
  assert(s.words.length === 5 && s.words.every((w) => w.source === 'pack' && w.pack_id), 'the lesson words are in the bank, tagged with the pack')
  await page.getByRole('button', { name: 'نمایش جواب' }).click()
  await page.getByRole('button', { name: /^یادم آمد/ }).first().click()
  await page.getByRole('button', { name: 'خروج' }).click()
  await page.waitForURL(/#\/store\//)
  await page.getByText('۰ از ۵ یاد گرفته').waitFor()
  await page.getByRole('link', { name: 'مرور همین بسته' }).waitFor()
  await snap(page, 'pack-progress')

  // someone else cannot open the panel
  const other = await newPage()
  await signUp(other, { email: 'nahid@example.test', name: 'ناهید' })
  await other.goto(`${BASE}/#/admin`)
  await other.getByText('این بخش فقط برای مدیر است.').waitFor()
  await other.goto(`${BASE}/#/store`)
  await other.getByText('وسایل خانه').waitFor()
  await other.context().close()
  lastPage = page
  return page
})

await test('a wrong card is reported and fixed for everyone from the admin inbox', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'schnell')
  await page.getByRole('button', { name: 'گزارش اشکال این کارت' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'مثال‌ها' }).click()
  await page.getByLabel('توضیح (اختیاری)').fill('مثال اول ساده نیست')
  await snap(page, 'report-sheet')
  await page.getByRole('button', { name: 'فرستادن گزارش' }).click()
  await page.getByText('ممنون! گزارشت رسید').waitFor()

  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'گزارش مشکل یا پیشنهاد' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'پیشنهاد' }).click()
  await page.getByRole('dialog').locator('textarea').fill('حالت شب بیشتر')
  await page.getByRole('button', { name: 'فرستادن', exact: true }).click()
  await page.getByText('ممنون! پیامت رسید.').waitFor()
  let p = await control('platform')
  assert(p.card_reports[0].reason === 'example' && p.card_reports[0].lemma === 'schnell', 'the report is stored')
  assert(p.feedback[0].kind === 'idea' && p.feedback[0].message === 'حالت شب بیشتر', 'the idea is stored')

  await control('make-admin', { email: 'sohrab@example.test' })
  await control('seed-user', { email: 'nahid@example.test', password: 'secret123', name: 'ناهید' })
  await page.reload()
  await page.goto(`${BASE}/#/admin/inbox`)
  await page.getByText('حالت شب بیشتر').waitFor()
  await noHorizontalScroll(page, 'admin inbox')
  await snap(page, 'admin-inbox')
  await page.getByRole('link', { name: 'درست کردن کارت' }).click()
  await page.locator('[data-path="meanings.0.translation"]').fill('تند، چابک')
  await page.getByRole('button', { name: 'ذخیره برای همه' }).click()
  await page.getByText('کارت مشترک درست شد').waitFor()
  p = await control('platform')
  assert(p.card_reports[0].status === 'fixed', 'the report is closed')
  assert(p.ai_word_cache.some((c) => c.result.content.meanings[0].translation === 'تند، چابک'), 'the shared card is corrected')

  // users: block someone
  await page.goto(`${BASE}/#/admin/users`)
  await page.getByText('nahid@example.test').waitFor()
  await snap(page, 'admin-users')
  await page.locator('.user-card', { hasText: 'nahid@example.test' }).getByRole('button', { name: 'مسدود کردن' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'مسدود کردن' }).click()
  await page.getByText('مسدود شد', { exact: true }).waitFor()
  p = await control('platform')
  assert(p.user_limits.some((l) => l.blocked === true), 'the account is blocked for the AI too')

  // announcement: shown once on the home screen
  await page.goto(`${BASE}/#/admin/news`)
  await page.getByLabel('عنوان').fill('بسته‌های تازه آمد!')
  await page.getByRole('button', { name: 'انتشار اطلاعیه' }).click()
  await page.getByText('منتشر شد').waitFor()
  await page.reload()
  await page.goto(`${BASE}/#/home`)
  await page.getByText('بسته‌های تازه آمد!').waitFor()
  await snap(page, 'home-news')
  await page.getByRole('button', { name: 'دیدم' }).click()
  await page.getByText('بسته‌های تازه آمد!').waitFor({ state: 'detached' })
  return page
})

await test('natural voice: generated once, then played from the saved file; the phone voice when switched off', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'der Tisch')
  const played = () => page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/storage/v1/object/public/tts/')).length)
  await page.getByRole('button', { name: /^پخش تلفظ/ }).first().click()
  await page.waitForFunction(() => performance.getEntriesByType('resource').some((e) => e.name.includes('/storage/v1/object/public/tts/')))
  let p = await control('platform')
  assert(p.tts_cache.length === 1 && p.ttsCalls === 1, 'the recording is made once')
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /^پخش تلفظ/ }).first().click()
  await page.waitForTimeout(600)
  p = await control('platform')
  assert(p.ttsCalls === 1, 'the second play needs no server call')

  // a male voice is a different recording
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('heading', { name: 'یادآوری‌ها' }).waitFor()
  await page.getByText('این مرورگر اعلان پشتیبانی نمی‌کند.').waitFor() // the test server is plain http
  await page.getByRole('button', { name: 'صدای مرد' }).click()
  await page.waitForFunction(() => performance.getEntriesByType('resource').filter((e) => e.name.includes('/storage/v1/object/public/tts/')).length >= 2)
  p = await control('platform')
  assert(p.tts_cache.length === 2, 'female and male recordings are kept apart')
  await snap(page, 'settings-voice')

  // switched off: no server call at all
  await page.getByText('صدای طبیعی (هوش مصنوعی)').click()
  await page.getByRole('button', { name: 'امتحان صدا' }).click()
  await page.waitForTimeout(500)
  assert((await control('platform')).ttsCalls === 2, 'with the natural voice off nothing is generated')
  assert((await played()) >= 2, 'the saved recordings were played')
  return page
})

await test('a newer version offers a reload', async () => {
  const page = await newPage()
  await signUp(page)
  await page.evaluate(() => window.dispatchEvent(new Event('hodhod:update-ready')))
  await page.getByText('نسخهٔ تازهٔ هدهد آمد!').waitFor()
  await noHorizontalScroll(page, 'update banner')
  await snap(page, 'update-banner')
  await page.getByRole('button', { name: 'تازه کن' }).click()
  await page.waitForLoadState('load')
  await page.getByRole('heading', { name: /سهراب/ }).waitFor()
  assert((await page.locator('.update-banner').count()) === 0, 'the banner is gone after reloading')
  return page
})

await test('an Anki deck comes in as cards, and the bank goes out for Anki', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'der Tisch') // already in the bank: not imported twice
  await page.goto(`${BASE}/#/import`)
  await page.getByRole('link', { name: 'وارد کردن از Anki یا Quizlet' }).click()
  await page.locator('#deck-file').setInputFiles(join(here, '..', 'fixtures', 'anki-deck.txt'))
  await page.getByText('۴ کارت پیدا شد').waitFor()
  await page.getByText('از قبل در بانک واژه هست').waitFor()
  await noHorizontalScroll(page, 'deck preview')
  await snap(page, 'deck-preview')

  // complete cards with the AI: the German side goes to the list import
  await page.getByRole('button', { name: /کارت کامل با هوش مصنوعی/ }).click()
  await page.waitForURL(/#\/import$/)
  const list = await page.getByLabel('لیست لغت‌ها').inputValue()
  assert(list.includes('die Lampe') && list.includes('Bescheid sagen') && !list.includes('der Tisch'), 'the new German entries are filled in')

  // or as they are, without the AI
  await page.goto(`${BASE}/#/import/deck`)
  await page.getByLabel('یا متن را اینجا بچسبان').fill('die Lampe\tچراغ\nBescheid sagen\tخبر دادن\nKannst du mir helfen?\tمی‌توانی کمکم کنی؟')
  await page.getByRole('button', { name: 'خواندن متن' }).click()
  await page.getByRole('button', { name: 'وارد کردن ۳ کارت' }).click()
  await page.getByText('۳ کارت به بانک واژه اضافه شد').waitFor()
  await page.waitForURL(/#\/words$/)
  await page.getByText('خبر دادن').waitFor()
  const s = await state()
  const lampe = s.words.find((w) => w.lemma === 'Lampe')
  assert(lampe && lampe.pos === 'noun' && lampe.content.noun.article === 'die' && lampe.source === 'import' && lampe.tags.includes('Anki'), 'nouns keep their article')
  assert(s.cards.length === 4, 'every imported word got its card')

  // export for Anki
  await page.goto(`${BASE}/#/settings`)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'خروجی برای Anki' }).click()
  const file = await download
  const text = await (await import('node:fs/promises')).readFile(await file.path(), 'utf8')
  assert(text.startsWith('#separator:tab') && text.includes('die Lampe\tچراغ'), 'the export is an Anki text file')
  return page
})

await test('a short story is written around the words being learned', async () => {
  const page = await newPage()
  await signUp(page)
  await page.goto(`${BASE}/#/stories`)
  await page.getByText('برای داستان دست‌کم ۳ واژه لازم است').waitFor()
  for (const w of ['die Lampe', 'der Tisch', 'Bescheid sagen']) await createWord(page, w)
  await page.goto(`${BASE}/#/study`)
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'نمایش جواب' }).click()
    await page.getByRole('button', { name: /^یادم آمد/ }).first().click()
  }
  await page.goto(`${BASE}/#/home`)
  await page.getByRole('link', { name: /^داستان/ }).click()
  await page.getByText('Bescheid sagen', { exact: true }).waitFor()
  await snap(page, 'story-maker')
  await page.getByRole('button', { name: 'نوشتن داستان' }).click()
  await page.waitForURL(/#\/stories\/[^/]+$/)
  await page.getByRole('heading', { name: 'Ein Abend zu Hause' }).waitFor()
  assert((await page.locator('.story-de mark').count()) >= 3, 'the learner\'s own words are marked')
  await page.locator('.story-de', { hasText: 'Dann ruft sie' }).click()
  await page.getByText('بعد به مادرش زنگ می‌زند.').waitFor()
  await noHorizontalScroll(page, 'story')
  await snap(page, 'story')
  await page.goto(`${BASE}/#/stories`)
  await page.getByText('یک شب در خانه').waitFor()
  return page
})

await test('friends add each other by code and share a weekly board', async () => {
  const sohrab = await newPage()
  await signUp(sohrab)
  await sohrab.getByRole('link', { name: /با دوستان/ }).click()
  const code = (await sohrab.locator('.friend-code').innerText()).replace(/\s/g, '')
  assert(/^[A-Z2-9]{8}$/.test(code), `a friend code is shown (${code})`)

  const nahid = await newPage()
  await signUp(nahid, { email: 'nahid@example.test', name: 'ناهید' })
  await nahid.goto(`${BASE}/#/friends`)
  await nahid.getByLabel('کد دوستی').fill(code.toLowerCase())
  await nahid.getByRole('button', { name: 'افزودن' }).click()
  await nahid.getByText('درخواست فرستاده شد').waitFor()
  await nahid.getByText('منتظر جواب: سهراب').waitFor()
  await nahid.context().close()

  lastPage = sohrab
  await sohrab.reload()
  await sohrab.getByText('درخواست‌های دوستی').waitFor()
  await sohrab.getByRole('button', { name: 'قبول' }).click()
  await sohrab.getByText('درخواست‌های دوستی').waitFor({ state: 'detached' })
  await sohrab.locator('.board-row', { hasText: 'ناهید' }).waitFor()
  assert((await sohrab.locator('.board-row').count()) === 2, 'both are on the board')
  await noHorizontalScroll(sohrab, 'friends')
  await snap(sohrab, 'friends')
  return sohrab
})

await test('listening and speaking practice', async () => {
  const page = await newPage()
  // a stand-in for the browser's speech recogniser that "hears" a fixed sentence
  await page.addInitScript(() => {
    class FakeRecognition {
      start() {
        setTimeout(() => {
          this.onresult?.({ results: [[{ transcript: window.__heard ?? 'wie geht es dir' }]] })
          this.onend?.()
        }, 200)
      }
      stop() {}
      abort() {}
    }
    window.webkitSpeechRecognition = FakeRecognition
    window.SpeechRecognition = FakeRecognition
  })
  await signUp(page)
  await createWord(page, "wie geht's dir?")
  await page.goto(`${BASE}/#/quiz`)
  await page.getByRole('radio', { name: /شنیداری/ }).click()
  await page.getByRole('button', { name: /۵ سؤال/ }).click()
  await page.getByRole('button', { name: 'شروع آزمون' }).click()
  await page.getByText('گوش بده و بنویس').waitFor()
  assert(!(await page.locator('.quiz-card').innerText()).includes('geht'), 'the text is not shown before answering')
  await snap(page, 'quiz-dictation')
  await page.getByLabel('به آلمانی بنویس').fill("wie geht's dir")
  await page.getByRole('button', { name: 'بررسی' }).click()
  await page.locator('.bubble.ok').waitFor()
  await page.getByRole('button', { name: 'دیدن نتیجه' }).click()

  await page.getByRole('button', { name: 'یک آزمون دیگر' }).click()
  await page.getByRole('radio', { name: /گفتاری/ }).click()
  await page.getByRole('button', { name: 'شروع آزمون' }).click()
  await page.getByText('بلند بگو', { exact: true }).waitFor()
  await snap(page, 'quiz-speaking')
  await page.evaluate(() => (window.__heard = "wie geht's dir"))
  await page.getByRole('button', { name: 'بزن و بگو' }).click()
  await page.locator('.bubble.ok').waitFor()
  await page.getByText("شنیدم: «wie geht's dir»").waitFor()
  await noHorizontalScroll(page, 'speaking feedback')
  const s = await state()
  assert(s.quizAnswers.some((a) => a.question_type === 'dictation' && a.is_correct), 'the dictation answer is saved')
  return page
})

await test('sign-up asks the human check when the server wants one', async () => {
  await control('captcha', { on: true })
  const page = await newPage()
  // a stand-in for Cloudflare Turnstile: passes after a moment
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "window.turnstile = { render(el, o) { el.textContent = 'human check'; setTimeout(() => o.callback('test-token'), 100); return 'w1' }, reset() {}, remove() {} }",
    }),
  )
  await signUp(page)
  // the token is single-use: a later sign-in gets a fresh one
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'خروج از حساب' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'خروج از حساب' }).click()
  await page.getByLabel('ایمیل').fill('sohrab@example.test')
  await page.getByLabel('رمز عبور').fill('correct horse battery')
  await page.getByRole('button', { name: 'وارد شو' }).click()
  await page.getByRole('heading', { name: /سهراب/ }).waitFor()
  return page
})

await test('the test version under /staging/ is marked and keeps its own sign-in', async () => {
  const page = await newPage()
  await signUp(page) // the real app
  await page.goto(`${BASE}/staging/`)
  await page.locator('.staging-ribbon').waitFor()
  // not signed in there: the session of the real app is not shared
  await page.getByRole('button', { name: 'ساخت حساب', exact: true }).waitFor()
  await snap(page, 'staging')
  await page.goto(`${BASE}/`)
  await page.getByRole('heading', { name: /سهراب/ }).waitFor()
  assert((await page.locator('.staging-ribbon').count()) === 0, 'the real app has no ribbon')
  return page
})

await test('after the update, an existing learner sees what is new and sets the daily plan again', async () => {
  const page = await newPage()
  await signUp(page)
  await createWord(page, 'der Tisch')
  await control('forget-welcome')
  await page.goto(`${BASE}/#/home`)
  await page.reload()
  await page.getByRole('heading', { name: 'سهراب، هدهد تازه شد!' }).waitFor()
  await page.getByText('داستان کوتاه با واژه‌های خودت').waitFor()
  await noHorizontalScroll(page, 'whats new')
  await snap(page, 'welcome-back')
  await page.getByRole('button', { name: 'ادامه' }).click()
  await page.getByRole('radio', { name: /۳۰ دقیقه/ }).click()
  await page.getByRole('button', { name: 'ادامه' }).click()
  await page.getByRole('button', { name: 'ادامه' }).click()
  await page.getByRole('button', { name: 'برو به صفحهٔ اصلی' }).click()
  await page.getByRole('heading', { name: /سهراب/ }).waitFor()
  const s = await state()
  assert(s.settings[0].daily_goal_minutes === 30 && s.settings[0].onboarded_at, 'the new plan is saved and the tour is done')
  assert(s.words.length === 1, 'the words are untouched')
  return page
})

// ---------------------------------------------------------------------------------------------

await browser.close()
server.kill()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
