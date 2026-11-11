/**
 * Phone screenshots for the introduction site, one set per site language: a learner with a name
 * from that language adds two words of the language they learn, and the app is photographed
 * (a fresh card, the home screen, a revealed card). Runs against the test backend, so no real
 * account or AI is touched. Writes site/img/shots/<lang>/{card,home,study}.webp.
 *
 *   bun run scripts/build.ts --dev && NODE_PATH=$(npm root -g) node scripts/site-shots.mjs
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4177
const BASE = `http://localhost:${PORT}`

// --- the words, in the learned languages -------------------------------------------------------

const levels = ['easy', 'medium', 'hard']
const TARGET = {
  de: [
    { input: 'Tisch', lemma: 'Tisch', ipa: 'tɪʃ', article: 'der', gender: 'm', plural: 'Tische', genitive: 'Tisches', examples: ['Der Tisch ist groß.', 'Ich decke den Tisch für das Abendessen.', 'Wir sollten das Thema endlich auf den Tisch bringen.'] },
    { input: 'Apfel', lemma: 'Apfel', ipa: 'ˈapfl̩', article: 'der', gender: 'm', plural: 'Äpfel', genitive: 'Apfels', examples: ['Der Apfel ist rot.', 'Ich esse jeden Morgen einen Apfel.', 'Der Apfel fällt nicht weit vom Stamm.'] },
  ],
  it: [
    { input: 'tavolo', lemma: 'tavolo', ipa: 'ˈtaːvolo', article: 'il', gender: 'm', plural: 'tavoli', examples: ['Il tavolo è grande.', 'Apparecchio il tavolo per la cena.', 'Dobbiamo finalmente mettere il tema sul tavolo.'] },
    { input: 'mela', lemma: 'mela', ipa: 'ˈmeːla', article: 'la', gender: 'f', plural: 'mele', examples: ['La mela è rossa.', 'Mangio una mela ogni mattina.', 'Una mela al giorno toglie il medico di torno.'] },
  ],
  es: [
    { input: 'mesa', lemma: 'mesa', ipa: 'ˈmesa', article: 'la', gender: 'f', plural: 'mesas', examples: ['La mesa es grande.', 'Pongo la mesa para la cena.', 'Por fin tenemos que poner el tema sobre la mesa.'] },
    { input: 'manzana', lemma: 'manzana', ipa: 'manˈθana', article: 'la', gender: 'f', plural: 'manzanas', examples: ['La manzana es roja.', 'Como una manzana cada mañana.', 'Una manzana al día mantiene alejado al médico.'] },
  ],
  en: [
    { input: 'table', lemma: 'table', ipa: 'ˈteɪbl̩', article: null, gender: null, plural: 'tables', examples: ['The table is big.', 'I set the table for dinner.', 'We finally have to put the topic on the table.'] },
    { input: 'apple', lemma: 'apple', ipa: 'ˈæpl̩', article: null, gender: null, plural: 'apples', examples: ['The apple is red.', 'I eat an apple every morning.', 'An apple a day keeps the doctor away.'] },
  ],
  fr: [
    { input: 'table', lemma: 'table', ipa: 'tabl', article: 'la', gender: 'f', plural: 'tables', examples: ['La table est grande.', 'Je mets la table pour le dîner.', 'Nous devons enfin mettre le sujet sur la table.'] },
    { input: 'pomme', lemma: 'pomme', ipa: 'pɔm', article: 'la', gender: 'f', plural: 'pommes', examples: ['La pomme est rouge.', 'Je mange une pomme chaque matin.', 'Une pomme par jour éloigne le médecin.'] },
  ],
}

// --- the learners: a name from their own language, the language they learn, the translations -------

const LEARNERS = {
  en: { name: 'Emma', target: 'de', meanings: ['table', 'apple'], examples: [['The table is big.', "I'm setting the table for dinner.", 'We should finally put the topic on the table.'], ['The apple is red.', 'I eat an apple every morning.', "The apple doesn't fall far from the tree."]] },
  fa: { name: 'سارا', target: 'de', meanings: ['میز', 'سیب'], examples: [['میز بزرگ است.', 'میز را برای شام می‌چینم.', 'بالاخره باید این موضوع را مطرح کنیم.'], ['سیب قرمز است.', 'هر روز صبح یک سیب می‌خورم.', 'سیب هیچ‌وقت از درختش دور نمی‌افتد.']] },
  de: { name: 'Lukas', target: 'it', meanings: ['Tisch', 'Apfel'], examples: [['Der Tisch ist groß.', 'Ich decke den Tisch für das Abendessen.', 'Wir müssen das Thema endlich auf den Tisch bringen.'], ['Der Apfel ist rot.', 'Ich esse jeden Morgen einen Apfel.', 'Ein Apfel am Tag hält den Doktor fern.']] },
  fr: { name: 'Camille', target: 'es', meanings: ['table', 'pomme'], examples: [['La table est grande.', 'Je mets la table pour le dîner.', 'Nous devons enfin mettre le sujet sur la table.'], ['La pomme est rouge.', 'Je mange une pomme chaque matin.', 'Une pomme par jour éloigne le médecin.']] },
  it: { name: 'Giulia', target: 'de', meanings: ['tavolo', 'mela'], examples: [['Il tavolo è grande.', 'Apparecchio la tavola per la cena.', 'Dobbiamo finalmente mettere il tema sul tavolo.'], ['La mela è rossa.', 'Mangio una mela ogni mattina.', 'Una mela al giorno toglie il medico di torno.']] },
  tr: { name: 'Elif', target: 'de', meanings: ['masa', 'elma'], examples: [['Masa büyük.', 'Akşam yemeği için masayı hazırlıyorum.', 'Bu konuyu artık masaya yatırmalıyız.'], ['Elma kırmızı.', 'Her sabah bir elma yerim.', 'Armut dibine düşer.']] },
  uk: { name: 'Олена', target: 'de', meanings: ['стіл', 'яблуко'], examples: [['Стіл великий.', 'Я накриваю стіл до вечері.', 'Нам нарешті варто винести цю тему на обговорення.'], ['Яблуко червоне.', 'Я щоранку їм яблуко.', 'Яблуко від яблуні недалеко падає.']] },
  ru: { name: 'Иван', target: 'en', meanings: ['стол', 'яблоко'], examples: [['Стол большой.', 'Я накрываю на стол к ужину.', 'Нам наконец нужно вынести эту тему на обсуждение.'], ['Яблоко красное.', 'Я ем яблоко каждое утро.', 'Кто ест по яблоку в день, тот не знает докторов.']] },
  ar: { name: 'ليلى', target: 'de', meanings: ['طاولة', 'تفاحة'], examples: [['الطاولة كبيرة.', 'أُجهّز الطاولة للعشاء.', 'علينا أخيرًا أن نطرح الموضوع للنقاش.'], ['التفاحة حمراء.', 'آكل تفاحة كل صباح.', 'الابن سرّ أبيه.']] },
  es: { name: 'Lucía', target: 'en', meanings: ['mesa', 'manzana'], examples: [['La mesa es grande.', 'Pongo la mesa para la cena.', 'Por fin tenemos que poner el tema sobre la mesa.'], ['La manzana es roja.', 'Como una manzana cada mañana.', 'Una manzana al día mantiene alejado al médico.']] },
  nl: { name: 'Sanne', target: 'fr', meanings: ['tafel', 'appel'], examples: [['De tafel is groot.', 'Ik dek de tafel voor het avondeten.', 'We moeten het onderwerp eindelijk op tafel leggen.'], ['De appel is rood.', 'Ik eet elke ochtend een appel.', 'Een appel per dag houdt de dokter weg.']] },
}

/** What the fake AI answers for one word of one learner (the shape the real AI returns). */
function aiOutput(word, meaning, translations) {
  return {
    status: 'ok',
    suggestion: null,
    input_note: null,
    lemma: word.lemma,
    pos: 'noun',
    cefr: 'A1',
    ipa: word.ipa,
    meanings: [{ translation: meaning, note: null, examples: word.examples.map((de, i) => ({ level: levels[i], de, fa: translations[i] })) }],
    noun: { article: word.article, gender: word.gender, plural: word.plural, genitive: word.genitive ?? null, plural_only: false },
    verb: null,
    adjective: null,
    synonyms: [],
    antonyms: [],
    collocations: [],
    learner_note: null,
    register: null,
    frequency: null,
    literal: null,
    alternatives: [],
    reply: null,
  }
}

