/** Ukrainian interface. Same shape as fa.ts (the admin panel stays Persian). */
import type { ValidationIssue } from '../../../supabase/functions/_shared/wordSchema.ts'
import { num } from '../format.ts'
import { describePath, type Dictionary } from '../strings.ts'
import { L as Lname, O as Oname } from './names.ts'
import { learningInfo } from '../learning.ts'

/** 1 слово, 2 слова, 5 слів, 21 слово */
const pl = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100
  const b = a % 10
  return `${num(n)} ${a >= 11 && a <= 14 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many}`
}
const WORD = ['слово', 'слова', 'слів'] as const
const CARD = ['картка', 'картки', 'карток'] as const
const DAY = ['день', 'дні', 'днів'] as const
const MIN = ['хвилина', 'хвилини', 'хвилин'] as const
const REVIEW = ['повторення', 'повторення', 'повторень'] as const
const ITEM = ['елемент', 'елементи', 'елементів'] as const
const LESSON = ['урок', 'уроки', 'уроків'] as const
const QUESTION = ['питання', 'питання', 'питань'] as const
const CHANGE = ['зміна', 'зміни', 'змін'] as const
const w = (n: number) => pl(n, ...WORD)
const cards = (n: number) => pl(n, ...CARD)
const days = (n: number) => pl(n, ...DAY)
const mins = (n: number) => pl(n, ...MIN)

// Language names from the browser are feminine adjectives ("німецька"); a few cases are built from them.
/** "німецька" */
const L = () => Lname()
const O = () => Oname()
/** "німецькою" (in German) */
const Lin = () => L().replace(/а$/, 'ою')
const Oin = () => O().replace(/а$/, 'ою')
/** "німецьке" (слово) */
const Ln = () => L().replace(/а$/, 'е')
/** "німецькі" (слова) */
const Lp = () => L().replace(/а$/, 'і')

