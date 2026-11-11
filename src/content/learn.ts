/**
 * The "Learn" corner: podcasts, first lessons and verb families, per learned language.
 * Hodhod is a vocabulary app, not a course; these short pieces help to get started and give the
 * words a context. Explanations exist in Persian and English for now; other interface languages
 * see the English text (with a note) until their translation is written.
 *
 * Written for Hodhod; nothing here is copied from a book.
 */

/** Text in the learner's own language: Persian and English now, more later. */
export type Explained = { fa: string; en: string } & Partial<Record<string, string>>

export interface Line {
  /** speaker letter for dialogues ("A", "B"); null for a narrator */
  who: string | null
  text: string
  tr: Explained
}

export interface Episode {
  id: string
  level: 'A1' | 'A2' | 'B1'
  title: string
  about: Explained
  lines: Line[]
}

export interface LessonPart {
  heading: Explained
  body: Explained
  examples: { text: string; tr: Explained }[]
}

export interface Lesson {
  id: string
  level: 'A1' | 'A2' | 'B1'
  title: Explained
  parts: LessonPart[]
  /** words worth adding to the flashcards after the lesson */
  words: string[]
}

export interface VerbFamily {
  id: string
  base: string
  title: Explained
  intro: Explained
  members: { verb: string; meaning: Explained; example: string; exampleTr: Explained }[]
  /** "don't mix these up" pairs */
  confusables?: { a: string; b: string; tip: Explained }[]
}

export interface LearnContent {
  podcasts: Episode[]
  lessons: Lesson[]
  verbs: VerbFamily[]
}

