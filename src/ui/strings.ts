/**
 * Every user-visible text of the interface, in one place.
 * Adding another interface language means adding another object of this shape.
 */
import type { InputErrorCode } from '../../supabase/functions/_shared/inputRules.ts'
import type { Cefr, ExampleLevel, PartOfSpeech, ValidationIssue } from '../../supabase/functions/_shared/wordSchema.ts'
import type { WordStatus } from '../core/cards.ts'
import type { GradeNote, QuestionType, QuizKind } from '../core/quiz.ts'
import type { Rating } from '../core/types.ts'
import type { AppError } from '../data/errors.ts'
import { fa } from './format.ts'

export const APP_NAME = 'هدهد'

export const t = {
  nav: { home: 'خانه', create: 'کلمهٔ تازه', words: 'واژه‌ها', study: 'مرور', quiz: 'آزمون', settings: 'تنظیمات', stats: 'آمار' },

  common: {
    cancel: 'انصراف',
    retry: 'دوباره امتحان کن',
    save: 'ذخیره',
    edit: 'ویرایش',
    delete: 'حذف',
    close: 'بستن',
    back: 'برگشت',
    yes: 'بله',
    no: 'نه',
    add: 'افزودن',
    remove: 'برداشتن',
    loading: 'در حال بارگذاری…',
    offline: 'آفلاین هستی',
    play: 'پخش تلفظ',
    optional: 'اختیاری',
  },

  auth: {
    tagline: 'واژه‌های آلمانی، هر روز کمی بیشتر',
    signIn: 'ورود',
    signUp: 'ساخت حساب',
    name: 'نام',
    namePlaceholder: 'اسمت را چطور صدا بزنیم؟',
    email: 'ایمیل',
    password: 'رمز عبور',
    passwordHint: 'دست‌کم ۸ نویسه',
    submitSignIn: 'وارد شو',
    submitSignUp: 'حساب بساز',
    forgot: 'رمزم را فراموش کرده‌ام',
    resetSent: 'اگر این ایمیل ثبت شده باشد، پیوند تغییر رمز برایش فرستاده شد.',
    resetNeedsEmail: 'اول ایمیلت را بنویس، بعد دوباره همین‌جا بزن.',
    confirmSent: 'یک ایمیل تأیید برایت فرستادیم. روی پیوند داخلش بزن تا حسابت فعال شود.',
    newPasswordTitle: 'رمز تازه',
    newPasswordSubmit: 'رمز را عوض کن',
    passwordChanged: 'رمزت عوض شد.',
    errors: {
      invalid_credentials: 'ایمیل یا رمز درست نیست.',
      invalid_grant: 'ایمیل یا رمز درست نیست.',
      email_not_confirmed: 'هنوز ایمیلت را تأیید نکرده‌ای. روی پیوند داخل ایمیل تأیید بزن.',
      user_already_exists: 'با این ایمیل قبلاً حساب ساخته شده. از «ورود» استفاده کن.',
      email_exists: 'با این ایمیل قبلاً حساب ساخته شده. از «ورود» استفاده کن.',
      weak_password: 'این رمز کوتاه یا ساده است. یک رمز بلندتر انتخاب کن.',
      signup_disabled: 'ساخت حساب تازه فعلاً بسته است.',
      otp_expired: 'این پیوند منقضی شده. یک پیوند تازه بگیر.',
      same_password: 'رمز تازه باید با رمز قبلی فرق داشته باشد.',
      email_invalid: 'این ایمیل درست به نظر نمی‌رسد.',
      password_short: 'رمز باید دست‌کم ۸ نویسه باشد.',
      fallback: 'ورود انجام نشد. دوباره امتحان کن.',
    } as Record<string, string>,
  },

  setup: {
    title: 'اپ هنوز به سرور وصل نشده',
    body: 'نشانی و کلید عمومی Supabase در فایل config.js تنظیم نشده است.',
    backendMissing: 'پایگاه داده هنوز آماده نشده. جدول‌های اپ در Supabase ساخته نشده‌اند.',
  },

  home: {
    greeting(hour: number, name: string | null) {
      const part = hour < 4 ? 'شب بخیر' : hour < 11 ? 'صبح بخیر' : hour < 16 ? 'روز بخیر' : hour < 20 ? 'عصر بخیر' : 'شب بخیر'
      return name ? `${part}، ${name}` : part
    },
    today: 'برنامهٔ امروز',
    newCards: 'تازه',
    reviews: 'مرور',
    learning: 'در جریان',
    minutesLabel: 'دقیقه',
    startReview: 'ادامهٔ مرور',
    startNew: 'یادگیری کلمه‌های تازه',
    startMixed: 'شروع یادگیری',
    addFirst: 'اولین کلمه‌ات را اضافه کن',
    addWord: 'افزودن کلمه',
    allDone: 'کار امروز تمام شد',
    allDoneBody: 'همهٔ کارت‌های امروز را دیدی. فردا دوباره سر می‌زنیم.',
    waitingLater: (when: string) => `کارت بعدی ${when} برمی‌گردد.`,
    nothingDue: 'امروز کارتی برای مرور نداری.',
    newWaiting: (n: number) => `${fa(n)} کلمهٔ ذخیره‌شده در صف روزهای بعد است.`,
    goal: 'هدف روزانه',
    goalProgress: (done: number, goal: number) => `${fa(done)} از ${fa(goal)} دقیقه`,
    goalDone: 'هدف امروز کامل شد',
    streak: (n: number) => `${fa(n)} روز پیاپی`,
    streakNone: 'امروز را شروع کن',
    streakKeep: 'امروز هنوز مرور نکرده‌ای',
    statsHint: 'پیشرفت و لغت‌های سخت',
    bank: 'بانک واژه',
    bankCount: (n: number) => `${fa(n)} کلمه`,
    week: 'هفت روز گذشته',
    weekReviews: (n: number) => `${fa(n)} مرور`,
    mascot: {
      first: 'سلام! من هدهدم. یک کلمهٔ آلمانی بده تا با هم شروع کنیم.',
      due: 'کارت‌های امروز آماده‌اند. هر وقت تو آماده بودی.',
      goalDone: 'هدف امروزت را زدی. آفرین!',
      allDone: 'برای امروز کافی است. خسته نباشی!',
      back: 'خوش برگشتی. از همین‌جا ادامه می‌دهیم.',
      idle: 'کلمهٔ تازه‌ای شنیده‌ای؟ اضافه‌اش کن.',
    },
  },

  create: {
    title: 'کلمهٔ تازه',
    label: 'کلمه یا عبارت آلمانی',
    placeholder: 'مثلاً aufgeben',
    help: 'یک کلمه یا یک عبارت کوتاه بنویس، مثل der Tisch یا Bescheid sagen.',
    importLink: 'وارد کردن گروهی از روی لیست',
    submit: 'ساخت کارت',
    loading: 'دارم اطلاعات این کلمه رو آماده می‌کنم…',
    loadingHint: 'معمولاً ۱۰ تا ۲۰ ثانیه طول می‌کشد.',
    failed: 'فعلاً نتونستم این کلمه رو آماده کنم.',
    notAWord: (w: string) => `«${w}» را به‌عنوان یک کلمه یا عبارت آلمانی نشناختم. املایش را نگاه کن.`,
    wrongLanguage: (w: string) => `«${w}» آلمانی نیست. فعلاً فقط کلمهٔ آلمانی می‌سازم.`,
    didYouMean: 'منظورت این بود؟',
    useSuggestion: 'بله، همین',
    duplicateTitle: 'این کلمه در بانک واژه‌ات هست',
    duplicateOpen: 'باز کردن کلمه',
    duplicateRegenerate: 'ساخت دوبارهٔ اطلاعات',
    inputErrors: {
      empty: 'یک کلمه بنویس.',
      too_long: 'این خیلی بلند است. یک کلمه یا عبارت کوتاه بنویس.',
      multiple_words: 'این یک جمله است. یک کلمه یا عبارت کوتاه (تا پنج کلمه) بنویس.',
      wrong_script: 'کلمه را به آلمانی بنویس، نه فارسی.',
      invalid_characters: 'فقط حروف آلمانی بنویس؛ عدد و علامت نه.',
    } satisfies Record<InputErrorCode, string>,
  },

  draft: {
    banner: 'پیش‌نویس است و هنوز ذخیره نشده. نگاهش کن، اگر لازم بود ویرایش کن و بعد ذخیره کن.',
    inputNote: 'دربارهٔ چیزی که نوشتی',
    confirm: 'تأیید و ذخیره',
    saveChanges: 'ذخیرهٔ تغییرها',
    discard: 'دور بریز',
    discardConfirm: 'این پیش‌نویس ذخیره نشده. دور ریخته شود؟',
    saved: 'در بانک واژه ذخیره شد',
    updated: 'تغییرها ذخیره شد',
    fromCache: 'از حافظهٔ مشترک',
    hasProblems: 'چند جا باید درست شود:',
    conflict: 'این کلمه روی دستگاه دیگری تغییر کرده بود. نسخهٔ تازه‌تر بارگذاری شد؛ تغییرهایت را دوباره وارد کن.',
    aiCefrNote: 'سطح را هوش مصنوعی تخمین زده و ممکن است دقیق نباشد.',
    derivedTenses: 'Perfekt، Plusquamperfekt و Futur از روی فعل کمکی و Partizip II ساخته می‌شوند.',
    fields: {
      word: 'کلمه',
      pos: 'نوع کلمه',
      cefr: 'سطح',
      ipa: 'تلفظ (IPA)',
      meaning: (n: number) => `معنی ${fa(n)}`,
      translation: 'ترجمهٔ فارسی',
      meaningNote: 'توضیح کوتاه',
      examples: 'مثال‌ها',
      exampleDe: 'جملهٔ آلمانی',
      exampleFa: 'ترجمهٔ جمله',
      addMeaning: 'افزودن معنی',
      addExample: 'افزودن مثال',
      article: 'حرف تعریف',
      plural: 'جمع',
      genitive: 'حالت Genitiv',
      pluralOnly: 'فقط به شکل جمع به کار می‌رود',
      auxiliary: 'فعل کمکی',
      partizip2: 'Partizip II',
      separable: 'جداشدنی',
      irregular: 'بی‌قاعده',
      reflexive: 'انعکاسی',
      reflexiveNone: 'نیست',
      reflexiveAcc: 'با Akkusativ (mich)',
      reflexiveDat: 'با Dativ (mir)',
      government: 'حرف اضافه و حالت',
      comparative: 'صفت برتر',
      superlative: 'صفت برترین',
      synonyms: 'مترادف‌ها',
      antonyms: 'متضادها',
      listHint: 'با ویرگول جدا کن',
      collocations: 'ترکیب‌های رایج',
      addCollocation: 'افزودن ترکیب',
      notes: 'نکته',
      favorite: 'علاقه‌مندی',
      tags: 'دسته‌ها',
    },
    issue(issue: ValidationIssue): string {
      const where = describePath(issue.path)
      switch (issue.code) {
        case 'required':
          return `${where} خالی است.`
        case 'too_long':
          return `${where} خیلی بلند است.`
        case 'too_many':
          return `${where} بیش از حد مجاز است.`
        case 'wrong_script':
          return `${where} به خط درست نوشته نشده (آلمانی با حروف لاتین، ترجمه با حروف فارسی).`
        case 'missing_levels':
          return `${where} کامل نیست.`
        default:
          return `${where} درست نیست.`
      }
    },
  },

  tags: {
    title: 'دسته‌ها',
    none: 'هنوز در دسته‌ای نیست.',
    add: 'افزودن به دسته',
    placeholder: 'مثلاً درس ۳ یا سفر',
    newTag: 'دستهٔ تازه',
    existing: 'دسته‌های موجود',
    remove: (name: string) => `برداشتن از دستهٔ ${name}`,
    all: 'همهٔ دسته‌ها',
    help: 'با دسته‌ها می‌توانی لغت‌های یک درس یا یک موضوع را کنار هم نگه داری.',
  },

  import: {
    title: 'وارد کردن گروهی',
    intro: 'لغت‌ها را اینجا بنویس یا بچسبان؛ هر لغت در یک خط، یا با ویرگول از هم جدا.',
    scanTip: 'روی آیفون: انگشتت را روی کادر نگه دار و «Scan Text» را بزن تا لغت‌ها را از روی کاغذ بخواند.',
    placeholder: 'der Tisch\naufgeben\nBescheid sagen',
    listLabel: 'لیست لغت‌ها',
    tagLabel: 'دسته برای این لیست (اختیاری)',
    check: 'بررسی لیست',
    nothing: 'لغتی در این متن پیدا نکردم.',
    tooMany: (max: number) => `هر بار حداکثر ${fa(max)} لغت. بقیه را در دور بعد وارد کن.`,
    reviewTitle: (n: number) => `${fa(n)} لغت برای ساختن`,
    statusNew: 'ساخته می‌شود',
    statusExists: 'از قبل در بانک هست',
    statusInvalid: 'قابل ساخت نیست',
    removeItem: (w: string) => `برداشتن ${w} از لیست`,
    start: (n: number) => `ساخت ${fa(n)} کارت`,
    nothingToBuild: 'لغت تازه‌ای برای ساختن در لیست نیست.',
    editList: 'اصلاح لیست',
    progress: (done: number, total: number) => `${fa(done)} از ${fa(total)} کارت آماده شد`,
    position: (i: number, total: number) => `کارت ${fa(i)} از ${fa(total)}`,
    waiting: 'کارت بعدی در حال ساخته شدن است…',
    confirm: 'تأیید و ذخیره',
    skip: 'رد کن',
    failed: (w: string, why: string) => `«${w}» ساخته نشد: ${why}`,
    retryFailed: 'دوباره تلاش کن',
    paused: 'ساختن متوقف شد.',
    limitWait: 'برای جلوگیری از مصرف زیاد، چند لحظه صبر می‌کنم و ادامه می‌دهم…',
    doneTitle: 'لیست تمام شد',
    doneSummary: (saved: number, skipped: number, failed: number) =>
      [`${fa(saved)} لغت ذخیره شد`, skipped ? `${fa(skipped)} رد شد` : '', failed ? `${fa(failed)} ساخته نشد` : ''].filter(Boolean).join('، ') + '.',
    again: 'وارد کردن یک لیست دیگر',
    toBank: 'دیدن بانک واژه',
    leaveConfirm: 'هنوز کارت‌هایی مانده که تأیید نکرده‌ای. بیرون بروی از بین می‌روند.',
    leave: 'بیرون برو',
    suggestion: (from: string, to: string) => `«${from}» را «${to}» در نظر گرفتم.`,
  },

  words: {
    title: 'بانک واژه',
    search: 'جست‌وجو در آلمانی یا فارسی',
    count: (shown: number, total: number) => (shown === total ? `${fa(total)} کلمه` : `${fa(shown)} از ${fa(total)} کلمه`),
    empty: 'اولین کلمه‌ات را اضافه کن 🌱',
    emptyBody: 'هر کلمه‌ای که ذخیره کنی اینجا می‌ماند و به‌نوبت وارد مرور روزانه می‌شود.',
    noMatch: 'کلمه‌ای با این مشخصات پیدا نشد.',
    clearFilters: 'پاک کردن فیلترها',
    filters: 'فیلتر و ترتیب',
    all: 'همه',
    favorites: 'علاقه‌مندی‌ها',
    difficult: 'دشوار',
    dueToday: 'موعد امروز',
    sort: 'ترتیب',
    sortNewest: 'تازه‌ترین',
    sortAlpha: 'الفبایی',
    sortReviewed: 'آخرین مرور',
    sortDue: 'نزدیک‌ترین موعد',
    posGroup: 'نوع کلمه',
    cefrGroup: 'سطح',
    tagGroup: 'دسته',
    statusGroup: 'وضعیت',
    select: 'انتخاب',
    selected: (n: number) => `${fa(n)} انتخاب شد`,
    archiveSelected: 'حذف از بانک',
    favoriteSelected: 'علاقه‌مندی',
    archiveConfirm: (n: number) => `${fa(n)} کلمه از بانک واژه حذف شود؟ تاریخچهٔ مرورشان نگه داشته می‌شود.`,
    showMore: 'نمایش بیشتر',
  },

  detail: {
    notFound: 'این کلمه پیدا نشد. شاید حذف شده باشد.',
    meanings: 'معنی',
    grammar: 'دستور زبان',
    conjugation: 'صرف فعل',
    synonyms: 'مترادف',
    antonyms: 'متضاد',
    collocations: 'ترکیب‌های رایج',
    notes: 'نکته',
    learning: 'وضعیت یادگیری',
    status: 'وضعیت',
    nextReview: 'مرور بعدی',
    lastReview: 'آخرین مرور',
    reviewCount: 'تعداد مرور',
    lapses: 'دفعات فراموشی',
    recall: 'احتمال یادآوری الان',
    stability: 'ماندگاری در حافظه',
    difficulty: 'سختی',
    notStarted: 'هنوز وارد مرور نشده؛ در صف کلمه‌های تازه است.',
    reverseCard: 'کارت معکوس (فارسی به آلمانی)',
    reverseWaiting: 'بعد از یاد گرفتن خود لغت شروع می‌شود.',
    never: 'هنوز نه',
    difficultyWords: ['خیلی آسان', 'آسان', 'متوسط', 'سخت', 'خیلی سخت'],
    regenerate: 'ساخت دوباره با هوش مصنوعی',
    regenerateConfirm: 'اطلاعات این کلمه دوباره ساخته می‌شود و به‌صورت پیش‌نویس نشانت می‌دهم. تا ذخیره نکنی چیزی عوض نمی‌شود.',
    archive: 'حذف از بانک واژه',
    archiveConfirm: 'این کلمه از بانک واژه و مرور روزانه حذف شود؟ تاریخچهٔ مرورش نگه داشته می‌شود.',
    archived: 'از بانک واژه حذف شد',
    favoriteOn: 'به علاقه‌مندی‌ها اضافه شد',
    favoriteOff: 'از علاقه‌مندی‌ها برداشته شد',
    addedOn: 'افزوده شده در',
    plural: 'جمع',
    genitive: 'Genitiv',
    pluralOnly: 'فقط جمع',
    noPlural: 'جمع ندارد',
    auxiliary: 'فعل کمکی',
    separable: 'جداشدنی',
    inseparable: 'جدانشدنی',
    irregular: 'بی‌قاعده',
    regular: 'باقاعده',
    reflexive: 'انعکاسی',
    government: 'همراه با',
    traits: 'ویژگی',
    overdue: (since: string) => `موعدش رسیده (${since})`,
    comparative: 'برتر',
    superlative: 'برترین',
  },

  study: {
    title: 'مرور',
    showAnswer: 'نمایش جواب',
    recallPrompt: 'معنی‌اش را به یاد بیاور، بعد جواب را ببین.',
    reversePrompt: 'آلمانی‌اش را به یاد بیاور (اسم‌ها با حرف تعریف).',
    reverseBadge: 'فارسی به آلمانی',
    undo: 'برگرداندن جواب قبلی',
    undone: 'جواب قبلی برگشت.',
    streak: (n: number) => `${fa(n)} تا پشت سر هم!`,
    newBadge: 'کلمهٔ تازه',
    ratings: { 1: 'دوباره', 2: 'سخت', 3: 'خوب', 4: 'آسان' } satisfies Record<Rating, string>,
    ratingHelp: {
      1: 'یادم نیامد',
      2: 'یادم آمد، ولی به‌سختی',
      3: 'یادم آمد',
      4: 'خیلی راحت بود',
    } satisfies Record<Rating, string>,
    ratingGuide: 'چطور جواب بدهم؟',
    fullDetail: 'جزئیات کامل کلمه',
    remaining: (n: number) => `${fa(n)} کارت مانده`,
    exit: 'خروج از مرور',
    emptyTitle: 'امروز کارت مروری نداری. عالیه! 🎉',
    emptyBody: 'کلمه‌های تازه که اضافه کنی، به‌نوبت اینجا می‌آیند.',
    emptyNoWords: 'هنوز کلمه‌ای برای مرور نداری.',
    waitTitle: 'یک نفس تازه کن',
    waitBody: (n: number, when: string) => `${fa(n)} کارت در حال یادگیری ${when} برمی‌گردد.`,
    waitNow: 'همین حالا مرورشان کن',
    doneTitle: 'این دور تمام شد',
    doneCards: 'کارت دیده‌شده',
    doneCorrect: 'یادآوری درست',
    doneTime: 'زمان',
    doneNew: 'کلمهٔ تازه',
    doneDuration: (ms: number) => (ms < 60_000 ? `${fa(Math.max(1, Math.round(ms / 1000)))} ثانیه` : `${fa(Math.round(ms / 60_000))} دقیقه`),
    doneHome: 'برگشت به خانه',
    doneGoal: 'هدف امروزت هم کامل شد.',
    encourage: 'اشکال نداره، دوباره امتحانش می‌کنیم.',
    proud: 'این یکی سخت بود و یادت آمد!',
    saveFailed: 'جوابت روی این دستگاه ذخیره شد و با وصل شدن اینترنت فرستاده می‌شود.',
  },

  quiz: {
    title: 'آزمون',
    intro: 'آزمون از لغت‌های خودت ساخته می‌شود و روی زمان‌بندی مرور اثری ندارد.',
    kinds: {
      mixed: { title: 'مخلوط', body: 'همهٔ نوع‌ها با هم' },
      choice: { title: 'چهارگزینه‌ای', body: 'معنی درست را انتخاب کن' },
      typing: { title: 'نوشتاری', body: 'آلمانی‌اش را خودت بنویس' },
      article: { title: 'der / die / das', body: 'حرف تعریف اسم‌ها' },
    } satisfies Record<QuizKind, { title: string; body: string }>,
    length: 'تعداد سؤال',
    questions: (n: number) => `${fa(n)} سؤال`,
    start: 'شروع آزمون',
    needWords: 'برای آزمون اول چند لغت اضافه کن.',
    needFour: 'برای چهارگزینه‌ای دست‌کم چهار لغت با معنی‌های مختلف لازم است.',
    needNouns: 'برای این تمرین باید چند اسم در بانک واژه‌ات باشد.',
    prompts: {
      choice_de_fa: 'معنی این کلمه چیست؟',
      choice_fa_de: 'آلمانی‌اش کدام است؟',
      typing_fa_de: 'آلمانی‌اش را بنویس',
      article: 'حرف تعریفش کدام است؟',
    } satisfies Record<QuestionType, string>,
    typePlaceholder: 'به آلمانی بنویس',
    typeHelp: 'برای اسم‌ها می‌توانی حرف تعریف را هم بنویسی.',
    check: 'بررسی',
    dontKnow: 'نمی‌دانم',
    next: 'بعدی',
    finish: 'دیدن نتیجه',
    position: (i: number, total: number) => `سؤال ${fa(i)} از ${fa(total)}`,
    correct: 'درست است!',
    wrong: 'درست نبود.',
    answerIs: 'جواب درست:',
    notes: {
      case: 'درست است؛ فقط حواست به حرف بزرگ و کوچک باشد.',
      spelling: 'درست است؛ املای دقیقش را ببین.',
      wrong_article: 'خود کلمه درست بود، ولی حرف تعریفش نه.',
    } satisfies Record<GradeNote, string>,
    exit: 'خروج از آزمون',
    exitConfirm: 'آزمون نیمه‌تمام است. بیرون بروی جواب‌های تا اینجا ذخیره می‌شود.',
    resultTitle: 'نتیجهٔ آزمون',
    score: (correct: number, total: number) => `${fa(correct)} از ${fa(total)}`,
    resultGreat: 'عالی بود! این لغت‌ها را خوب بلدی.',
    resultGood: 'خوب بود. چند لغت هنوز تمرین می‌خواهد.',
    resultKeepGoing: 'اشکال نداره؛ همین که فهمیدی کدام‌ها سخت‌اند یک قدم جلو رفته‌ای.',
    missed: 'این‌ها را دوباره ببین',
    correctLabel: 'جواب درست',
    accuracyLabel: 'درصد درست',
    again: 'یک آزمون دیگر',
    studyHint: 'لغت‌هایی که اشتباه شدند در آزمون‌های بعدی بیشتر می‌آیند.',
  },

  stats: {
    title: 'آمار',
    empty: 'هنوز آماری نیست. چند لغت اضافه کن و مرور را شروع کن.',
    insightStart: 'هر مروری که انجام بدهی اینجا دیده می‌شود.',
    insightStreak: (n: number) => `${fa(n)} روز است که پشت سر هم مرور می‌کنی. همین‌طور ادامه بده!`,
    insightRetention: (p: string) => `موقع مرور ${p} لغت‌ها یادت مانده بود.`,
    insightMastered: (n: number) => `${fa(n)} لغت در حافظه‌ات تثبیت شده.`,
    words: 'لغت‌ها',
    wordsTotal: (n: number) => `${fa(n)} لغت در بانک`,
    periodTitle: 'مرور',
    today: 'امروز',
    week: '۷ روز',
    month: '۳۰ روز',
    reviews: 'مرور',
    minutes: 'دقیقه',
    newWords: 'لغت تازه',
    activeDays: 'روز فعال',
    retention: 'یادآوری',
    retentionHelp: 'یادآوری یعنی از لغت‌هایی که قبلاً یاد گرفته بودی، چند درصد را موقع مرور به یاد آوردی.',
    streakNow: 'روز پیاپی',
    streakBest: 'بهترین رکورد',
    activity: 'مرور در ۳۰ روز گذشته',
    activityNone: 'در این ۳۰ روز مروری انجام نشده.',
    forecast: 'مرورهای ۱۴ روز آینده',
    forecastToday: 'امروز',
    forecastHelp: 'تعداد کارت‌هایی که هر روز موعدشان می‌رسد، اگر لغت تازه‌ای اضافه نشود.',
    forecastNone: 'در دو هفتهٔ آینده کارتی موعد ندارد.',
    levels: 'سطح لغت‌ها',
    noLevel: 'بدون سطح',
    difficult: 'لغت‌های سخت',
    difficultNone: 'لغتی نیست که مدام فراموش شود.',
    lapses: (n: number) => `${fa(n)} بار فراموش شده`,
    quiz: 'آزمون‌ها (۹۰ روز)',
    quizAnswersLabel: 'جواب در آزمون',
    quizNone: 'هنوز آزمونی نداده‌ای.',
    perDay: (key: string, n: number) => `${key}: ${fa(n)} مرور`,
  },

  settings: {
    title: 'تنظیمات',
    account: 'حساب',
    displayName: 'نام',
    email: 'ایمیل',
    signOut: 'خروج از حساب',
    signOutConfirm: 'از حساب خارج می‌شوی و داده‌های این دستگاه پاک می‌شود. اطلاعاتت روی سرور می‌ماند.',
    signOutPending: (n: number) => `${fa(n)} تغییر هنوز به سرور نرسیده و با خروج از بین می‌رود. اول به اینترنت وصل شو.`,
    learning: 'یادگیری',
    newPerDay: 'کلمهٔ تازه در روز',
    newPerDayHelp: 'هر کلمهٔ تازه در روزهای بعد چند بار مرور می‌شود.',
    newPerDayWarn: 'عدد بالا یعنی مرور روزانهٔ خیلی بیشتر در هفته‌های بعد.',
    newPerDayZero: 'با صفر، فقط کلمه‌های قبلی مرور می‌شوند.',
    dailyGoal: 'هدف روزانه',
    dailyGoalHelp: 'هدف زمانی جدا از تعداد کلمهٔ تازه است.',
    minutes: (n: number) => `${fa(n)} دقیقه`,
    advanced: 'تنظیمات پیشرفتهٔ یادگیری',
    reviewLimit: 'سقف مرور روزانه',
    reviewLimitAuto: 'خودکار (بدون سقف)',
    reviewLimitCustom: 'سقف مشخص',
    reviewLimitHelp: 'در حالت خودکار همهٔ کارت‌های موعددار نشان داده می‌شوند. سقف گذاشتن بقیه را به روزهای بعد می‌برد.',
    retention: 'دقت هدف',
    retentionHelp: 'یعنی می‌خواهی موقع مرور چند درصد کلمه‌ها یادت بیاید. عدد بالاتر یعنی مرور بیشتر.',
    learningSteps: 'گام‌های یادگیری کلمهٔ تازه: ۱ دقیقه و ۱۰ دقیقه. گام یادگیری دوباره: ۱۰ دقیقه.',
    reverseCards: 'کارت معکوس (فارسی به آلمانی)',
    reverseCardsHelp: 'برای هر لغت یک کارت دوم ساخته می‌شود که معنی فارسی را نشان می‌دهد و آلمانی‌اش را می‌پرسد. این کارت چند روز بعد از یاد گرفتن خود لغت می‌آید و مرور روزانه را بیشتر می‌کند.',
    audio: 'صدا',
    speechRate: 'سرعت تلفظ',
    speechSlow: 'آهسته',
    speechNormal: 'عادی',
    autoplay: 'پخش خودکار تلفظ روی کارت',
    audioTest: 'امتحان صدا',
    audioUnavailable: 'این مرورگر صدای آلمانی ندارد.',
    appearance: 'ظاهر',
    themes: { system: 'هماهنگ با دستگاه', light: 'روشن', dark: 'تیره' },
    data: 'داده و همگام‌سازی',
    syncNow: 'همگام‌سازی',
    syncing: 'در حال همگام‌سازی…',
    synced: (when: string) => `آخرین همگام‌سازی: ${when}`,
    neverSynced: 'هنوز همگام نشده',
    pending: (n: number) => `${fa(n)} تغییر در انتظار ارسال`,
    export: 'دریافت فایل داده‌ها',
    exportHelp: 'همهٔ کلمه‌ها، کارت‌ها و تاریخچهٔ مرورت در یک فایل JSON.',
    exportFailed: 'فایل ساخته نشد. اتصال اینترنت را نگاه کن.',
    privacy: 'حریم خصوصی',
    privacyBody:
      'کلمه‌ها و تاریخچهٔ مرور تو فقط برای خودت قابل دیدن است. هر کلمه‌ای که می‌سازی برای تحلیل به OpenAI فرستاده می‌شود؛ ایمیل و نام تو فرستاده نمی‌شود. تحلیل آمادهٔ هر کلمه بین کاربران مشترک است، ولی ویرایش‌های تو نه.',
    deleteAccount: 'حذف کامل حساب',
    deleteHelp: 'حساب، همهٔ کلمه‌ها و تاریخچهٔ مرور برای همیشه پاک می‌شود و قابل برگشت نیست.',
    deleteConfirmLabel: 'برای تأیید، ایمیلت را بنویس',
    deleteConfirmButton: 'حسابم را برای همیشه پاک کن',
    deleted: 'حسابت پاک شد.',
    about: 'دربارهٔ هدهد',
    version: 'نسخه',
    scheduler: 'الگوریتم مرور',
    aboutBody: 'زمان‌بندی مرور با FSRS انجام می‌شود (پیاده‌سازی متن‌باز ts-fsrs). قلم فارسی: وزیرمتن.',
    saved: 'ذخیره شد',
  },

  sync: {
    offlineBanner: 'آفلاین هستی. مرور کار می‌کند و با وصل شدن اینترنت ذخیره می‌شود.',
    firstLoad: 'در حال آوردن کلمه‌هایت…',
    firstLoadFailed: 'نتوانستم اطلاعاتت را بیاورم.',
  },

  pos: {
    noun: 'اسم',
    verb: 'فعل',
    adjective: 'صفت',
    adverb: 'قید',
    preposition: 'حرف اضافه',
    conjunction: 'حرف ربط',
    pronoun: 'ضمیر',
    article: 'حرف تعریف',
    numeral: 'عدد',
    interjection: 'صوت',
    particle: 'ادات',
    phrase: 'عبارت',
    other: 'سایر',
  } satisfies Record<PartOfSpeech, string>,

  status: {
    new: 'تازه',
    learning: 'در حال یادگیری',
    review: 'مرور',
    mastered: 'تثبیت‌شده',
  } satisfies Record<WordStatus, string>,

  levels: { easy: 'ساده', medium: 'متوسط', hard: 'پیشرفته' } satisfies Record<ExampleLevel, string>,

  cefr: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] satisfies Cefr[],

  errors: {
    offline: 'به اینترنت وصل نیستی.',
    timeout: 'خیلی طول کشید و جوابی نیامد.',
    auth: 'باید دوباره وارد حسابت شوی.',
    duplicate: 'این کلمه از قبل در بانک واژه‌ات هست.',
    conflict: 'این مورد جای دیگری تغییر کرده است.',
    rate_limit: 'تعداد درخواست‌ها زیاد شد. کمی بعد دوباره امتحان کن.',
    rate_limit_day: 'سقف ساخت کلمه برای امروز پر شده. فردا دوباره امتحان کن.',
    validation: 'ورودی پذیرفته نشد.',
    not_configured: 'سرویس هوش مصنوعی هنوز راه‌اندازی نشده است.',
    ai_quota: 'اعتبار حساب هوش مصنوعی تمام شده است.',
    not_found: 'پیدا نشد.',
    server: 'سرور جواب درستی نداد. کمی بعد دوباره امتحان کن.',
    ai_invalid: 'جوابی که هوش مصنوعی داد قابل استفاده نبود. دوباره امتحان کن.',
  },
}

