/** Russian interface. Same shape as fa.ts (the admin panel stays Persian). */
import type { ValidationIssue } from '../../../supabase/functions/_shared/wordSchema.ts'
import { num } from '../format.ts'
import { describePath, type Dictionary } from '../strings.ts'
import { L as Lname, O as Oname } from './names.ts'
import { learningInfo } from '../learning.ts'

/** 1 слово, 2 слова, 5 слов, 21 слово */
const pl = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100
  const b = a % 10
  return `${num(n)} ${a >= 11 && a <= 14 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many}`
}
const WORD = ['слово', 'слова', 'слов'] as const
const CARD = ['карточка', 'карточки', 'карточек'] as const
const DAY = ['день', 'дня', 'дней'] as const
const MIN = ['минута', 'минуты', 'минут'] as const
const REVIEW = ['повторение', 'повторения', 'повторений'] as const
const ITEM = ['элемент', 'элемента', 'элементов'] as const
const LESSON = ['урок', 'урока', 'уроков'] as const
const QUESTION = ['вопрос', 'вопроса', 'вопросов'] as const
const CHANGE = ['изменение', 'изменения', 'изменений'] as const
const w = (n: number) => pl(n, ...WORD)
const cards = (n: number) => pl(n, ...CARD)
const days = (n: number) => pl(n, ...DAY)
const mins = (n: number) => pl(n, ...MIN)

// Language names from the browser are adjectives ("немецкий"); a few cases are built from them.
/** "немецкий" */
const L = () => Lname()
const O = () => Oname()
/** "на немецком" */
const Lin = () => `на ${L().replace(/ий$/, 'ом')}`
const Oin = () => `на ${O().replace(/ий$/, 'ом')}`
/** "немецкое" (слово) */
const Ln = () => L().replace(/ий$/, 'ое')
/** "немецкие" (слова) */
const Lp = () => L().replace(/ий$/, 'ие')