const de: LearnContent = {
  podcasts: [
    {
      id: 'de-bakery',
      level: 'A1',
      title: 'Beim Bäcker',
      about: { fa: 'یک گفت‌وگوی کوتاه در نانوایی: سلام، سفارش، قیمت و خداحافظی.', en: 'A short conversation at the bakery: greeting, ordering, paying and saying goodbye.' },
      lines: [
        { who: 'A', text: 'Guten Morgen! Was darf es sein?', tr: { fa: 'صبح به خیر! چه میل دارید؟', en: 'Good morning! What can I get you?' } },
        { who: 'B', text: 'Guten Morgen! Ich hätte gern zwei Brötchen, bitte.', tr: { fa: 'صبح به خیر! لطفاً دو تا نان کوچک می‌خواهم.', en: 'Good morning! I would like two bread rolls, please.' } },
        { who: 'A', text: 'Gern. Sonst noch etwas?', tr: { fa: 'با کمال میل. چیز دیگری هم می‌خواهید؟', en: 'Sure. Anything else?' } },
        { who: 'B', text: 'Ja, ein Stück Apfelkuchen.', tr: { fa: 'بله، یک تکه کیک سیب.', en: 'Yes, a piece of apple cake.' } },
        { who: 'A', text: 'Zum Mitnehmen oder zum Hieressen?', tr: { fa: 'برای بیرون یا همین‌جا میل می‌کنید؟', en: 'To take away or to eat here?' } },
        { who: 'B', text: 'Zum Mitnehmen, bitte.', tr: { fa: 'برای بیرون، لطفاً.', en: 'To take away, please.' } },
        { who: 'A', text: 'Das macht vier Euro fünfzig.', tr: { fa: 'می‌شود چهار یورو و پنجاه سنت.', en: 'That comes to four euros fifty.' } },
        { who: 'B', text: 'Kann ich mit Karte zahlen?', tr: { fa: 'می‌توانم با کارت پرداخت کنم؟', en: 'Can I pay by card?' } },
        { who: 'A', text: 'Natürlich. Vielen Dank und einen schönen Tag!', tr: { fa: 'البته. خیلی ممنون، روز خوبی داشته باشید!', en: 'Of course. Thank you and have a nice day!' } },
        { who: 'B', text: 'Danke, Ihnen auch. Tschüss!', tr: { fa: 'ممنون، همچنین. خداحافظ!', en: 'Thanks, you too. Bye!' } },
      ],
    },
    {
      id: 'de-weekend',
      level: 'A2',
      title: 'Was machst du am Wochenende?',
      about: { fa: 'دو دوست برای آخر هفته برنامه می‌ریزند: سینما، آب‌وهوا و قرار گذاشتن.', en: 'Two friends make plans for the weekend: cinema, weather and arranging to meet.' },
      lines: [
        { who: 'A', text: 'Hey, hast du am Wochenende schon was vor?', tr: { fa: 'سلام، برای آخر هفته برنامه‌ای داری؟', en: 'Hey, do you have any plans for the weekend?' } },
        { who: 'B', text: 'Noch nicht. Am Samstag muss ich vormittags arbeiten, aber danach bin ich frei.', tr: { fa: 'هنوز نه. شنبه صبح باید کار کنم، ولی بعدش آزادم.', en: 'Not yet. On Saturday I have to work in the morning, but after that I am free.' } },
        { who: 'A', text: 'Wollen wir ins Kino gehen? Es läuft ein neuer Film.', tr: { fa: 'برویم سینما؟ یک فیلم تازه آمده.', en: 'Shall we go to the cinema? A new film is showing.' } },
        { who: 'B', text: 'Gute Idee! Aber wenn das Wetter schön ist, würde ich lieber draußen sein.', tr: { fa: 'فکر خوبی است! ولی اگر هوا خوب باشد، ترجیح می‌دهم بیرون باشم.', en: 'Good idea! But if the weather is nice, I would rather be outside.' } },
        { who: 'A', text: 'Laut Wetterbericht soll es am Samstag regnen.', tr: { fa: 'طبق پیش‌بینی هوا، شنبه قرار است باران بیاید.', en: 'According to the forecast it is supposed to rain on Saturday.' } },
        { who: 'B', text: 'Na gut, dann Kino am Samstag und Sonntag ein Spaziergang am See.', tr: { fa: 'باشه، پس شنبه سینما و یکشنبه پیاده‌روی کنار دریاچه.', en: 'Okay then, cinema on Saturday and a walk by the lake on Sunday.' } },
        { who: 'A', text: 'Perfekt. Treffen wir uns um sieben vor dem Kino?', tr: { fa: 'عالی. ساعت هفت جلوی سینما همدیگر را ببینیم؟', en: 'Perfect. Shall we meet at seven in front of the cinema?' } },
        { who: 'B', text: 'Abgemacht! Ich besorge die Karten.', tr: { fa: 'قبول! من بلیت‌ها را می‌گیرم.', en: 'Deal! I will get the tickets.' } },
      ],
    },
  ],
  lessons: [
    {
      id: 'de-articles',
      level: 'A1',
      title: { fa: 'der، die، das: جنس اسم‌ها', en: 'der, die, das: the gender of nouns' },
      parts: [
        {
          heading: { fa: 'هر اسم آلمانی یک جنس دارد', en: 'Every German noun has a gender' },
          body: {
            fa: 'در آلمانی هر اسم مذکر (der)، مؤنث (die) یا خنثی (das) است. این جنس همیشه به معنی واژه ربط ندارد؛ برای همین بهترین کار این است که هر اسم را همیشه با حرف تعریفش یاد بگیری. در هدهد هم رنگ هر حرف تعریف به تو کمک می‌کند: آبی برای der، قرمز برای die و سبز برای das.',
            en: 'In German every noun is masculine (der), feminine (die) or neuter (das). The gender often has nothing to do with the meaning, so the best habit is to always learn a noun together with its article. In Hodhod the colours help: blue for der, red for die, green for das.',
          },
          examples: [
            { text: 'der Tisch', tr: { fa: 'میز', en: 'the table' } },
            { text: 'die Lampe', tr: { fa: 'چراغ', en: 'the lamp' } },
            { text: 'das Buch', tr: { fa: 'کتاب', en: 'the book' } },
          ],
        },
        {
          heading: { fa: 'چند نشانهٔ کمک‌کننده', en: 'A few helpful signs' },
          body: {
            fa: 'قانون صددرصدی نیست، ولی این پایان‌ها بیشتر وقت‌ها جواب می‌دهند: ‎-ung، ‎-heit، ‎-keit و ‎-schaft معمولاً die هستند. ‎-chen و ‎-lein (کوچک‌کننده) همیشه das هستند. روزهای هفته، ماه‌ها و فصل‌ها der هستند.',
            en: 'There is no rule that always works, but these endings usually do: -ung, -heit, -keit and -schaft are mostly die. -chen and -lein (small things) are always das. Days, months and seasons are der.',
          },
          examples: [
            { text: 'die Zeitung', tr: { fa: 'روزنامه', en: 'the newspaper' } },
            { text: 'das Mädchen', tr: { fa: 'دختر', en: 'the girl' } },
            { text: 'der Montag', tr: { fa: 'دوشنبه', en: 'Monday' } },
          ],
        },
        {
          heading: { fa: 'جمع: همیشه die', en: 'Plural: always die' },
          body: {
            fa: 'خوشبختانه در جمع همهٔ اسم‌ها die می‌گیرند. ولی شکل جمع را باید با خود واژه یاد گرفت؛ کارت‌های هدهد شکل جمع را هم نشان می‌دهند.',
            en: 'Luckily, in the plural all nouns take die. The plural form itself has to be learned with the word; Hodhod cards show it too.',
          },
          examples: [
            { text: 'der Tisch → die Tische', tr: { fa: 'میز ← میزها', en: 'table → tables' } },
            { text: 'das Buch → die Bücher', tr: { fa: 'کتاب ← کتاب‌ها', en: 'book → books' } },
          ],
        },
      ],
      words: ['der Tisch', 'die Lampe', 'das Buch', 'die Zeitung', 'das Mädchen'],
    },
    {
      id: 'de-present',
      level: 'A1',
      title: { fa: 'زمان حال: صرف فعل‌های باقاعده', en: 'Present tense: regular verbs' },
      parts: [
        {
          heading: { fa: 'ریشه + پایانه', en: 'Stem + ending' },
          body: {
            fa: 'برای ساختن زمان حال، ‎-en را از آخر مصدر برمی‌داریم (lernen ← lern) و برای هر شخص یک پایانه اضافه می‌کنیم: ich ‎-e، du ‎-st، er/sie/es ‎-t، wir ‎-en، ihr ‎-t، sie/Sie ‎-en.',
            en: 'To form the present tense, drop -en from the infinitive (lernen → lern) and add an ending for each person: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en.',
          },
          examples: [
            { text: 'ich lerne', tr: { fa: 'من یاد می‌گیرم', en: 'I learn' } },
            { text: 'du lernst', tr: { fa: 'تو یاد می‌گیری', en: 'you learn' } },
            { text: 'sie lernt', tr: { fa: 'او یاد می‌گیرد', en: 'she learns' } },
            { text: 'wir lernen', tr: { fa: 'ما یاد می‌گیریم', en: 'we learn' } },
          ],
        },
        {
          heading: { fa: 'فعل در جای دوم', en: 'The verb comes second' },
          body: {
            fa: 'در جملهٔ خبری آلمانی، فعل صرف‌شده همیشه در جای دوم جمله است، حتی اگر جمله با زمان یا مکان شروع شود.',
            en: 'In a German statement the conjugated verb is always in second position, even when the sentence starts with a time or a place.',
          },
          examples: [
            { text: 'Ich wohne in Berlin.', tr: { fa: 'من در برلین زندگی می‌کنم.', en: 'I live in Berlin.' } },
            { text: 'Heute arbeite ich zu Hause.', tr: { fa: 'امروز در خانه کار می‌کنم.', en: 'Today I am working at home.' } },
          ],
        },
      ],
      words: ['lernen', 'wohnen', 'arbeiten', 'spielen', 'kaufen'],
    },
  ],
  verbs: [
    {
      id: 'de-geben',
      base: 'geben',
      title: { fa: 'خانوادهٔ geben', en: 'The geben family' },
      intro: {
        fa: 'geben یعنی «دادن». با پیشوندهای مختلف، فعل‌های تازه‌ای با معنی‌های کاملاً متفاوت ساخته می‌شود. پیشوندهای جداشدنی (auf، ab، an، aus، zu) در جمله به آخر می‌روند.',
        en: 'geben means "to give". With different prefixes it becomes new verbs with quite different meanings. Separable prefixes (auf, ab, an, aus, zu) move to the end of the sentence.',
      },
      members: [
        { verb: 'aufgeben', meaning: { fa: 'تسلیم شدن، دست کشیدن؛ تحویل پست دادن', en: 'to give up; to post (a parcel)' }, example: 'Gib nicht auf!', exampleTr: { fa: 'تسلیم نشو!', en: "Don't give up!" } },
        { verb: 'abgeben', meaning: { fa: 'تحویل دادن', en: 'to hand in' }, example: 'Ich gebe die Hausaufgaben morgen ab.', exampleTr: { fa: 'تکلیف‌ها را فردا تحویل می‌دهم.', en: 'I will hand in the homework tomorrow.' } },
        { verb: 'angeben', meaning: { fa: 'ذکر کردن؛ پز دادن', en: 'to state; to show off' }, example: 'Er gibt immer mit seinem Auto an.', exampleTr: { fa: 'همیشه با ماشینش پز می‌دهد.', en: 'He always shows off with his car.' } },
        { verb: 'ausgeben', meaning: { fa: 'خرج کردن (پول)', en: 'to spend (money)' }, example: 'Wir geben zu viel Geld aus.', exampleTr: { fa: 'زیادی پول خرج می‌کنیم.', en: 'We spend too much money.' } },
        { verb: 'zugeben', meaning: { fa: 'اعتراف کردن', en: 'to admit' }, example: 'Ich gebe zu, das war mein Fehler.', exampleTr: { fa: 'اعتراف می‌کنم، اشتباه من بود.', en: 'I admit it was my mistake.' } },
        { verb: 'vergeben', meaning: { fa: 'بخشیدن', en: 'to forgive' }, example: 'Kannst du mir vergeben?', exampleTr: { fa: 'می‌توانی مرا ببخشی؟', en: 'Can you forgive me?' } },
        { verb: 'umgeben', meaning: { fa: 'احاطه کردن', en: 'to surround' }, example: 'Das Haus ist von Bäumen umgeben.', exampleTr: { fa: 'خانه را درخت‌ها احاطه کرده‌اند.', en: 'The house is surrounded by trees.' } },
      ],
      confusables: [
        { a: 'legen', b: 'liegen', tip: { fa: 'legen = چیزی را (خوابیده) گذاشتن (کار انجام می‌دهی). liegen = (خوابیده) قرار داشتن (حالت است).', en: 'legen = to lay something down (an action). liegen = to be lying (a state).' } },
        { a: 'lernen', b: 'lehren', tip: { fa: 'lernen = یاد گرفتن. lehren = یاد دادن.', en: 'lernen = to learn. lehren = to teach.' } },
      ],
    },
  ],
}

const CONTENT: Partial<Record<string, LearnContent>> = { de }

/** What the Learn corner has for a learned language (empty lists when nothing is written yet). */
export function learnContent(target: string): LearnContent {
  return CONTENT[target] ?? { podcasts: [], lessons: [], verbs: [] }
}

/** The explanation in the learner's language, else English; `fallback` tells the screen to say so. */
export function explained(text: Explained, native: string): { text: string; fallback: boolean } {
  const own = text[native]
  return own ? { text: own, fallback: false } : { text: text.en, fallback: native !== 'en' }
}