// --- photographing ----------------------------------------------------------------------------

const server = spawn('bun', ['run', join(root, 'tests/e2e/server.ts')], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] })
await new Promise((resolve) => server.stdout.once('data', resolve))
const control = (path, body = {}) => fetch(`${BASE}/__test/${path}`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json())

const browser = await chromium.launch()
const only = process.argv[2]
try {
  for (const [lang, learner] of Object.entries(LEARNERS)) {
    if (only && lang !== only) continue
    await control('reset', { welcome: true })
    const words = TARGET[learner.target]
    await control('ai-words', { words: Object.fromEntries(words.map((w, i) => [w.input.toLowerCase(), aiOutput(w, learner.meanings[i], learner.examples[i])])) })
    const email = `${lang}@example.test`
    await control('seed-user', { email, password: 'correct horse battery', name: learner.name })

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, timezoneId: 'Europe/Berlin', reducedMotion: 'reduce' })
    await context.addInitScript((code) => {
      try {
        localStorage.setItem('hodhod.language', code)
      } catch {}
    }, lang)
    const page = await context.newPage()
    page.on('pageerror', (e) => console.log(`  ${lang}: ${e.message}`))
    await page.goto(BASE)
    await page.locator('input[type=email]').fill(email)
    await page.locator('input[type=password]').fill('correct horse battery')
    await page.locator('form button[type=submit]').click()
    // the welcome tour: pick the language to learn, then skip the rest
    await page.locator(`button[role=radio]:has(b[lang="${learner.target}"])`).click()
    await page.locator('.welcome-top .btn.ghost').click()
    await page.locator('.perch').waitFor()

    const dir = join(root, 'site/img/shots', lang)
    mkdirSync(dir, { recursive: true })
    const shoot = async (name) => {
      await page.waitForTimeout(700)
      await page.addStyleTag({ content: '.toast-host { display: none !important; }' }) // no "saved" message on the photos
      const png = join(dir, `${name}.png`)
      await page.screenshot({ path: png })
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', png, '-c:v', 'libwebp', '-quality', '82', join(dir, `${name}.webp`)])
      execFileSync('rm', [png])
    }

    for (const [i, word] of words.entries()) {
      await page.goto(`${BASE}/#/create`)
      await page.locator('[aria-describedby="create-help"]').fill(word.input)
      await page.locator('form button[type=submit]').click()
      await page.locator('.draft-banner').waitFor({ timeout: 15_000 }).catch(async (e) => {
        console.log(await page.locator('main').innerText().catch(() => ''))
        throw e
      })
      if (i === 0) await shoot('card')
      await page.locator('button.btn.primary.big.grow').click()
      await page.waitForURL(/#\/words\/[0-9a-f-]+$/)
    }

    await page.goto(`${BASE}/#/study`)
    await page.locator('button.btn.accent.big.block').click()
    await shoot('study')
    await page.goto(`${BASE}/#/home`)
    await page.locator('.perch').waitFor()
    await shoot('home')
    await context.close()
    console.log(`  ok  ${lang} (${learner.name} → ${learner.target})`)
  }
} finally {
  await browser.close()
  server.kill()
}
