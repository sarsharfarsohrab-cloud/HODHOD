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
  await page.getByLabel('کلمه یا عبارت آلمانی').fill('ich gehe heute Abend nach Hause')
  await page.getByRole('button', { name: 'ساخت کارت' }).click()
  await page.getByText('این یک جمله است.', { exact: false }).waitFor()
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
  await page.getByText('برنامهٔ امروز').waitFor()
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
  assert(/دوباره[\s\S]*۱ دقیقه/.test(ratings[0]) && /خوب[\s\S]*۱۰ دقیقه/.test(ratings[2]), `intervals come from the scheduler: ${JSON.stringify(ratings)}`)
  assert(/آسان[\s\S]*روز/.test(ratings[3]), 'easy graduates to days')
  await noHorizontalScroll(page, 'study')
  await snap(page, 'study-back')

  await page.locator('.rating-1').click() // again on aufgeben
  await page.getByText('اشکال نداره، دوباره امتحانش می‌کنیم.').waitFor()
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
  await page.getByText('۱ روز پیاپی').waitFor()
  await page.getByText('کار امروز', { exact: false }).first().waitFor({ timeout: 2000 }).catch(() => {})
  await snap(page, 'home-after-study')

  // --- "return later": the cards come due again according to the scheduler
  await control('shift-due', { days: 30 })
  await page.goto(`${BASE}/#/settings`)
  await page.getByRole('button', { name: 'همگام‌سازی' }).click()
  await page.goto(`${BASE}/#/home`)
  await page.locator('.plan-number .count-review', { hasText: '۳' }).waitFor()
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
  await page.getByText(/از ۳۰ دقیقه/).waitFor()
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
  await page.getByText('۳ کلمه').waitFor()
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
  await page.locator('.plan-number .count-new', { hasText: '۱۰' }).waitFor()
  await page.getByText('۲ کلمهٔ ذخیره‌شده در صف روزهای بعد است.').waitFor()
  await page.getByText('۱۲ کلمه').waitFor()
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
  await page.getByText('فعلاً نتونستم این کلمه رو آماده کنم.').waitFor()
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
  await page.getByText('دارم اطلاعات این کلمه رو آماده می‌کنم…').waitFor()
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
  await page.getByLabel('لیست لغت‌ها').fill('1. der Tisch - میز\n2. Lampe\nBescheid sagen\nqwrtzx\nschnell\ntisch\nein ganzer Satz mit zu vielen Wörtern')
  await page.getByRole('button', { name: 'افزودن به دسته' }).click()
  await page.getByLabel('دستهٔ تازه').fill('درس ۱')
  await page.getByRole('dialog').getByRole('button', { name: 'افزودن', exact: true }).click()
  await snap(page, 'import-input')
  const before = (await state()).aiCalls
  await page.getByRole('button', { name: 'بررسی لیست' }).click()
  await page.getByRole('heading', { name: '۴ لغت برای ساختن' }).waitFor()
  await page.getByText('از قبل در بانک هست').waitFor() // schnell
  await page.getByText('این یک جمله است.', { exact: false }).waitFor() // the sentence
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
  await page.getByRole('button', { name: 'برگرداندن جواب قبلی' }).click()
  await page.getByRole('button', { name: 'نمایش جواب' }).waitFor()
  await page.waitForTimeout(200)
  s = await state()
  assert(s.reviews.filter((r) => !r.undone_at).length === 1, 'one answer counts, two were undone')
  await page.goto(`${BASE}/#/home`)
  await page.locator('.plan-number .count-new', { hasText: '۱' }).waitFor()
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
  await page.locator('.plan-number .count-new', { hasText: '۱' }).waitFor() // not two: the reverse card waits

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
  await page.getByText('مرور در ۳۰ روز گذشته').waitFor()
  assert((await page.locator('.stack-bar .seg').count()) >= 2, 'the status bar has a part per learning stage in use')
  assert((await page.locator('.chart-col').count()) === 30 + 14, 'thirty days of activity and a fourteen-day forecast')
  // tapping a column tells its value in words
  await page.locator('.chart-col').nth(29).click()
  await page.locator('.chart-caption', { hasText: '۳ مرور' }).waitFor()
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
  await page.locator('.companion .mascot-supportive').waitFor()
  await page.getByText('اشکال نداره، دوباره امتحانش می‌کنیم.').waitFor()
  await snap(page, 'study-companion')
  await page.goto(`${BASE}/#/home`)
  await page.getByRole('button', { name: 'هدهد' }).click()
  await page.locator('.mascot-excited').waitFor()
  await snap(page, 'home-bird')
  // five tabs fit on the smallest phone without wrapping
  await page.setViewportSize({ width: 320, height: 568 })
  const heights = await page.locator('.nav-item').evaluateAll((items) => items.map((i) => i.getBoundingClientRect().height))
  assert(heights.length === 5 && Math.max(...heights) - Math.min(...heights) < 2, `nav labels stay on one line: ${heights}`)
  await noHorizontalScroll(page, 'home with five tabs at 320px')
  return page
})

// ---------------------------------------------------------------------------------------------

await browser.close()
server.kill()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)
process.exit(failed.length ? 1 : 0)