export const ru: Dictionary = {
  nav: { home: 'Главная', create: 'Новое слово', words: 'Слова', study: 'Повторение', quiz: 'Тест', settings: 'Настройки', stats: 'Статистика' },

  gender: { m: 'мужской', f: 'женский', n: 'средний', c: 'общий (de)' },

  common: {
    cancel: 'Отмена',
    retry: 'Попробовать ещё',
    save: 'Сохранить',
    edit: 'Изменить',
    delete: 'Удалить',
    close: 'Закрыть',
    back: 'Назад',
    yes: 'Да',
    no: 'Нет',
    add: 'Добавить',
    remove: 'Убрать',
    loading: 'Загрузка…',
    offline: 'Ты офлайн',
    preview: 'Предпросмотр',
    listSep: ', ',
    play: 'Послушать произношение',
    optional: 'необязательно',
  },

  auth: {
    language: 'Язык',
    chooseTitle: 'Выбери свой язык',
    chooseBody: 'Hodhod будет говорить с тобой на этом языке. Потом ты выберешь язык, который хочешь учить.',
    tagline: 'Умные карточки для нужных тебе слов — каждый день чуть больше',
    hello: 'Привет! Я Hodhod.',
    signIn: 'Войти',
    signUp: 'Создать аккаунт',
    name: 'Имя',
    namePlaceholder: 'Как к тебе обращаться?',
    email: 'Эл. почта',
    password: 'Пароль',
    passwordHint: 'Не меньше 8 символов',
    submitSignIn: 'Войти',
    submitSignUp: 'Создать аккаунт',
    forgot: 'Я забыл(а) пароль',
    resetSent: 'Если этот адрес зарегистрирован, на него отправлена ссылка для смены пароля.',
    resetNeedsEmail: 'Сначала введи почту, потом нажми здесь ещё раз.',
    confirmSent: 'Мы отправили письмо для подтверждения. Нажми ссылку в нём, чтобы активировать аккаунт.',
    newPasswordTitle: 'Новый пароль',
    newPasswordSubmit: 'Сменить пароль',
    passwordChanged: 'Пароль изменён.',
    errors: {
      invalid_credentials: 'Неверная почта или пароль.',
      invalid_grant: 'Неверная почта или пароль.',
      email_not_confirmed: 'Ты ещё не подтвердил(а) почту. Нажми ссылку в письме.',
      user_already_exists: 'С этой почтой уже есть аккаунт. Используй «Войти».',
      email_exists: 'С этой почтой уже есть аккаунт. Используй «Войти».',
      weak_password: 'Пароль слишком короткий или простой. Выбери подлиннее.',
      signup_disabled: 'Регистрация новых аккаунтов сейчас закрыта.',
      otp_expired: 'Срок действия ссылки истёк. Запроси новую.',
      same_password: 'Новый пароль должен отличаться от старого.',
      email_invalid: 'Похоже, адрес неверный.',
      password_short: 'Пароль должен быть не короче 8 символов.',
      captcha_failed: 'Проверка «Ты человек?» не прошла. Обнови страницу и попробуй ещё.',
      user_banned: 'Этот аккаунт заблокирован.',
      over_request_rate_limit: 'Слишком много попыток. Подожди несколько минут и попробуй снова.',
      over_email_send_rate_limit: 'Сервер сейчас не может отправлять письма (исчерпан часовой лимит). Попробуй через час.',
      fallback: 'Не удалось войти. Попробуй ещё.',
    } as Record<string, string>,
  },

  setup: {
    title: 'Приложение ещё не подключено к серверу',
    body: 'Адрес и публичный ключ Supabase не указаны в config.js.',
    backendMissing: 'База данных ещё не готова. Таблицы приложения в Supabase не созданы.',
  },

  home: {
    greeting(hour: number, name: string | null) {
      const part = hour < 4 ? 'Доброй ночи' : hour < 11 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер'
      return name ? `${part}, ${name}` : part
    },
    today: 'План на сегодня',
    newCards: 'Новые',
    reviews: 'Повторение',
    learning: 'В процессе',
    minutesLabel: 'мин',
    startReview: 'Продолжить повторение',
    startNew: 'Учить новые слова',
    startMixed: 'Начать',
    addFirst: 'Добавь первое слово',
    addWord: 'Добавить слово',
    allDone: 'На сегодня всё',
    allDoneBody: 'Ты просмотрел(а) все карточки на сегодня. До завтра!',
    waitingLater: (when: string) => `Следующая карточка вернётся ${when}.`,
    nothingDue: 'Сегодня нет карточек для повторения.',
    newWaiting: (n: number) => `Сохранённые слова ждут следующих дней: ${w(n)}.`,
    goal: 'Цель на день',
    goalProgress: (done: number, goal: number) => `${num(done)} из ${num(goal)} мин`,
    goalDone: 'Цель на сегодня выполнена',
    streak: (n: number) => `${days(n)} подряд`,
    streakNone: 'Начни сегодня',
    streakKeep: 'Сегодня ты ещё не повторял(а)',
    statsHint: 'Прогресс и трудные слова',
    bank: 'Банк слов',
    bankCount: (n: number) => w(n),
    week: 'Последние семь дней',
    weekReviews: (n: number) => pl(n, ...REVIEW),
    planMinutes: (minutes: number) => `около ${num(Math.max(1, minutes))} мин`,
    planNew: (n: number) => pl(n, 'новое слово', 'новых слова', 'новых слов'),
    goalRing: (done: number, goal: number) => `${num(done)} из ${num(goal)} мин`,
    goalLeft: (left: number) => `ещё ${num(left)} мин до цели`,
    dayDone: 'На сегодня всё',
    todayCard: 'Сегодня: цель, серия и статистика',
    statsLink: 'Статистика',
    more: 'Другие разделы',
    streakDays: 'дней подряд',
    streakBest: (n: number) => `Рекорд: ${days(n)}`,
    streakTodayDone: 'Сегодня тоже повторено',
    weekTitle: 'Последние 7 дней',
    weekDone: (n: number) => `${num(n)} из 7 дней`,
    mascot: {
      get first() {
        return `Привет! Я Hodhod. Дай мне ${Ln()} слово — и начнём вместе.`
      },
      morning: 'Доброе утро! Начнём день с нескольких карточек?',
      due: 'Карточки на сегодня готовы — когда будешь готов(а) ты.',
      goalDone: 'Цель на сегодня достигнута. Браво!',
      allDone: 'На сегодня хватит. Отличная работа!',
      back: 'С возвращением! Продолжим с того же места.',
      idle: 'Услышал(а) новое слово? Добавь его.',
    },
  },

  celebrate: {
    title: (n: number) => `${days(n)} подряд!`,
    body: (n: number): string =>
      n >= 100 ? 'Невероятно. Теперь ты настоящий ученик.' : n >= 30 ? 'Целый месяц! Слова закрепляются.' : n >= 7 ? 'Целая неделя. Привычка формируется!' : 'Отличное начало. Жду тебя завтра.',
    continue: 'Дальше',
  },

  welcome: {
    progress: (n: number, total: number) => `Шаг ${num(n)} из ${num(total)}`,
    skip: 'Пропустить',
    next: 'Дальше',
    start: 'Начнём',
    hello: (name: string | null) => (name ? `Привет, ${name}, добро пожаловать!` : 'Привет, добро пожаловать!'),
    helloAgain: (name: string | null) => (name ? `${name}, Hodhod обновился!` : 'Hodhod обновился!'),
    helloAgainBody: 'Я принёс кое-что новое. Потом два коротких вопроса, чтобы заново составить план на день; твои карточки и прогресс останутся.',
    whatsNew: [
      ['🔊', 'Естественный голос для слов и предложений'],
      ['📦', 'Готовые наборы слов и предложений, урок за уроком'],
      ['💬', 'Карточки для предложений и выражений'],
      ['🎧', 'Аудирование и произношение в тестах'],
      ['📖', 'Короткие истории с твоими словами'],
      ['👥', 'Учёба с друзьями'],
      ['🔔', 'Напоминания на телефон'],
    ] as [string, string][],
    ownTitle: 'Какой твой язык?',
    ownBody: 'Hodhod будет говорить с тобой на этом языке и писать на нём значения слов.',
    learnTitle: 'Какой язык хочешь учить?',
    learnBody: 'У каждого языка свой цвет и свои карточки.',
    introTitle: 'Как работает Hodhod?',
    get intro() {
      return [
        ['🗂️', 'Hodhod — умные карточки (Лейтнер), а не языковой курс: ты повторяешь именно нужные тебе слова и именно вовремя, чтобы они запомнились.'],
        ['✨', `Напиши любое ${Ln()} слово; за несколько секунд ИИ создаст карточку со значением ${Oin()}, примерами и произношением. Просмотри её перед сохранением и при необходимости исправь.`],
        ['📦', 'Есть и готовые наборы слов, предложений и выражений, урок за уроком. Карточки наборов проверили два разных ИИ.'],
        ['🎨', 'У каждого языка свой цвет и карточки. С Hodhod Plus можно учить несколько языков одновременно.'],
      ] as [string, string][]
    },
    languageFailed: 'Выбор языка не сохранён. Проверь соединение и попробуй ещё.',
    reminderTitle: 'Хочешь напоминания?',
    reminderOn: 'Включить напоминания',
    reminderDone: 'Напоминания включены',
    get helloBody() {
      return `Я Hodhod. Помогу тебе каждый день учить несколько слов (${L()}) и больше их не забывать. Два коротких вопроса — и план готов.`
    },
    timeTitle: 'Сколько времени у тебя в день?',
    timeBody: 'Понемногу, но каждый день — лучше, чем много, но изредка.',
    minutes: (n: number) => mins(n),
    timeHint: { 5: 'За завтраком или в очереди', 10: 'Короткий перерыв', 20: 'Настоящая тренировка', 30: 'Для тех, кто всерьёз' } as Record<number, string>,
    get levelTitle() {
      return `Как твой ${L()}?`
    },
    levelBody: 'По твоему ответу я предложу, сколько новых слов учить в день.',
    levels: { beginner: 'Только начинаю', some: 'Немного знаю', intermediate: 'Средний уровень' },
    levelHints: { beginner: 'A1, знаю несколько слов', some: 'A2, говорю простыми предложениями', intermediate: 'B1 или выше' },
    perDay: 'Новых слов в день',
    perDayHelp: 'Каждое новое слово повторяется несколько раз в следующие дни. Большое число делает следующие недели тяжёлыми.',
    less: 'Меньше',
    more: 'Больше',
    readyTitle: 'Твой план готов!',
    readyBody: (minutes: number, perDay: number) => `Каждый день ${mins(minutes)}, новых слов: ${num(perDay)}. Когда бы ты ни пришёл(ла), карточки дня будут готовы.`,
    changeLater: 'Всё это можно изменить в настройках в любое время.',
    firstWord: 'Добавить первое слово',
    toHome: 'На главную',
  },

  decks: {
    title: 'Мои языки',
    choose: 'Что повторяем сегодня?',
    words: (n: number) => w(n),
    current: 'Сейчас открыт',
    add: 'Добавить язык',
    addTitle: 'Какой ещё язык хочешь учить?',
    plusTitle: 'Второй язык с Hodhod Plus',
    plusBody: 'Изучение нескольких языков одновременно — часть Hodhod Plus. Plus скоро появится.',
    failed: 'Язык не изменён. Проверь соединение и попробуй ещё.',
    switchHint: 'Другой язык',
  },

  create: {
    title: 'Новое слово',
    get label() {
      return `Слово или выражение ${Lin()}`
    },
    get placeholder() {
      return `напр. ${learningInfo().example}`
    },
    get help() {
      const [noun, phrase, sentence] = learningInfo().examples
      return `Напиши слово, выражение или короткое предложение, например ${noun}, ${phrase} или ${sentence}`
    },
    importLink: 'Импортировать целый список',
    submit: 'Создать карточку',
    loading: 'Готовлю карточку для этого слова…',
    loadingHint: 'Обычно это занимает 10–20 секунд.',
    failed: 'Сейчас не удалось подготовить это слово.',
    notAWord: (word: string) => `Я не узнал «${word}» как слово или выражение ${Lin()}. Проверь написание.`,
    wrongLanguage: (word: string) => `«${word}» — это не ${L()}. Пока я создаю только ${Lp()} слова.`,
    didYouMean: 'Ты имел(а) в виду это?',
    useSuggestion: 'Да, это',
    duplicateTitle: 'Это слово уже есть в твоём банке слов',
    duplicateOpen: 'Открыть слово',
    duplicateRegenerate: 'Создать данные заново',
    inputErrors: {
      empty: 'Напиши слово.',
      too_long: 'Слишком длинно. Напиши слово, выражение или короткое предложение (до 20 слов).',
      multiple_words: 'Слишком длинно. В предложении может быть до 20 слов.',
      get wrong_script() {
        return `Напиши слово ${Lin()}, а не ${Oin()}.`
      },
      get invalid_characters() {
        return `Только буквы (${L()}), без цифр и знаков.`
      },
    },
  },

  draft: {
    banner: 'Это черновик, он ещё не сохранён. Просмотри, при необходимости исправь и сохрани.',
    inputNote: 'О том, что ты написал(а)',
    confirm: 'Подтвердить и сохранить',
    saveChanges: 'Сохранить изменения',
    discard: 'Отбросить',
    discardConfirm: 'Черновик не сохранён. Отбросить?',
    saved: 'Сохранено в банке слов',
    updated: 'Изменения сохранены',
    fromCache: 'Из общей памяти',
    hasProblems: 'Несколько мест нужно исправить:',
    conflict: 'Это слово изменили на другом устройстве. Загружена более новая версия; внеси свои изменения ещё раз.',
    aiCefrNote: 'Уровень оценил ИИ, он может быть неточным.',
    derivedTenses: 'Perfekt, Plusquamperfekt и Futur образуются из вспомогательного глагола и Partizip II.',
    fields: {
      word: 'Слово',
      pos: 'Часть речи',
      cefr: 'Уровень',
      ipa: 'Произношение (IPA)',
      meaning: (n: number) => `Значение ${num(n)}`,
      get translation() {
        return `Перевод ${Oin()}`
      },
      meaningNote: 'Короткое пояснение',
      examples: 'Примеры',
      get exampleDe() {
        return `Предложение ${Lin()}`
      },
      exampleFa: 'Перевод предложения',
      addMeaning: 'Добавить значение',
      addExample: 'Добавить пример',
      article: 'Артикль',
      gender: 'Грамматический род',
      plural: 'Множественное число',
      genitive: 'Genitiv',
      pluralOnly: 'Употребляется только во множественном числе',
      auxiliary: 'Вспомогательный глагол',
      partizip2: 'Partizip II',
      separable: 'Отделяемый',
      irregular: 'Неправильный',
      reflexive: 'Возвратный',
      reflexiveNone: 'Нет',
      reflexiveAcc: 'С Akkusativ (mich)',
      reflexiveDat: 'С Dativ (mir)',
      government: 'Предлог и падеж',
      comparative: 'Сравнительная степень',
      superlative: 'Превосходная степень',
      synonyms: 'Синонимы',
      antonyms: 'Антонимы',
      listHint: 'Разделяй запятыми',
      collocations: 'Частые сочетания',
      addCollocation: 'Добавить сочетание',
      notes: 'Заметка',
      favorite: 'Избранное',
      tags: 'Группы',
      expression: 'Детали выражения и предложения',
      literal: 'Дословный перевод',
      register: 'Стиль речи',
      frequency: 'Употребительность',
      alternatives: 'Другие способы сказать',
      reply: 'Обычный ответ',
      get replyDe() {
        return `Ответ ${Lin()}`
      },
      replyFa: 'Перевод ответа',
      meaningsAll: 'Значения',
      meaningN: (n: number) => `Значение ${num(n)}`,
      ofMeaning: (part: string, n: number) => `${part} значения ${num(n)}`,
      examplesOf: (n: number) => `Примеры значения ${num(n)}`,
      exampleOf: (part: string, meaning: number, example: number) => `${part} (значение ${num(meaning)}, пример ${num(example)})`,
      example: 'Пример',
      nounInfo: 'Данные существительного',
      verbInfo: 'Данные глагола',
      tenseOf: (tense: string) => `Формы: ${tense}`,
      adjectiveForms: 'Степени сравнения',
      collocationN: (n: number) => `Сочетание ${num(n)}`,
      somePart: 'Одна часть',
    },
    issue(issue: ValidationIssue): string {
      const where = describePath(issue.path)
      switch (issue.code) {
        case 'required':
          return `${where}: пусто.`
        case 'too_long':
          return `${where}: слишком длинно.`
        case 'too_many':
          return `${where}: больше, чем разрешено.`
        case 'wrong_script':
          return `${where}: не тем письмом (слово ${Lin()}, перевод ${Oin()}).`
        case 'missing_levels':
          return `${where}: неполно.`
        default:
          return `${where}: неверно.`
      }
    },
  },

  tags: {
    title: 'Группы',
    none: 'Пока ни в одной группе.',
    add: 'Добавить в группу',
    placeholder: 'напр. Урок 3 или Путешествие',
    newTag: 'Новая группа',
    existing: 'Существующие группы',
    remove: (name: string) => `Убрать из группы ${name}`,
    all: 'Все группы',
    help: 'Группы держат вместе слова одного урока или темы.',
  },

  import: {
    title: 'Импорт списка',
    intro: 'Напиши или вставь слова сюда: по одному в строке или через запятую.',
    scanTip: 'На iPhone: удерживай палец на поле и выбери «Сканировать текст», чтобы прочитать слова с бумаги.',
    get placeholder() {
      return learningInfo().examples.join('\n')
    },
    listLabel: 'Список слов',
    tagLabel: 'Группа для этого списка (необязательно)',
    check: 'Проверить список',
    nothing: 'В этом тексте слов не найдено.',
    tooMany: (max: number) => `За раз не больше ${num(max)} слов. Остальные импортируй в следующий раз.`,
    reviewTitle: (n: number) => `Создать: ${w(n)}`,
    statusNew: 'Будет создано',
    statusExists: 'Уже в банке',
    statusInvalid: 'Нельзя создать',
    removeItem: (word: string) => `Убрать ${word} из списка`,
    start: (n: number) => `Создать ${cards(n)}`,
    nothingToBuild: 'В списке нет новых слов.',
    editList: 'Исправить список',
    progress: (done: number, total: number) => `Готово ${num(done)} из ${num(total)}`,
    position: (i: number, total: number) => `Карточка ${num(i)} из ${num(total)}`,
    waiting: 'Следующая карточка создаётся…',
    confirm: 'Подтвердить и сохранить',
    skip: 'Пропустить',
    failed: (word: string, why: string) => `«${word}» не создано: ${why}`,
    retryFailed: 'Попробовать ещё',
    paused: 'Создание остановлено.',
    limitWait: 'Чтобы не тратить слишком много, немного подожду и продолжу…',
    doneTitle: 'Список готов',
    doneSummary: (saved: number, skipped: number, failed: number) =>
      [`Сохранено: ${num(saved)}`, skipped ? `пропущено: ${num(skipped)}` : '', failed ? `не создано: ${num(failed)}` : ''].filter(Boolean).join(', ') + '.',
    again: 'Импортировать другой список',
    toBank: 'К банку слов',
    leaveConfirm: 'Есть неподтверждённые карточки. Если выйдешь, они пропадут.',
    leave: 'Выйти',
    suggestion: (from: string, to: string) => `«${from}» я понял как «${to}».`,
  },

  words: {
    title: 'Банк слов',
    get search() {
      return `Поиск ${Lin()} или ${Oin()}`
    },
    count: (shown: number, total: number) => (shown === total ? w(total) : `${num(shown)} из ${w(total)}`),
    empty: 'Добавь первое слово 🌱',
    emptyBody: 'Каждое сохранённое слово остаётся здесь и по очереди попадает в ежедневное повторение.',
    noMatch: 'Таких слов не найдено.',
    clearFilters: 'Сбросить фильтры',
    filters: 'Фильтры и сортировка',
    all: 'Все',
    favorites: 'Избранные',
    difficult: 'Трудные',
    dueToday: 'На сегодня',
    sort: 'Сортировка',
    sortNewest: 'Новые',
    sortAlpha: 'По алфавиту',
    sortReviewed: 'Последнее повторение',
    sortDue: 'Ближайший срок',
    posGroup: 'Часть речи',
    cefrGroup: 'Уровень',
    tagGroup: 'Группа',
    statusGroup: 'Состояние',
    select: 'Выбрать',
    selected: (n: number) => `Выбрано: ${num(n)}`,
    archiveSelected: 'Удалить из банка',
    favoriteSelected: 'В избранное',
    archiveConfirm: (n: number) => `Удалить из банка слов: ${w(n)}? История повторений сохранится.`,
    showMore: 'Показать ещё',
  },

  detail: {
    notFound: 'Слово не найдено. Возможно, оно удалено.',
    meanings: 'Значение',
    translation: 'Перевод',
    literal: 'Дословный перевод',
    alternatives: 'Другие способы сказать',
    reply: 'Обычный ответ',
    grammar: 'Грамматика',
    conjugation: 'Спряжение',
    synonyms: 'Синонимы',
    antonyms: 'Антонимы',
    collocations: 'Частые сочетания',
    notes: 'Заметка',
    learning: 'Состояние изучения',
    status: 'Состояние',
    nextReview: 'Следующее повторение',
    lastReview: 'Последнее повторение',
    reviewCount: 'Число повторений',
    lapses: 'Сколько раз забыто',
    recall: 'Вероятность вспомнить сейчас',
    stability: 'Устойчивость в памяти',
    difficulty: 'Сложность',
    notStarted: 'Ещё не в повторении; в очереди новых слов.',
    get reverseCard() {
      return `Обратная карточка (${O()} → ${L()})`
    },
    reverseWaiting: 'Начнётся, когда выучишь само слово.',
    never: 'Ещё нет',
    difficultyWords: ['Очень легко', 'Легко', 'Средне', 'Трудно', 'Очень трудно'],
    regenerate: 'Создать заново с ИИ',
    regenerateConfirm: 'Данные слова будут созданы заново и показаны как черновик. Пока не сохранишь, ничего не изменится.',
    archive: 'Удалить из банка слов',
    archiveConfirm: 'Удалить это слово из банка и ежедневного повторения? История повторений сохранится.',
    archived: 'Удалено из банка слов',
    favoriteOn: 'Добавлено в избранное',
    favoriteOff: 'Убрано из избранного',
    addedOn: 'Добавлено',
    plural: 'Мн. число',
    genitive: 'Genitiv',
    pluralOnly: 'Только мн. число',
    noPlural: 'Нет мн. числа',
    auxiliary: 'Вспомогательный глагол',
    participle: 'Причастие (participle)',
    separable: 'Отделяемый',
    inseparable: 'Неотделяемый',
    irregular: 'Неправильный',
    regular: 'Правильный',
    reflexive: 'Возвратный',
    government: 'Употребляется с',
    traits: 'Признаки',
    overdue: (since: string) => `Срок наступил (${since})`,
    comparative: 'Сравнительная',
    superlative: 'Превосходная',
  },

  study: {
    title: 'Повторение',
    showAnswer: 'Показать ответ',
    recallPrompt: 'Вспомни значение, потом посмотри ответ.',
    get reversePrompt() {
      return `Вспомни слово ${Lin()} (существительные с артиклем).`
    },
    get reverseBadge() {
      return `${O()} → ${L()}`
    },
    undo: 'Отменить предыдущий ответ',
    undone: 'Предыдущий ответ отменён.',
    streak: (n: number) => `${num(n)} подряд!`,
    newBadge: 'Новое слово',
    ratings: { 1: 'Не вспомнил(а)', 2: 'С трудом', 3: 'Вспомнил(а)', 4: 'Очень легко' },
    ratingHelp: {
      1: 'Вернётся очень скоро',
      2: 'Вспомнил(а), но с трудом; вернётся чуть раньше',
      3: 'Вернётся вовремя',
      4: 'Вернётся позже',
    },
    ratingGuide: 'Как отвечать?',
    nextQuiz: 'Тест',
    nextStory: 'История',
    undoLast: 'Отменить последний ответ',
    fullDetail: 'Все детали слова',
    remaining: (n: number) => `Осталось: ${cards(n)}`,
    exit: 'Выйти из повторения',
    emptyTitle: 'Сегодня нечего повторять. Отлично! 🎉',
    emptyBody: 'Новые слова, которые ты добавишь, будут появляться здесь по очереди.',
    emptyNoWords: 'У тебя пока нет слов для повторения.',
    waitTitle: 'Передохни',
    waitBody: (n: number, when: string) => `Карточки в процессе (${num(n)}) вернутся ${when}.`,
    waitNow: 'Повторить сейчас',
    doneTitle: 'Круг завершён',
    doneCards: 'карточек просмотрено',
    doneCorrect: 'верных воспоминаний',
    doneTime: 'время',
    doneNew: 'новых слов',
    doneDuration: (ms: number) => (ms < 60_000 ? `${num(Math.max(1, Math.round(ms / 1000)))} с` : `${num(Math.round(ms / 60_000))} мин`),
    doneHome: 'На главную',
    doneGoal: 'И цель на день тоже выполнена.',
    encourage: 'Ничего страшного, попробуем ещё.',
    proud: 'Это было трудно, а ты вспомнил(а)!',
    saveFailed: 'Ответ сохранён на этом устройстве и будет отправлен, когда появится интернет.',
  },

  quiz: {
    title: 'Тест',
    intro: 'Тест составляется из твоих слов. Это лишь тренировка; ежедневный план повторений не изменится.',
    kinds: {
      mixed: { title: 'Смешанный', body: 'Все типы вместе' },
      choice: { title: 'Выбор ответа', body: 'Выбери правильное значение' },
      typing: {
        title: 'Письмо',
        get body() {
          return `Напиши слово ${Lin()} сам(а)`
        },
      },
      article: {
        get title() {
          return learningInfo().articles.join(' / ') || 'Артикли'
        },
        body: 'Артикли существительных',
      },
      listening: { title: 'Аудирование', body: 'Слушай и пиши (диктант)' },
      speaking: { title: 'Произношение', body: 'Скажи вслух и проверь произношение' },
    },
    get needSound() {
      return `На этом устройстве нет голоса (${L()}).`
    },
    listen: 'Слушать',
    listenSlow: 'Медленнее',
    get dictationHelp() {
      return `Пиши ${Lin()} всё, что слышишь. Существительные — с артиклем.`
    },
    speakNow: 'Нажми и говори',
    listening: 'Слушаю…',
    heard: (text: string) => `Я услышал: «${text}»`,
    heardNothing: 'Ничего не услышал. Попробуй ещё, чуть громче.',
    micDenied: 'Доступ к микрофону не дан. Можешь оценить сам(а).',
    selfCheckHelp: 'Сначала послушай правильное произношение, повтори вслух, потом скажи, получилось ли.',
    selfYes: 'Сказал(а) правильно',
    selfNo: 'Пока нет',
    speakingHelp: 'Нажми на микрофон и скажи вслух. Я послушаю и скажу, правильно ли.',
    length: 'Число вопросов',
    questions: (n: number) => pl(n, ...QUESTION),
    start: 'Начать тест',
    needWords: 'Сначала добавь несколько слов.',
    needFour: 'Для выбора ответа нужно не меньше четырёх слов с разными значениями.',
    needNouns: 'Для этого упражнения в банке слов должны быть существительные.',
    prompts: {
      choice_de_fa: 'Что значит это слово?',
      get choice_fa_de() {
        return `Как это ${Lin()}?`
      },
      get typing_fa_de() {
        return `Напиши ${Lin()}`
      },
      article: 'Какой артикль?',
      dictation: 'Слушай и пиши',
      speaking: 'Скажи вслух',
    },
    get typePlaceholder() {
      return `Пиши ${Lin()}`
    },
    typeHelp: 'Для существительных можно писать и артикль.',
    check: 'Проверить',
    dontKnow: 'Не знаю',
    next: 'Дальше',
    finish: 'Посмотреть результат',
    position: (i: number, total: number) => `Вопрос ${num(i)} из ${num(total)}`,
    correct: 'Верно!',
    wrong: 'Неверно.',
    answerIs: 'Правильный ответ:',
    notes: {
      case: 'Верно; только обрати внимание на заглавные и строчные буквы.',
      spelling: 'Верно; посмотри точное написание.',
      wrong_article: 'Слово верное, а артикль — нет.',
    },
    exit: 'Выйти из теста',
    exitConfirm: 'Тест не закончен. Если выйдешь, ответы до этого момента сохранятся.',
    resultTitle: 'Результат теста',
    score: (correct: number, total: number) => `${num(correct)} из ${num(total)}`,
    resultGreat: 'Отлично! Эти слова ты знаешь хорошо.',
    resultGood: 'Хорошо. Несколько слов ещё требуют практики.',
    resultKeepGoing: 'Ничего; знать, какие слова трудные, — уже шаг вперёд.',
    missed: 'Посмотри эти ещё раз',
    correctLabel: 'Верные ответы',
    accuracyLabel: 'Точность',
    again: 'Ещё один тест',
    studyHint: 'Слова с ошибками чаще попадаются в следующих тестах.',
  },

  stats: {
    title: 'Статистика',
    empty: 'Статистики пока нет. Добавь несколько слов и начни повторять.',
    insightStart: 'Каждое повторение появится здесь.',
    insightStreak: (n: number) => `Ты повторяешь уже ${days(n)} подряд. Так держать!`,
    insightRetention: (p: string) => `При повторении ты вспомнил(а) ${p} слов.`,
    insightMastered: (n: number) => `Закреплено в памяти: ${w(n)}.`,
    words: 'Слова',
    wordsTotal: (n: number) => `${w(n)} в банке`,
    periodTitle: 'Повторение',
    today: 'Сегодня',
    week: '7 дней',
    month: '30 дней',
    reviews: 'повторений',
    minutes: 'минут',
    newWords: 'новых слов',
    activeDays: 'активных дней',
    retention: 'Запоминание',
    retentionHelp: 'Запоминание — какую долю уже выученных слов ты вспомнил(а) при повторении.',
    streakNow: 'дней подряд',
    streakBest: 'рекорд',
    activity: 'Повторения за 30 дней',
    activityNone: 'За эти 30 дней повторений не было.',
    forecast: 'Повторения на 14 дней вперёд',
    forecastToday: 'Сегодня',
    forecastHelp: 'Сколько карточек наступит в каждый день, если не добавлять новых слов.',
    forecastNone: 'В ближайшие две недели карточек нет.',
    levels: 'Уровни слов',
    noLevel: 'Без уровня',
    difficult: 'Трудные слова',
    difficultNone: 'Нет слов, которые постоянно забываются.',
    lapses: (n: number) => `забыто ${num(n)} раз`,
    quiz: 'Тесты (90 дней)',
    quizAnswersLabel: 'ответов в тестах',
    quizNone: 'Ты ещё не проходил(а) тестов.',
    perDay: (key: string, n: number) => `${key}: ${pl(n, ...REVIEW)}`,
    weekTitle: 'Прошлая неделя',
    weekNone: 'На этой неделе ты ещё не повторял(а). Начни с нескольких карточек.',
    saidReviews: (minutes: number) => `карточек повторено за ${num(minutes)} мин`,
    saidNew: 'новых слов выучено',
    saidRetention: 'прежних слов вспомнено верно',
    saidDays: 'дней учёбы из семи',
    journey: 'Путь слов',
    journeyHelp: 'Каждое слово начинает как «новое» и с каждым верным повторением продвигается на шаг, пока не станет «закреплённым» — тогда ты его вряд ли забудешь.',
    calendar: 'Последние пять недель',
    streakLine: (now: number, best: number) => `${days(now)} подряд, рекорд ${num(best)}`,
    less: 'Меньше',
    more: 'Больше',
  },

  settings: {
    title: 'Настройки',
    account: 'Аккаунт',
    displayName: 'Имя',
    email: 'Эл. почта',
    signOut: 'Выйти из аккаунта',
    signOutConfirm: 'Ты выйдешь из аккаунта, а данные на этом устройстве будут стёрты. На сервере они останутся.',
    signOutPending: (n: number) => `Ещё не отправлено на сервер: ${pl(n, ...CHANGE)}. При выходе они пропадут. Сначала подключись к интернету.`,
    learning: 'Обучение',
    newPerDay: 'Новых слов в день',
    newPerDayHelp: 'Каждое новое слово повторяется несколько раз в следующие дни.',
    newPerDayWarn: 'Большое число — гораздо больше ежедневных повторений в следующие недели.',
    newPerDayZero: 'С нулём повторяются только прежние слова.',
    dailyGoal: 'Цель на день',
    dailyGoalHelp: 'Цель по времени не зависит от числа новых слов.',
    minutes: (n: number) => `${num(n)} мин`,
    advanced: 'Расширенные настройки обучения',
    reviewLimit: 'Дневной лимит повторений',
    reviewLimitAuto: 'Автоматически (без лимита)',
    reviewLimitCustom: 'Фиксированный лимит',
    reviewLimitHelp: 'В автоматическом режиме показываются все карточки, у которых наступил срок. Лимит переносит остальные на следующие дни.',
    retention: 'Целевая точность',
    retentionHelp: 'Какую долю слов ты хочешь вспоминать при повторении. Больше число — больше повторений.',
    learningSteps: 'Шаги изучения нового слова: 1 минута и 10 минут. Шаг переучивания: 10 минут.',
    get reverseCards() {
      return `Обратные карточки (${O()} → ${L()})`
    },
    get reverseCardsHelp() {
      return `Для каждого слова создаётся вторая карточка: она показывает значение ${Oin()} и спрашивает слово ${Lin()}. Она появляется через несколько дней после изучения слова и добавляет повторений.`
    },
    audio: 'Звук',
    speechRate: 'Скорость произношения',
    speechSlow: 'Медленно',
    speechNormal: 'Обычно',
    autoplay: 'Автоматически проигрывать произношение на карточке',
    audioTest: 'Проверить звук',
    aiVoice: 'Естественный голос (ИИ)',
    aiVoiceHelp: 'С интернетом слова и предложения читает естественный голос. Каждый текст создаётся один раз и сохраняется. Без интернета звучит голос телефона.',
    voiceFemale: 'Женский голос',
    voiceMale: 'Мужской голос',
    get audioUnavailable() {
      return `В этом браузере нет голоса (${L()}).`
    },
    appearance: 'Внешний вид',
    themes: { system: 'Как на устройстве', light: 'Светлая', dark: 'Тёмная' },
    data: 'Данные и синхронизация',
    syncNow: 'Синхронизировать',
    syncing: 'Синхронизация…',
    synced: (when: string) => `Последняя синхронизация: ${when}`,
    neverSynced: 'Ещё не синхронизировано',
    pending: (n: number) => `Ждут отправки: ${pl(n, ...CHANGE)}`,
    export: 'Скачать файл данных',
    exportHelp: 'Все слова, карточки и история повторений в одном файле JSON.',
    exportFailed: 'Файл не создан. Проверь интернет.',
    privacy: 'Конфиденциальность',
    privacyBody:
      'Твои слова и историю повторений видишь только ты. Каждое созданное слово отправляется на анализ в OpenAI; твоя почта и имя не отправляются. Готовый анализ слова общий для всех пользователей, но твои правки — нет.',
    deleteAccount: 'Полностью удалить аккаунт',
    deleteHelp: 'Аккаунт, все слова и история повторений будут удалены навсегда без возможности восстановления.',
    deleteConfirmLabel: 'Для подтверждения введи свою почту',
    deleteConfirmButton: 'Удалить мой аккаунт навсегда',
    deleted: 'Аккаунт удалён.',
    about: 'О Hodhod',
    version: 'Версия',
    scheduler: 'Алгоритм повторений',
    aboutBody: 'Расписание повторений составляет FSRS (открытая реализация ts-fsrs). Персидский шрифт: Vazirmatn.',
    saved: 'Сохранено',
  },

  sync: {
    offlineBanner: 'Ты офлайн. Повторение работает и сохранится, когда появится интернет.',
    firstLoad: 'Загружаю твои слова…',
    firstLoadFailed: 'Не удалось загрузить твои данные.',
  },

  pos: {
    noun: 'Существительное',
    verb: 'Глагол',
    adjective: 'Прилагательное',
    adverb: 'Наречие',
    preposition: 'Предлог',
    conjunction: 'Союз',
    pronoun: 'Местоимение',
    article: 'Артикль',
    numeral: 'Числительное',
    interjection: 'Междометие',
    particle: 'Частица',
    phrase: 'Выражение',
    sentence: 'Предложение',
    other: 'Другое',
  },

  register: {
    neutral: 'Нейтральный',
    informal: 'Разговорный',
    formal: 'Официальный',
    slang: 'Сленг',
    vulgar: 'Грубый',
  },

  frequency: { 1: 'Редкое', 2: 'Частое', 3: 'Очень частое' },

  status: {
    new: 'Новое',
    learning: 'Изучается',
    review: 'Повторяется',
    mastered: 'Закреплено',
  },

  levels: { easy: 'Простой', medium: 'Средний', hard: 'Продвинутый' },

  cefr: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'],

  store: {
    title: 'Наборы слов',
    intro: 'Готовые бесплатные наборы. В каждом несколько коротких уроков; как только начнёшь урок, его слова добавятся в ежедневное повторение.',
    tile: 'Наборы слов',
    tileHint: 'Готовые слова и предложения',
    mine: 'Мои наборы',
    all: 'Все',
    kinds: { words: 'Слова', sentences: 'Предложения', expressions: 'Выражения', mixed: 'Смешанные' },
    levels: { basic: 'Базовый', advanced: 'Продвинутый' },
    size: (items: number, lessons: number) => `${pl(items, ...ITEM)}, ${pl(lessons, ...LESSON)}`,
    learning: 'Изучается',
    empty: 'Наборов пока нет. Скоро!',
    emptyFilter: 'В этой категории наборов нет.',
    unavailable: 'Магазин ещё не запущен на сервере.',
    notFound: 'Набор не найден.',
    progress: (learned: number, total: number) => `Выучено ${num(learned)} из ${num(total)}`,
    lesson: (n: number) => `Урок ${num(n)}`,
    lessonDone: 'Завершён',
    lessonActive: 'Изучается',
    lessonOpen: 'Готов к началу',
    lessonLocked: 'Закрыт',
    lessonWords: (n: number) => pl(n, ...ITEM),
    lessonProgress: (done: number, total: number) => `Выучено ${num(done)} из ${num(total)}`,
    continueLesson: (n: number) => `Продолжить урок ${num(n)}`,
    continueHint: 'Слова этого урока появляются и в ежедневном повторении.',
    lockedHint: 'Урок откроется, когда ты хотя бы раз правильно ответишь на все слова предыдущего урока.',
    start: (n: number) => `Начать урок ${num(n)}`,
    starting: 'Добавляю…',
    started: (n: number) => `В банк слов добавлено: ${pl(n, ...ITEM)}`,
    startedNone: 'Все элементы этого урока уже были в банке слов.',
    studyPack: 'Повторить этот набор',
    studyPackHint: 'Только карточки этого набора; расписание то же, что у ежедневного повторения.',
    nothingToStudy: 'Сейчас из этого набора нечего повторять.',
    preview: 'Посмотреть элементы',
    packOnly: (title: string) => `Только набор «${title}»`,
  },

  report: {
    button: 'Сообщить об ошибке в карточке',
    title: 'Что не так?',
    reasons: { meaning: 'Значение', example: 'Примеры', grammar: 'Грамматика', audio: 'Произношение', other: 'Другое' },
    message: 'Пояснение (необязательно)',
    messagePlaceholder: 'напр.: второе значение неверное, должно быть «…».',
    send: 'Отправить',
    sent: 'Спасибо! Сообщение получено, мы его проверим.',
  },

  feedback: {
    button: 'Сообщить о проблеме или идее',
    hint: 'Напиши, что сломалось или что хотелось бы добавить.',
    title: 'Расскажи нам',
    kinds: { bug: 'Проблема', idea: 'Идея', other: 'Другое' },
    placeholder: 'Что случилось? Или что хочешь добавить?',
    send: 'Отправить',
    sent: 'Спасибо! Сообщение получено.',
    empty: 'Сначала напиши несколько слов.',
  },

  friends: {
    title: 'С друзьями',
    tile: 'С друзьями',
    tileHint: 'Таблица недели',
    myCode: 'Мой код дружбы',
    share: 'Отправить код',
    shareText: (code: string, url: string) => `Давай учить ${L()} вместе! Введи мой код дружбы в Hodhod: ${code}\n${url}`,
    copied: 'Код скопирован',
    addTitle: 'Добавить друга',
    addLabel: 'Код дружбы',
    add: 'Добавить',
    badCode: 'Код дружбы — 8 букв и цифр, напр. ABCD2345.',
    privacy: 'Друзья видят только твоё имя, серию, число ответов за неделю и число выученных слов, но не сами слова.',
    results: {
      sent: 'Запрос отправлен. Когда друг примет, он появится здесь.',
      accepted: 'Теперь вы друзья!',
      not_found: 'Никого с таким кодом не найдено.',
      self: 'Это твой собственный код 🙂',
      exists: 'Вы уже друзья или запрос уже отправлен.',
      too_many: 'Слишком много запросов без ответа; подожди немного.',
    },
    incoming: 'Запросы в друзья',
    accept: 'Принять',
    decline: 'Нет',
    board: 'Таблица этой недели',
    thisWeek: 'С понедельника',
    alone: 'Ты ещё не добавил(а) друзей. Отправь свой код, чтобы учиться вместе.',
    me: 'Ты',
    noName: 'Без имени',
    learned: (n: number) => `Выучено: ${w(n)}`,
    answers: 'ответов за неделю',
    days: 'дней подряд',
    streak: 'Серия',
    rank: (n: number) => `${num(n)}-е место`,
    waiting: (names: string) => `Ждём ответа: ${names}`,
    remove: 'Удалить друга',
    removeConfirm: (name: string) => `Удалить ${name} из друзей?`,
    unavailable: 'Раздел друзей ещё не запущен на сервере.',
  },

  stories: {
    title: 'Короткая история',
    tile: 'История',
    tileHint: 'С твоими словами',
    intro: 'Я напишу короткую историю со словами, которые ты учишь, с переводом каждого предложения.',
    needWords: (n: number) => `Для истории нужно не меньше ${num(n)} слов, которые ты уже начал(а) повторять. Сначала повтори несколько карточек.`,
    level: 'Уровень',
    write: 'Написать историю',
    writing: 'Пишу… (до полминуты)',
    limitHelp: 'Не больше 3 историй в день.',
    limit: 'Истории на сегодня закончились. Заходи завтра.',
    unavailable: 'Истории ещё не запущены на сервере.',
    mine: 'Мои истории',
    unread: 'Новая',
    notFound: 'История не найдена.',
    playAll: 'Воспроизвести всё',
    showAll: 'Показать все переводы',
    hideAll: 'Скрыть переводы',
    tapHelp: 'Нажми на предложение, чтобы увидеть перевод. Твои слова выделены цветом.',
    yourWords: (n: number) => `Твоих слов в этой истории: ${num(n)}`,
    another: 'Ещё одна история',
  },

  deck: {
    title: 'Из Anki или Quizlet',
    entry: 'Импорт из Anki или Quizlet',
    get intro() {
      return `Выбери текстовый файл своих карточек из Anki или Quizlet. Каждая строка — карточка: слово ${Lin()} и значение ${Oin()} (порядок не важен).`
    },
    pickFile: 'Выбрать файл',
    get placeholder() {
      const [noun, phrase] = learningInfo().examples
      return `${noun}\t…\n${phrase}\t…`
    },
    howTitle: 'Как получить файл?',
    get how() {
      return [
        'Anki: колода → Export → «Notes in Plain Text (.txt)».',
        'Quizlet: модуль → ⋯ → Export → скопируй текст и вставь внизу этой страницы.',
        `Подойдёт и любой текстовый файл, где в каждой строке слово ${Lin()} и его значение ${Oin()}, разделённые табуляцией или запятой.`,
      ]
    },
    paste: 'Или вставь текст сюда',
    read: 'Прочитать текст',
    found: (n: number) => `Найдено: ${cards(n)}`,
    countNew: ' новых карточек',
    countExisting: ' уже в банке слов',
    countSkipped: ' строк не прочитано',
    andMore: (n: number) => `и ещё ${cards(n)}`,
    nothingNew: 'В этом файле новых карточек нет.',
    importQuick: (n: number) => `Импортировать ${cards(n)}`,
    importing: (done: number, total: number) => `${num(done)} из ${num(total)}…`,
    quickHelp: 'Как есть, без ИИ: быстро и бесплатно. Потом на любой карточке можно нажать «Создать заново с ИИ», чтобы получить примеры и спряжение.',
    withAi: (n: number) => `Создать полные карточки с ИИ (${num(n)})`,
    aiHelp: (max: number) => `С примерами, произношением и грамматикой; за раз не больше ${num(max)} карточек, и каждую ты подтверждаешь сам(а).`,
    imported: (n: number) => `В банк слов добавлено: ${cards(n)}`,
    other: 'Другой файл',
    export: 'Экспорт для Anki',
    exportHelp: 'Экспорт для Anki — текстовый файл, который открывается в Anki через «Import File».',
  },

  reminders: {
    title: 'Напоминания',
    offBody: 'Могу присылать уведомление на телефон, когда пора повторять или когда серия под угрозой. Не больше двух сообщений в день.',
    turnOn: 'Включить напоминания',
    turnOff: 'Выключить на этом устройстве',
    enabled: 'Напоминания включены',
    denied: 'Разрешение на уведомления не дано.',
    deniedHelp: 'Уведомления Hodhod заблокированы. Разреши их снова в настройках телефона или браузера.',
    unsupported: 'Этот браузер не поддерживает уведомления.',
    needsInstall: 'На iPhone уведомления работают только в установленном Hodhod: в Safari нажми «Поделиться» → «На экран Домой», затем открой Hodhod с экрана Домой и вернись сюда.',
    daily: 'Ежедневное напоминание',
    dailyTime: 'Время напоминания',
    dailyHelp: 'Приходит, только если ты ещё не повторял(а) в этот день и есть карточки.',
    streak: 'Предупреждение о серии (в 20:30)',
    updates: 'Новости Hodhod (новые наборы, новая версия)',
    limitHelp: 'Не больше двух напоминаний в день.',
    test: 'Отправить тестовое уведомление',
    testSent: 'Отправлено; подожди несколько секунд.',
    testNone: 'Уведомление не отправлено. Выключи и снова включи напоминания.',
  },

  staging: 'Тестовая версия',

  update: {
    title: 'Вышла новая версия Hodhod!',
    body: 'Обнови один раз, чтобы увидеть изменения.',
    reload: 'Обновить',
  },

  news: {
    title: 'Новость',
    dismiss: 'Понятно',
  },

  errors: {
    offline: 'Нет подключения к интернету.',
    timeout: 'Это заняло слишком много времени, ответа нет.',
    auth: 'Нужно войти снова.',
    duplicate: 'Это слово уже есть в твоём банке слов.',
    conflict: 'Это изменили в другом месте.',
    rate_limit: 'Слишком много запросов. Попробуй чуть позже.',
    rate_limit_day: 'Дневной лимит создания слов исчерпан. Попробуй завтра.',
    validation: 'Ввод не принят.',
    not_configured: 'Сервис ИИ ещё не настроен.',
    ai_quota: 'Кредит аккаунта ИИ закончился.',
    not_found: 'Не найдено.',
    server: 'Сервер ответил некорректно. Попробуй чуть позже.',
    ai_invalid: 'Ответ ИИ непригоден. Попробуй ещё.',
  },
}