export const uk: Dictionary = {
  nav: { home: 'Головна', create: 'Додати', words: 'Слова', study: 'Повторення', quiz: 'Тест', settings: 'Налаштування', stats: 'Статистика' },

  gender: { m: 'чоловічий', f: 'жіночий', n: 'середній', c: 'спільний (de)' },

  common: {
    cancel: 'Скасувати',
    retry: 'Спробувати ще',
    save: 'Зберегти',
    edit: 'Редагувати',
    delete: 'Видалити',
    close: 'Закрити',
    back: 'Назад',
    yes: 'Так',
    no: 'Ні',
    add: 'Додати',
    remove: 'Прибрати',
    loading: 'Завантаження…',
    offline: 'Ти офлайн',
    preview: 'Попередній перегляд',
    listSep: ', ',
    play: 'Прослухати вимову',
    optional: 'необовʼязково',
  },

  auth: {
    language: 'Мова',
    chooseTitle: 'Обери свою мову',
    chooseBody: 'Hodhod говоритиме з тобою цією мовою. Далі ти обереш мову, яку хочеш вивчати.',
    tagline: 'Розумні картки для слів, які тобі потрібні, — щодня трохи більше',
    hello: 'Привіт! Я Hodhod.',
    signIn: 'Увійти',
    signUp: 'Створити акаунт',
    name: 'Імʼя',
    namePlaceholder: 'Як до тебе звертатися?',
    email: 'Ел. пошта',
    password: 'Пароль',
    passwordHint: 'Щонайменше 8 символів',
    submitSignIn: 'Увійти',
    submitSignUp: 'Створити акаунт',
    forgot: 'Я забув(-ла) пароль',
    resetSent: 'Якщо цю адресу зареєстровано, на неї надіслано посилання для зміни пароля.',
    resetNeedsEmail: 'Спершу введи свою пошту, потім натисни тут ще раз.',
    confirmSent: 'Ми надіслали тобі лист для підтвердження. Натисни посилання в ньому, щоб активувати акаунт.',
    newPasswordTitle: 'Новий пароль',
    newPasswordSubmit: 'Змінити пароль',
    passwordChanged: 'Пароль змінено.',
    errors: {
      invalid_credentials: 'Пошта або пароль неправильні.',
      invalid_grant: 'Пошта або пароль неправильні.',
      email_not_confirmed: 'Ти ще не підтвердив(-ла) пошту. Натисни посилання в листі.',
      user_already_exists: 'З цією поштою вже є акаунт. Скористайся «Увійти».',
      email_exists: 'З цією поштою вже є акаунт. Скористайся «Увійти».',
      weak_password: 'Пароль закороткий або надто простий. Обери довший.',
      signup_disabled: 'Реєстрація нових акаунтів зараз закрита.',
      otp_expired: 'Термін дії посилання минув. Отримай нове.',
      same_password: 'Новий пароль має відрізнятися від старого.',
      email_invalid: 'Схоже, адреса неправильна.',
      password_short: 'Пароль має містити щонайменше 8 символів.',
      captcha_failed: 'Перевірка «Ти людина?» не вдалася. Онови сторінку й спробуй ще.',
      user_banned: 'Цей акаунт заблоковано.',
      over_request_rate_limit: 'Забагато спроб. Зачекай кілька хвилин і спробуй ще.',
      over_email_send_rate_limit: 'Сервер зараз не може надсилати листи (вичерпано годинний ліміт). Спробуй за годину.',
      fallback: 'Не вдалося увійти. Спробуй ще.',
    } as Record<string, string>,
  },

  setup: {
    title: 'Застосунок ще не підключено до сервера',
    body: 'Адресу та публічний ключ Supabase не вказано в config.js.',
    backendMissing: 'База даних ще не готова. Таблиці застосунку в Supabase не створено.',
  },

  home: {
    greeting(hour: number, name: string | null) {
      const part = hour < 4 ? 'Доброї ночі' : hour < 11 ? 'Доброго ранку' : hour < 18 ? 'Добрий день' : 'Добрий вечір'
      return name ? `${part}, ${name}` : part
    },
    today: 'План на сьогодні',
    newCards: 'Нові',
    reviews: 'Повторення',
    learning: 'У процесі',
    minutesLabel: 'хв',
    startReview: 'Продовжити повторення',
    startNew: 'Вчити нові слова',
    startMixed: 'Почати навчання',
    addFirst: 'Додай перше слово',
    addWord: 'Додати слово',
    allDone: 'На сьогодні все',
    allDoneBody: 'Ти переглянув(-ла) всі сьогоднішні картки. До завтра!',
    waitingLater: (when: string) => `Наступна картка повернеться ${when}.`,
    nothingDue: 'Сьогодні немає карток для повторення.',
    newWaiting: (n: number) => `Збережені слова чекають на наступні дні: ${w(n)}.`,
    goal: 'Денна мета',
    goalProgress: (done: number, goal: number) => `${num(done)} з ${num(goal)} хв`,
    goalDone: 'Мету на сьогодні виконано',
    streak: (n: number) => `${days(n)} поспіль`,
    streakNone: 'Почни сьогодні',
    streakKeep: 'Сьогодні ти ще не повторював(-ла)',
    statsHint: 'Прогрес і складні слова',
    bank: 'Банк слів',
    bankCount: (n: number) => w(n),
    week: 'Останні сім днів',
    weekReviews: (n: number) => pl(n, ...REVIEW),
    planMinutes: (minutes: number) => `близько ${num(Math.max(1, minutes))} хв`,
    planNew: (n: number) => pl(n, 'нове слово', 'нові слова', 'нових слів'),
    goalRing: (done: number, goal: number) => `${num(done)} з ${num(goal)} хв`,
    goalLeft: (left: number) => `ще ${num(left)} хв до мети`,
    dayDone: 'На сьогодні все',
    todayCard: 'Сьогодні: мета, серія і статистика',
    statsLink: 'Статистика',
    more: 'Інші розділи',
    streakDays: 'днів поспіль',
    streakBest: (n: number) => `Рекорд: ${days(n)}`,
    streakTodayDone: 'Сьогодні теж повторено',
    weekTitle: 'Останні 7 днів',
    weekDone: (n: number) => `${num(n)} з 7 днів`,
    mascot: {
      get first() {
        return `Привіт! Я Hodhod. Дай мені ${Ln()} слово — і почнемо разом.`
      },
      morning: 'Доброго ранку! Почнемо день з кількох карток?',
      due: 'Сьогоднішні картки готові — коли будеш готовий(-а) ти.',
      goalDone: 'Мету на сьогодні досягнуто. Браво!',
      allDone: 'На сьогодні досить. Гарна робота!',
      back: 'З поверненням! Продовжимо з того ж місця.',
      idle: 'Почув(-ла) нове слово? Додай його.',
    },
  },

  celebrate: {
    title: (n: number) => `${days(n)} поспіль!`,
    body: (n: number): string =>
      n >= 100 ? 'Неймовірно. Тепер ти справжній учень.' : n >= 30 ? 'Цілий місяць! Слова закріплюються.' : n >= 7 ? 'Цілий тиждень. Звичка формується!' : 'Чудовий початок. Чекаю на тебе завтра.',
    continue: 'Далі',
  },

  welcome: {
    progress: (n: number, total: number) => `Крок ${num(n)} з ${num(total)}`,
    skip: 'Пропустити',
    next: 'Далі',
    start: 'Почнімо',
    hello: (name: string | null) => (name ? `Привіт, ${name}, ласкаво просимо!` : 'Привіт, ласкаво просимо!'),
    helloAgain: (name: string | null) => (name ? `${name}, Hodhod оновився!` : 'Hodhod оновився!'),
    helloAgainBody: 'Я приніс дещо нове. Потім два короткі питання, щоб знову скласти денний план; твої картки й прогрес лишаються.',
    whatsNew: [
      ['🔊', 'Природний голос для слів і речень'],
      ['📦', 'Готові набори слів і речень, урок за уроком'],
      ['💬', 'Картки для речень і виразів'],
      ['🎧', 'Аудіювання й вимова в тестах'],
      ['📖', 'Короткі історії з твоїми словами'],
      ['👥', 'Навчання з друзями'],
      ['🔔', 'Нагадування на телефон'],
    ] as [string, string][],
    ownTitle: 'Яка твоя мова?',
    ownBody: 'Hodhod говоритиме з тобою цією мовою і писатиме нею значення слів.',
    learnTitle: 'Яку мову хочеш вивчати?',
    learnBody: 'Кожна мова має власний колір і власні картки.',
    introTitle: 'Як працює Hodhod?',
    get intro() {
      return [
        ['🗂️', 'Hodhod — розумні картки (Лейтнер), а не мовний курс: ти повторюєш саме ті слова, що тобі потрібні, саме вчасно, щоб вони запамʼяталися.'],
        ['✨', `Напиши будь-яке ${Ln()} слово; за кілька секунд ШІ створить картку зі значенням ${Oin()}, прикладами і вимовою. Переглянь її перед збереженням і за потреби виправ.`],
        ['📦', 'Є й готові набори слів, речень і виразів, урок за уроком. Картки наборів перевірили два окремі ШІ.'],
        ['🎨', 'Кожна мова має свій колір і картки. З Hodhod Plus можна вчити кілька мов одночасно.'],
      ] as [string, string][]
    },
    languageFailed: 'Вибір мови не збережено. Перевір зʼєднання і спробуй ще.',
    reminderTitle: 'Хочеш нагадування?',
    reminderOn: 'Увімкнути нагадування',
    reminderDone: 'Нагадування увімкнено',
    get helloBody() {
      return `Я Hodhod. Допоможу тобі щодня вчити кілька слів (${L()}) і більше їх не забувати. Два короткі питання — і план готовий.`
    },
    timeTitle: 'Скільки часу маєш щодня?',
    timeBody: 'Трохи, але щодня — краще, ніж багато, але зрідка.',
    minutes: (n: number) => mins(n),
    timeHint: { 5: 'За сніданком чи в черзі', 10: 'Коротка перерва', 20: 'Справжнє тренування', 30: 'Для тих, хто серйозно' } as Record<number, string>,
    get levelTitle() {
      return `Який твій рівень (${L()})?`
    },
    levelBody: 'За твоєю відповіддю я запропоную, скільки нових слів учити щодня.',
    levels: { beginner: 'Тільки почав(-ла)', some: 'Трохи знаю', intermediate: 'Середній рівень' },
    levelHints: { beginner: 'A1, знаю кілька слів', some: 'A2, кажу прості речення', intermediate: 'B1 або вище' },
    perDay: 'Нових слів на день',
    perDayHelp: 'Кожне нове слово повторюється кілька разів у наступні дні. Велике число робить наступні тижні важкими.',
    less: 'Менше',
    more: 'Більше',
    readyTitle: 'Твій план готовий!',
    readyBody: (minutes: number, perDay: number) => `Щодня ${mins(minutes)}, нових слів: ${num(perDay)}. Коли б ти не прийшов(-ла), картки дня будуть готові.`,
    changeLater: 'Усе це можна змінити в налаштуваннях будь-коли.',
    firstWord: 'Додати перше слово',
    toHome: 'На головну',
  },

  decks: {
    title: 'Мої мови',
    choose: 'Що повторюємо сьогодні?',
    words: (n: number) => w(n),
    current: 'Зараз відкрита',
    add: 'Додати нову мову',
    addTitle: 'Яку ще мову хочеш вивчати?',
    plusTitle: 'Друга мова з Hodhod Plus',
    plusBody: 'Вивчення кількох мов одночасно — частина Hodhod Plus. Plus скоро зʼявиться.',
    failed: 'Мову не змінено. Перевір зʼєднання і спробуй ще.',
    switchHint: 'Інша мова',
  },

  create: {
    title: 'Нове слово',
    get label() {
      return `Слово чи вираз (${L()})`
    },
    get placeholder() {
      return `напр. ${learningInfo().example}`
    },
    get help() {
      const [noun, phrase, sentence] = learningInfo().examples
      return `Напиши слово, вираз або коротке речення, як-от ${noun}, ${phrase} чи ${sentence}`
    },
    importLink: 'Імпортувати цілий список',
    submit: 'Створити картку',
    loading: 'Готую картку для цього слова…',
    loadingHint: 'Зазвичай це триває 10–20 секунд.',
    failed: 'Зараз не вдалося підготувати це слово.',
    notAWord: (word: string) => `Я не впізнав «${word}» як слово чи вираз (${L()}). Перевір написання.`,
    wrongLanguage: (word: string) => `«${word}» — це не ${L()}. Поки що я створюю лише ${Lp()} слова.`,
    didYouMean: 'Ти мав(-ла) на увазі це?',
    useSuggestion: 'Так, це',
    duplicateTitle: 'Це слово вже є в твоєму банку слів',
    duplicateOpen: 'Відкрити слово',
    duplicateRegenerate: 'Створити дані заново',
    inputErrors: {
      empty: 'Напиши слово.',
      too_long: 'Задовго. Напиши слово, вираз або коротке речення (до 20 слів).',
      multiple_words: 'Задовго. Речення може мати до 20 слів.',
      get wrong_script() {
        return `Напиши слово ${Lin()}, а не ${Oin()}.`
      },
      get invalid_characters() {
        return `Лише літери (${L()}), без цифр і знаків.`
      },
    },
  },

  draft: {
    banner: 'Це чернетка, її ще не збережено. Переглянь, за потреби виправ і збережи.',
    inputNote: 'Про те, що ти написав(-ла)',
    confirm: 'Підтвердити й зберегти',
    saveChanges: 'Зберегти зміни',
    discard: 'Відкинути',
    discardConfirm: 'Чернетку не збережено. Відкинути?',
    saved: 'Збережено в банку слів',
    updated: 'Зміни збережено',
    fromCache: 'Зі спільної памʼяті',
    hasProblems: 'Кілька місць треба виправити:',
    conflict: 'Це слово змінили на іншому пристрої. Завантажено новішу версію; внеси свої зміни ще раз.',
    aiCefrNote: 'Рівень оцінив ШІ, він може бути неточним.',
    derivedTenses: 'Perfekt, Plusquamperfekt і Futur утворюються з допоміжного дієслова і Partizip II.',
    fields: {
      word: 'Слово',
      pos: 'Частина мови',
      cefr: 'Рівень',
      ipa: 'Вимова (IPA)',
      meaning: (n: number) => `Значення ${num(n)}`,
      get translation() {
        return `Переклад (${O()})`
      },
      meaningNote: 'Коротке пояснення',
      examples: 'Приклади',
      get exampleDe() {
        return `Речення (${L()})`
      },
      exampleFa: 'Переклад речення',
      addMeaning: 'Додати значення',
      addExample: 'Додати приклад',
      article: 'Артикль',
      gender: 'Граматичний рід',
      plural: 'Множина',
      genitive: 'Genitiv',
      pluralOnly: 'Вживається лише в множині',
      auxiliary: 'Допоміжне дієслово',
      partizip2: 'Partizip II',
      separable: 'Відокремлюване',
      irregular: 'Неправильне',
      reflexive: 'Зворотне',
      reflexiveNone: 'Ні',
      reflexiveAcc: 'З Akkusativ (mich)',
      reflexiveDat: 'З Dativ (mir)',
      government: 'Прийменник і відмінок',
      comparative: 'Вищий ступінь',
      superlative: 'Найвищий ступінь',
      synonyms: 'Синоніми',
      antonyms: 'Антоніми',
      listHint: 'Розділяй комами',
      collocations: 'Поширені сполучення',
      addCollocation: 'Додати сполучення',
      notes: 'Примітка',
      favorite: 'Обране',
      tags: 'Групи',
      expression: 'Деталі виразу й речення',
      literal: 'Дослівний переклад',
      register: 'Стиль мовлення',
      frequency: 'Поширеність',
      alternatives: 'Інші способи сказати',
      reply: 'Звична відповідь',
      get replyDe() {
        return `Відповідь (${L()})`
      },
      replyFa: 'Переклад відповіді',
      meaningsAll: 'Значення',
      meaningN: (n: number) => `Значення ${num(n)}`,
      ofMeaning: (part: string, n: number) => `${part} значення ${num(n)}`,
      examplesOf: (n: number) => `Приклади значення ${num(n)}`,
      exampleOf: (part: string, meaning: number, example: number) => `${part} (значення ${num(meaning)}, приклад ${num(example)})`,
      example: 'Приклад',
      nounInfo: 'Дані іменника',
      verbInfo: 'Дані дієслова',
      tenseOf: (tense: string) => `Форми: ${tense}`,
      adjectiveForms: 'Ступені порівняння',
      collocationN: (n: number) => `Сполучення ${num(n)}`,
      somePart: 'Одна частина',
    },
    issue(issue: ValidationIssue): string {
      const where = describePath(issue.path)
      switch (issue.code) {
        case 'required':
          return `${where}: порожньо.`
        case 'too_long':
          return `${where}: задовго.`
        case 'too_many':
          return `${where}: більше, ніж дозволено.`
        case 'wrong_script':
          return `${where}: не тим письмом (слово ${Lin()}, переклад ${Oin()}).`
        case 'missing_levels':
          return `${where}: неповне.`
        default:
          return `${where}: неправильно.`
      }
    },
  },

  tags: {
    title: 'Групи',
    none: 'Ще не в жодній групі.',
    add: 'Додати до групи',
    placeholder: 'напр. Урок 3 або Подорож',
    newTag: 'Нова група',
    existing: 'Наявні групи',
    remove: (name: string) => `Прибрати з групи ${name}`,
    all: 'Усі групи',
    help: 'Групи тримають разом слова одного уроку чи теми.',
  },

  import: {
    title: 'Імпорт списку',
    intro: 'Напиши або встав слова сюди: по одному в рядку або через кому.',
    scanTip: 'На iPhone: утримуй палець на полі й обери «Сканувати текст», щоб прочитати слова з паперу.',
    get placeholder() {
      return learningInfo().examples.join('\n')
    },
    listLabel: 'Список слів',
    tagLabel: 'Група для цього списку (необовʼязково)',
    check: 'Перевірити список',
    nothing: 'У цьому тексті слів не знайдено.',
    tooMany: (max: number) => `За раз не більше ${num(max)} слів. Решту імпортуй наступного разу.`,
    reviewTitle: (n: number) => `Створити: ${w(n)}`,
    statusNew: 'Буде створено',
    statusExists: 'Уже в банку',
    statusInvalid: 'Неможливо створити',
    removeItem: (word: string) => `Прибрати ${word} зі списку`,
    start: (n: number) => `Створити ${cards(n)}`,
    nothingToBuild: 'У списку немає нових слів.',
    editList: 'Виправити список',
    progress: (done: number, total: number) => `Готово ${num(done)} з ${num(total)}`,
    position: (i: number, total: number) => `Картка ${num(i)} з ${num(total)}`,
    waiting: 'Наступна картка створюється…',
    confirm: 'Підтвердити й зберегти',
    skip: 'Пропустити',
    failed: (word: string, why: string) => `«${word}» не створено: ${why}`,
    retryFailed: 'Спробувати ще',
    paused: 'Створення зупинено.',
    limitWait: 'Щоб не витрачати забагато, трохи зачекаю й продовжу…',
    doneTitle: 'Список завершено',
    doneSummary: (saved: number, skipped: number, failed: number) =>
      [`Збережено: ${num(saved)}`, skipped ? `пропущено: ${num(skipped)}` : '', failed ? `не створено: ${num(failed)}` : ''].filter(Boolean).join(', ') + '.',
    again: 'Імпортувати інший список',
    toBank: 'До банку слів',
    leaveConfirm: 'Є непідтверджені картки. Якщо вийдеш, вони пропадуть.',
    leave: 'Вийти',
    suggestion: (from: string, to: string) => `«${from}» я сприйняв як «${to}».`,
  },

  words: {
    title: 'Банк слів',
    get search() {
      return `Пошук (${L()} або ${O()})`
    },
    count: (shown: number, total: number) => (shown === total ? w(total) : `${num(shown)} з ${w(total)}`),
    empty: 'Додай перше слово 🌱',
    emptyBody: 'Кожне збережене слово лишається тут і по черзі потрапляє в щоденне повторення.',
    noMatch: 'Таких слів не знайдено.',
    clearFilters: 'Скинути фільтри',
    filters: 'Фільтри й сортування',
    all: 'Усі',
    favorites: 'Обрані',
    difficult: 'Складні',
    dueToday: 'На сьогодні',
    sort: 'Сортування',
    sortNewest: 'Найновіші',
    sortAlpha: 'За алфавітом',
    sortReviewed: 'Останнє повторення',
    sortDue: 'Найближчий термін',
    posGroup: 'Частина мови',
    cefrGroup: 'Рівень',
    tagGroup: 'Група',
    statusGroup: 'Стан',
    select: 'Вибрати',
    selected: (n: number) => `Вибрано: ${num(n)}`,
    archiveSelected: 'Видалити з банку',
    favoriteSelected: 'В обране',
    archiveConfirm: (n: number) => `Видалити з банку слів: ${w(n)}? Історію повторень буде збережено.`,
    showMore: 'Показати більше',
  },

  detail: {
    notFound: 'Слово не знайдено. Можливо, його видалено.',
    meanings: 'Значення',
    translation: 'Переклад',
    literal: 'Дослівний переклад',
    alternatives: 'Інші способи сказати',
    reply: 'Звична відповідь',
    grammar: 'Граматика',
    conjugation: 'Відмінювання дієслова',
    synonyms: 'Синоніми',
    antonyms: 'Антоніми',
    collocations: 'Поширені сполучення',
    notes: 'Примітка',
    learning: 'Стан навчання',
    status: 'Стан',
    nextReview: 'Наступне повторення',
    lastReview: 'Останнє повторення',
    reviewCount: 'Кількість повторень',
    lapses: 'Скільки разів забуто',
    recall: 'Імовірність згадати зараз',
    stability: 'Стійкість у памʼяті',
    difficulty: 'Складність',
    notStarted: 'Ще не в повторенні; у черзі нових слів.',
    get reverseCard() {
      return `Зворотна картка (${O()} → ${L()})`
    },
    reverseWaiting: 'Почнеться, коли вивчиш саме слово.',
    never: 'Ще ні',
    difficultyWords: ['Дуже легко', 'Легко', 'Середньо', 'Складно', 'Дуже складно'],
    regenerate: 'Створити заново з ШІ',
    regenerateConfirm: 'Дані слова буде створено заново і показано як чернетку. Поки не збережеш, нічого не зміниться.',
    archive: 'Видалити з банку слів',
    archiveConfirm: 'Видалити це слово з банку й щоденного повторення? Історію повторень буде збережено.',
    archived: 'Видалено з банку слів',
    favoriteOn: 'Додано в обране',
    favoriteOff: 'Прибрано з обраного',
    addedOn: 'Додано',
    plural: 'Множина',
    genitive: 'Genitiv',
    pluralOnly: 'Лише множина',
    noPlural: 'Немає множини',
    auxiliary: 'Допоміжне дієслово',
    participle: 'Дієприкметник (participle)',
    separable: 'Відокремлюване',
    inseparable: 'Невідокремлюване',
    irregular: 'Неправильне',
    regular: 'Правильне',
    reflexive: 'Зворотне',
    government: 'Вживається з',
    traits: 'Ознаки',
    overdue: (since: string) => `Час настав (${since})`,
    comparative: 'Вищий ступінь',
    superlative: 'Найвищий ступінь',
  },

  study: {
    title: 'Повторення',
    showAnswer: 'Показати відповідь',
    recallPrompt: 'Згадай значення, потім подивися відповідь.',
    get reversePrompt() {
      return `Згадай слово ${Lin()} (іменники з артиклем).`
    },
    get reverseBadge() {
      return `${O()} → ${L()}`
    },
    undo: 'Скасувати попередню відповідь',
    undone: 'Попередню відповідь скасовано.',
    streak: (n: number) => `${num(n)} поспіль!`,
    newBadge: 'Нове слово',
    ratings: { 1: 'Не згадав(-ла)', 2: 'Важко', 3: 'Згадав(-ла)', 4: 'Дуже легко' },
    ratingHelp: {
      1: 'Повернеться дуже скоро',
      2: 'Згадав(-ла), але важко; повернеться трохи раніше',
      3: 'Повернеться вчасно',
      4: 'Повернеться пізніше',
    },
    ratingGuide: 'Як відповідати?',
    nextQuiz: 'Тест',
    nextStory: 'Історія',
    undoLast: 'Скасувати останню відповідь',
    fullDetail: 'Усі деталі слова',
    remaining: (n: number) => `Лишилось: ${cards(n)}`,
    exit: 'Вийти з повторення',
    emptyTitle: 'Сьогодні нема чого повторювати. Чудово! 🎉',
    emptyBody: 'Нові слова, які додаси, по черзі зʼявлятимуться тут.',
    emptyNoWords: 'У тебе ще немає слів для повторення.',
    waitTitle: 'Перепочинь',
    waitBody: (n: number, when: string) => `Картки в процесі (${num(n)}) повернуться ${when}.`,
    waitNow: 'Повторити зараз',
    doneTitle: 'Коло завершено',
    doneCards: 'карток переглянуто',
    doneCorrect: 'правильних згадувань',
    doneTime: 'час',
    doneNew: 'нових слів',
    doneDuration: (ms: number) => (ms < 60_000 ? `${num(Math.max(1, Math.round(ms / 1000)))} с` : `${num(Math.round(ms / 60_000))} хв`),
    doneHome: 'На головну',
    doneGoal: 'І денну мету теж виконано.',
    encourage: 'Нічого страшного, спробуємо ще.',
    proud: 'Це було складно, а ти згадав(-ла)!',
    saveFailed: 'Відповідь збережено на цьому пристрої й буде надіслано, коли зʼявиться інтернет.',
  },

  quiz: {
    title: 'Тест',
    intro: 'Тест складається з твоїх слів. Це лише тренування; щоденний план повторень не зміниться.',
    kinds: {
      mixed: { title: 'Змішаний', body: 'Усі типи разом' },
      choice: { title: 'Вибір відповіді', body: 'Обери правильне значення' },
      typing: {
        title: 'Письмо',
        get body() {
          return `Напиши слово ${Lin()} сам(-а)`
        },
      },
      article: {
        get title() {
          return learningInfo().articles.join(' / ') || 'Артиклі'
        },
        body: 'Артиклі іменників',
      },
      listening: { title: 'Аудіювання', body: 'Слухай і пиши (диктант)' },
      speaking: { title: 'Вимова', body: 'Скажи вголос і перевір вимову' },
    },
    get needSound() {
      return `На цьому пристрої немає голосу (${L()}).`
    },
    listen: 'Слухати',
    listenSlow: 'Повільніше',
    get dictationHelp() {
      return `Пиши ${Lin()} все, що чуєш. Для іменників — з артиклем.`
    },
    speakNow: 'Натисни й говори',
    listening: 'Слухаю…',
    heard: (text: string) => `Я почув: «${text}»`,
    heardNothing: 'Нічого не почув. Спробуй ще, трохи голосніше.',
    micDenied: 'Доступ до мікрофона не надано. Можеш оцінити сам(-а).',
    selfCheckHelp: 'Спершу послухай правильну вимову, повтори вголос, потім скажи, чи вийшло.',
    selfYes: 'Сказав(-ла) правильно',
    selfNo: 'Ще ні',
    speakingHelp: 'Натисни мікрофон і скажи вголос. Я послухаю й скажу, чи правильно.',
    length: 'Кількість питань',
    questions: (n: number) => pl(n, ...QUESTION),
    start: 'Почати тест',
    needWords: 'Спершу додай кілька слів.',
    needFour: 'Для вибору відповіді потрібно щонайменше чотири слова з різними значеннями.',
    needNouns: 'Для цієї вправи в банку слів мають бути іменники.',
    prompts: {
      choice_de_fa: 'Що означає це слово?',
      get choice_fa_de() {
        return `Як це ${Lin()}?`
      },
      get typing_fa_de() {
        return `Напиши ${Lin()}`
      },
      article: 'Який артикль?',
      dictation: 'Слухай і пиши',
      speaking: 'Скажи вголос',
    },
    get typePlaceholder() {
      return `Пиши ${Lin()}`
    },
    typeHelp: 'Для іменників можна писати й артикль.',
    check: 'Перевірити',
    dontKnow: 'Не знаю',
    next: 'Далі',
    finish: 'Побачити результат',
    position: (i: number, total: number) => `Питання ${num(i)} з ${num(total)}`,
    correct: 'Правильно!',
    wrong: 'Неправильно.',
    answerIs: 'Правильна відповідь:',
    notes: {
      case: 'Правильно; лише зверни увагу на великі й малі літери.',
      spelling: 'Правильно; подивися точне написання.',
      wrong_article: 'Слово правильне, але артикль — ні.',
    },
    exit: 'Вийти з тесту',
    exitConfirm: 'Тест не завершено. Якщо вийдеш, наявні відповіді збережуться.',
    resultTitle: 'Результат тесту',
    score: (correct: number, total: number) => `${num(correct)} з ${num(total)}`,
    resultGreat: 'Чудово! Ці слова ти знаєш добре.',
    resultGood: 'Добре. Кілька слів ще потребують практики.',
    resultKeepGoing: 'Нічого; знати, які слова складні, — уже крок уперед.',
    missed: 'Переглянь ці ще раз',
    correctLabel: 'Правильні відповіді',
    accuracyLabel: 'Точність',
    again: 'Ще один тест',
    studyHint: 'Слова з помилками частіше трапляються в наступних тестах.',
  },

  stats: {
    title: 'Статистика',
    empty: 'Статистики ще немає. Додай кілька слів і почни повторювати.',
    insightStart: 'Кожне повторення зʼявиться тут.',
    insightStreak: (n: number) => `Ти повторюєш уже ${days(n)} поспіль. Так тримати!`,
    insightRetention: (p: string) => `Під час повторення ти згадав(-ла) ${p} слів.`,
    insightMastered: (n: number) => `Закріплено в памʼяті: ${w(n)}.`,
    words: 'Слова',
    wordsTotal: (n: number) => `${w(n)} в банку`,
    periodTitle: 'Повторення',
    today: 'Сьогодні',
    week: '7 днів',
    month: '30 днів',
    reviews: 'повторень',
    minutes: 'хвилин',
    newWords: 'нових слів',
    activeDays: 'активних днів',
    retention: 'Згадування',
    retentionHelp: 'Згадування — яку частку вже вивчених слів ти згадав(-ла) під час повторення.',
    streakNow: 'днів поспіль',
    streakBest: 'рекорд',
    activity: 'Повторення за 30 днів',
    activityNone: 'За ці 30 днів повторень не було.',
    forecast: 'Повторення на 14 днів уперед',
    forecastToday: 'Сьогодні',
    forecastHelp: 'Скільки карток настане щодня, якщо не додавати нових слів.',
    forecastNone: 'У найближчі два тижні карток немає.',
    levels: 'Рівні слів',
    noLevel: 'Без рівня',
    difficult: 'Складні слова',
    difficultNone: 'Немає слів, які постійно забуваються.',
    lapses: (n: number) => `забуто ${num(n)} раз(и)`,
    quiz: 'Тести (90 днів)',
    quizAnswersLabel: 'відповідей у тестах',
    quizNone: 'Ти ще не проходив(-ла) тестів.',
    perDay: (key: string, n: number) => `${key}: ${pl(n, ...REVIEW)}`,
    weekTitle: 'Минулий тиждень',
    weekNone: 'Цього тижня ти ще не повторював(-ла). Почни з кількох карток.',
    saidReviews: (minutes: number) => `карток повторено за ${num(minutes)} хв`,
    saidNew: 'нових слів вивчено',
    saidRetention: 'попередніх слів згадано правильно',
    saidDays: 'днів навчання з семи',
    journey: 'Шлях слів',
    journeyHelp: 'Кожне слово починає як «нове» і з кожним правильним повторенням просувається на крок, доки не стане «закріпленим» — тоді ти його навряд чи забудеш.',
    calendar: 'Останні пʼять тижнів',
    streakLine: (now: number, best: number) => `${days(now)} поспіль, рекорд ${num(best)}`,
    less: 'Менше',
    more: 'Більше',
  },

  settings: {
    title: 'Налаштування',
    account: 'Акаунт',
    displayName: 'Імʼя',
    email: 'Ел. пошта',
    signOut: 'Вийти з акаунта',
    signOutConfirm: 'Ти вийдеш з акаунта, а дані на цьому пристрої буде стерто. На сервері вони лишаться.',
    signOutPending: (n: number) => `Ще не надіслано на сервер: ${pl(n, ...CHANGE)}. При виході їх буде втрачено. Спершу підключися до інтернету.`,
    learning: 'Навчання',
    newPerDay: 'Нових слів на день',
    newPerDayHelp: 'Кожне нове слово повторюється кілька разів у наступні дні.',
    newPerDayWarn: 'Велике число — набагато більше щоденних повторень у наступні тижні.',
    newPerDayZero: 'З нулем повторюються лише попередні слова.',
    dailyGoal: 'Денна мета',
    dailyGoalHelp: 'Мета за часом не залежить від кількості нових слів.',
    minutes: (n: number) => `${num(n)} хв`,
    advanced: 'Розширені налаштування навчання',
    reviewLimit: 'Денний ліміт повторень',
    reviewLimitAuto: 'Автоматично (без ліміту)',
    reviewLimitCustom: 'Фіксований ліміт',
    reviewLimitHelp: 'В автоматичному режимі показуються всі картки, яким настав час. Ліміт переносить решту на наступні дні.',
    retention: 'Цільова точність',
    retentionHelp: 'Яку частку слів хочеш згадувати під час повторення. Більше число — більше повторень.',
    learningSteps: 'Кроки вивчення нового слова: 1 хвилина і 10 хвилин. Крок перевивчення: 10 хвилин.',
    get reverseCards() {
      return `Зворотні картки (${O()} → ${L()})`
    },
    get reverseCardsHelp() {
      return `Для кожного слова створюється друга картка, яка показує значення ${Oin()} і питає слово ${Lin()}. Вона зʼявляється через кілька днів після вивчення слова й додає повторень.`
    },
    audio: 'Звук',
    speechRate: 'Швидкість вимови',
    speechSlow: 'Повільно',
    speechNormal: 'Звичайно',
    autoplay: 'Автоматично відтворювати вимову на картці',
    audioTest: 'Перевірити звук',
    aiVoice: 'Природний голос (ШІ)',
    aiVoiceHelp: 'З інтернетом слова й речення читає природний голос. Кожен текст створюється лише раз і зберігається. Без інтернету звучить голос телефона.',
    voiceFemale: 'Жіночий голос',
    voiceMale: 'Чоловічий голос',
    get audioUnavailable() {
      return `У цьому браузері немає голосу (${L()}).`
    },
    appearance: 'Вигляд',
    themes: { system: 'Як на пристрої', light: 'Світлий', dark: 'Темний' },
    data: 'Дані й синхронізація',
    syncNow: 'Синхронізувати',
    syncing: 'Синхронізація…',
    synced: (when: string) => `Остання синхронізація: ${when}`,
    neverSynced: 'Ще не синхронізовано',
    pending: (n: number) => `Очікують надсилання: ${pl(n, ...CHANGE)}`,
    export: 'Завантажити файл даних',
    exportHelp: 'Усі слова, картки та історія повторень в одному файлі JSON.',
    exportFailed: 'Файл не створено. Перевір інтернет.',
    privacy: 'Приватність',
    privacyBody:
      'Твої слова й історію повторень бачиш лише ти. Кожне створене слово надсилається на аналіз до OpenAI; твоя пошта й імʼя не надсилаються. Готовий аналіз слова спільний для всіх користувачів, але твої правки — ні.',
    deleteAccount: 'Повністю видалити акаунт',
    deleteHelp: 'Акаунт, усі слова й історію повторень буде видалено назавжди без можливості відновлення.',
    deleteConfirmLabel: 'Для підтвердження введи свою пошту',
    deleteConfirmButton: 'Видалити мій акаунт назавжди',
    deleted: 'Акаунт видалено.',
    about: 'Про Hodhod',
    version: 'Версія',
    scheduler: 'Алгоритм повторень',
    aboutBody: 'Розклад повторень складає FSRS (відкрита реалізація ts-fsrs). Перський шрифт: Vazirmatn.',
    saved: 'Збережено',
  },

  sync: {
    offlineBanner: 'Ти офлайн. Повторення працює і збережеться, коли зʼявиться інтернет.',
    firstLoad: 'Завантажую твої слова…',
    firstLoadFailed: 'Не вдалося завантажити твої дані.',
  },

  pos: {
    noun: 'Іменник',
    verb: 'Дієслово',
    adjective: 'Прикметник',
    adverb: 'Прислівник',
    preposition: 'Прийменник',
    conjunction: 'Сполучник',
    pronoun: 'Займенник',
    article: 'Артикль',
    numeral: 'Числівник',
    interjection: 'Вигук',
    particle: 'Частка',
    phrase: 'Вираз',
    sentence: 'Речення',
    other: 'Інше',
  },

  register: {
    neutral: 'Нейтральний',
    informal: 'Розмовний',
    formal: 'Офіційний',
    slang: 'Сленг',
    vulgar: 'Грубий',
  },

  frequency: { 1: 'Рідковживане', 2: 'Поширене', 3: 'Дуже поширене' },

  status: {
    new: 'Нове',
    learning: 'Вивчається',
    review: 'Повторюється',
    mastered: 'Закріплене',
  },

  levels: { easy: 'Простий', medium: 'Середній', hard: 'Просунутий' },

  cefr: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],

  store: {
    title: 'Набори слів',
    intro: 'Готові безкоштовні набори. Кожен має кілька коротких уроків; щойно почнеш урок, його слова додаються до щоденного повторення.',
    tile: 'Набори слів',
    tileHint: 'Готові слова й речення',
    mine: 'Мої набори',
    all: 'Усі',
    kinds: { words: 'Слова', sentences: 'Речення', expressions: 'Вирази', mixed: 'Змішані' },
    levels: { basic: 'Базовий', advanced: 'Просунутий' },
    size: (items: number, lessons: number) => `${pl(items, ...ITEM)}, ${pl(lessons, ...LESSON)}`,
    learning: 'Вивчається',
    empty: 'Наборів ще немає. Незабаром!',
    emptyFilter: 'У цій категорії наборів немає.',
    unavailable: 'Магазин ще не запущено на сервері.',
    notFound: 'Набір не знайдено.',
    progress: (learned: number, total: number) => `Вивчено ${num(learned)} з ${num(total)}`,
    lesson: (n: number) => `Урок ${num(n)}`,
    lessonDone: 'Завершено',
    lessonActive: 'Вивчається',
    lessonOpen: 'Готовий до старту',
    lessonLocked: 'Закрито',
    lessonWords: (n: number) => pl(n, ...ITEM),
    lessonProgress: (done: number, total: number) => `Вивчено ${num(done)} з ${num(total)}`,
    continueLesson: (n: number) => `Продовжити урок ${num(n)}`,
    continueHint: 'Слова цього уроку зʼявляються і в щоденному повторенні.',
    lockedHint: 'Урок відкриється, коли ти хоча б раз правильно відповіси на всі слова попереднього уроку.',
    start: (n: number) => `Почати урок ${num(n)}`,
    starting: 'Додаю…',
    started: (n: number) => `До банку слів додано: ${pl(n, ...ITEM)}`,
    startedNone: 'Усі елементи цього уроку вже були в банку слів.',
    studyPack: 'Повторити цей набір',
    studyPackHint: 'Лише картки цього набору; розклад той самий, що й у щоденному повторенні.',
    nothingToStudy: 'Зараз із цього набору нема чого повторювати.',
    preview: 'Переглянути елементи',
    packOnly: (title: string) => `Лише набір «${title}»`,
  },

  report: {
    button: 'Повідомити про помилку в картці',
    title: 'Що не так?',
    reasons: { meaning: 'Значення', example: 'Приклади', grammar: 'Граматика', audio: 'Вимова', other: 'Інше' },
    message: 'Пояснення (необовʼязково)',
    messagePlaceholder: 'напр.: друге значення неправильне, має бути «…».',
    send: 'Надіслати',
    sent: 'Дякуємо! Повідомлення отримано, ми його перевіримо.',
  },

  feedback: {
    button: 'Повідомити про проблему чи ідею',
    hint: 'Напиши, що зламалося або що хотілося б додати.',
    title: 'Розкажи нам',
    kinds: { bug: 'Проблема', idea: 'Ідея', other: 'Інше' },
    placeholder: 'Що сталося? Або що хочеш додати?',
    send: 'Надіслати',
    sent: 'Дякуємо! Повідомлення отримано.',
    empty: 'Спершу напиши кілька слів.',
  },

  friends: {
    title: 'З друзями',
    tile: 'З друзями',
    tileHint: 'Таблиця тижня',
    myCode: 'Мій код дружби',
    share: 'Надіслати код',
    shareText: (code: string, url: string) => `Вчімо мову разом (${L()})! Введи мій код дружби в Hodhod: ${code}\n${url}`,
    copied: 'Код скопійовано',
    addTitle: 'Додати друга',
    addLabel: 'Код дружби',
    add: 'Додати',
    badCode: 'Код дружби — 8 літер і цифр, напр. ABCD2345.',
    privacy: 'Друзі бачать лише твоє імʼя, серію, кількість відповідей за тиждень і кількість вивчених слів, але не самі слова.',
    results: {
      sent: 'Запит надіслано. Коли друг прийме, він зʼявиться тут.',
      accepted: 'Тепер ви друзі!',
      not_found: 'Нікого з таким кодом не знайдено.',
      self: 'Це твій власний код 🙂',
      exists: 'Ви вже друзі або запит уже надіслано.',
      too_many: 'Забагато запитів без відповіді; трохи зачекай.',
    },
    incoming: 'Запити в друзі',
    accept: 'Прийняти',
    decline: 'Ні',
    board: 'Таблиця цього тижня',
    thisWeek: 'З понеділка',
    alone: 'Ти ще не додав(-ла) друзів. Надішли свій код, щоб учитися разом.',
    me: 'Ти',
    noName: 'Без імені',
    learned: (n: number) => `Вивчено: ${w(n)}`,
    answers: 'відповідей за тиждень',
    days: 'днів поспіль',
    streak: 'Серія',
    rank: (n: number) => `${num(n)}-е місце`,
    waiting: (names: string) => `Очікуємо відповіді: ${names}`,
    remove: 'Видалити друга',
    removeConfirm: (name: string) => `Видалити ${name} з друзів?`,
    unavailable: 'Розділ друзів ще не запущено на сервері.',
  },

  stories: {
    title: 'Коротка історія',
    tile: 'Історія',
    tileHint: 'З твоїми словами',
    intro: 'Я напишу коротку історію зі словами, які ти вчиш, з перекладом кожного речення.',
    needWords: (n: number) => `Для історії потрібно щонайменше ${w(n)}. Спершу додай кілька слів.`,
    level: 'Рівень',
    write: 'Написати історію',
    writing: 'Пишу… (до пів хвилини)',
    limitHelp: 'Не більше 3 історій на день.',
    limit: 'Історії на сьогодні вичерпано. Заходь завтра.',
    unavailable: 'Історії ще не запущено на сервері.',
    mine: 'Мої історії',
    unread: 'Нова',
    notFound: 'Історію не знайдено.',
    playAll: 'Відтворити все',
    showAll: 'Показати всі переклади',
    hideAll: 'Сховати переклади',
    tapHelp: 'Натисни на речення, щоб побачити переклад. Твої слова виділено кольором.',
    yourWords: (n: number) => `Твоїх слів у цій історії: ${num(n)}`,
    another: 'Ще одна історія',
  },

  deck: {
    title: 'З Anki чи Quizlet',
    entry: 'Імпорт з Anki чи Quizlet',
    get intro() {
      return `Обери текстовий файл своїх карток з Anki чи Quizlet. Кожен рядок — картка: ${L()} і ${O()} (порядок не важливий).`
    },
    pickFile: 'Обрати файл',
    get placeholder() {
      const [noun, phrase] = learningInfo().examples
      return `${noun}\t…\n${phrase}\t…`
    },
    howTitle: 'Як отримати файл?',
    get how() {
      return [
        'Anki: колода → Export → «Notes in Plain Text (.txt)».',
        'Quizlet: модуль → ⋯ → Export → скопіюй текст і встав унизу цієї сторінки.',
        `Підійде й будь-який текстовий файл, де в кожному рядку слово (${L()}) і його значення (${O()}), розділені табуляцією чи комою.`,
      ]
    },
    paste: 'Або встав текст сюди',
    read: 'Прочитати текст',
    found: (n: number) => `Знайдено: ${cards(n)}`,
    countNew: ' нових карток',
    countExisting: ' уже в банку слів',
    countSkipped: ' рядків не прочитано',
    andMore: (n: number) => `і ще ${cards(n)}`,
    nothingNew: 'У цьому файлі нових карток немає.',
    importQuick: (n: number) => `Імпортувати ${cards(n)}`,
    importing: (done: number, total: number) => `${num(done)} з ${num(total)}…`,
    quickHelp: 'Як є, без ШІ: швидко й безкоштовно. Потім на будь-якій картці можна натиснути «Створити заново з ШІ», щоб отримати приклади й відмінювання.',
    withAi: (n: number) => `Створити повні картки з ШІ (${num(n)})`,
    aiHelp: (max: number) => `З прикладами, вимовою і граматикою; за раз не більше ${num(max)} карток, і кожну ти підтверджуєш сам(-а).`,
    imported: (n: number) => `До банку слів додано: ${cards(n)}`,
    other: 'Інший файл',
    export: 'Експорт для Anki',
    exportHelp: 'Експорт для Anki — це текстовий файл, який відкривається в Anki через «Import File».',
  },

  reminders: {
    title: 'Нагадування',
    offBody: "Я можу нагадувати тобі на телефон у будь-який обраний час приділити кілька хвилин своїм словам.",
    turnOn: 'Увімкнути нагадування',
    turnOff: 'Вимкнути на цьому пристрої',
    enabled: 'Нагадування увімкнено',
    denied: 'Дозвіл на сповіщення не надано.',
    deniedHelp: 'Сповіщення Hodhod заблоковано. Дозволь їх знову в налаштуваннях телефона чи браузера.',
    unsupported: 'Цей браузер не підтримує сповіщення.',
    needsInstall: 'На iPhone сповіщення працюють лише у встановленому Hodhod: у Safari натисни «Поділитися» → «На початковий екран», потім відкрий Hodhod з початкового екрана й повернися сюди.',
    daily: "Мої нагадування",
    dailyTime: 'Час нагадування',
    dailyHelp: "Додай будь-який час; кожне нагадування приходить у свій час (іноді на кілька хвилин пізніше).",
    addTime: "Додати нагадування",
    removeTime: (time: string) => `Видалити нагадування о ${time}`,
    onlyPending: "Лише якщо я ще не повторював(-ла)",
    onlyPendingHelp: "Якщо увімкнено, пізніші нагадування дня не приходять, коли ти вже повторив(-ла) того дня.",
    timesFull: "Не більше 8 нагадувань на день.",
    streak: 'Попередження про серію (о 20:30)',
    updates: 'Новини Hodhod (нові набори, нова версія)',
    limitHelp: "Нагадування обираєш ти; попередження про серію приходить, лише якщо ти того дня не повторював(-ла).",
    test: 'Надіслати тестове сповіщення',
    testSent: 'Надіслано; зачекай кілька секунд.',
    testNone: 'Сповіщення не надіслано. Вимкни й знову ввімкни нагадування.',
  },

  staging: 'Тестова версія',

  update: {
    title: 'Вийшла нова версія Hodhod!',
    body: 'Онови один раз, щоб побачити зміни.',
    reload: 'Оновити',
  },

  news: {
    title: 'Новина',
    dismiss: 'Зрозуміло',
  },

  errors: {
    offline: 'Немає підключення до інтернету.',
    timeout: 'Це триває задовго, відповіді немає.',
    auth: 'Потрібно увійти знову.',
    duplicate: 'Це слово вже є в твоєму банку слів.',
    conflict: 'Це змінили в іншому місці.',
    rate_limit: 'Забагато запитів. Спробуй трохи згодом.',
    rate_limit_day: 'Денний ліміт створення слів вичерпано. Спробуй завтра.',
    validation: 'Введення не прийнято.',
    not_configured: 'Сервіс ШІ ще не налаштовано.',
    ai_quota: 'Кредит акаунта ШІ вичерпано.',
    not_found: 'Не знайдено.',
    server: 'Сервер відповів некоректно. Спробуй трохи згодом.',
    ai_invalid: 'Відповідь ШІ непридатна. Спробуй ще.',
  },
}