/** A sentence a person can act on, for any error from the data layer. */
export function describeError(error: AppError): string {
  if (error.kind === 'rate_limit') {
    return error.detail.scope === 'day' || error.detail.scope === 'global' ? t.errors.rate_limit_day : t.errors.rate_limit
  }
  if (error.code === 'ai_quota_exhausted') return t.errors.ai_quota
  if (error.code === 'ai_invalid_output') return t.errors.ai_invalid
  if (error.kind === 'validation' && error.code in t.create.inputErrors) {
    return t.create.inputErrors[error.code as InputErrorCode]
  }
  return t.errors[error.kind] ?? t.errors.server
}

function describePath(path: string): string {
  const f = t.draft.fields
  const parts = path.split('.')
  const n = (i: number) => fa(Number(parts[i]) + 1)
  if (parts[0] === 'lemma') return f.word
  if (parts[0] === 'pos') return f.pos
  if (parts[0] === 'cefr') return f.cefr
  if (parts[0] === 'ipa') return f.ipa
  if (parts[0] === 'meanings') {
    if (parts.length === 1) return 'معنی‌ها'
    if (parts[2] === 'translation') return `${f.translation}ِ معنی ${n(1)}`
    if (parts[2] === 'note') return `${f.meaningNote}ِ معنی ${n(1)}`
    if (parts[2] === 'examples') {
      if (parts.length === 3) return `مثال‌های معنی ${n(1)}`
      const which = parts[4] === 'de' ? f.exampleDe : parts[4] === 'fa' ? f.exampleFa : 'مثال'
      return `${which} (معنی ${n(1)}، مثال ${n(3)})`
    }
    return `معنی ${n(1)}`
  }
  if (parts[0] === 'noun') return parts[1] === 'article' ? f.article : parts[1] === 'plural' ? f.plural : 'اطلاعات اسم'
  if (parts[0] === 'verb') {
    const tenses: Record<string, string> = {
      praesens: 'Präsens', praeteritum: 'Präteritum', konjunktiv1: 'Konjunktiv I', konjunktiv2: 'Konjunktiv II',
      imperativ: 'Imperativ', partizip2: 'Partizip II', auxiliary: f.auxiliary, reflexive: f.reflexive, government: f.government,
    }
    return parts[1] && tenses[parts[1]] ? `صرف ${tenses[parts[1]]}` : 'اطلاعات فعل'
  }
  if (parts[0] === 'adjective') return 'صفت برتر و برترین'
  if (parts[0] === 'synonyms') return f.synonyms
  if (parts[0] === 'antonyms') return f.antonyms
  if (parts[0] === 'collocations') return parts.length > 1 ? `ترکیب ${n(1)}` : f.collocations
  if (parts[0] === 'notes') return f.notes
  return 'یک بخش'
}
