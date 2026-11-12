/**
 * Every word of the introduction site, in the 10 languages Hodhod speaks.
 * English is the master; the type below makes sure no language misses a line.
 */
export interface SiteCopy {
  title: string
  description: string
  nav: { features: string; languages: string; pricing: string; faq: string; openApp: string; menu: string; language: string }
  hero: { eyebrow: string; h1: string; lead: string; start: string; how: string; free: string }
  stores: { title: string; ios: string; android: string; web: string; soon: string; get: string; open: string }
  stats: { title: string; learners: string; words: string; reviews: string; languages: string }
  langs: { title: string; sub: string; speak: string; learn: string }
  features: { title: string; sub: string; items: [string, string][] }
  how: { title: string; steps: [string, string][]; shots: [string, string, string] }
  pricing: {
    title: string
    sub: string
    freeName: string
    freePrice: string
    freeFor: string
    free: string[]
    plusName: string
    plusFor: string
    plus: string[]
    month: string
    year: string
    lifetime: string
    soon: string
    start: string
    popular: string
  }
  reviews: { title: string }
  faq: { title: string; items: [string, string][] }
  final: { title: string; sub: string }
  footer: { tagline: string; legal: string; languages: string; contact: string }
  /** Shown on the English page to a visitor whose browser speaks this language. */
  suggest: string
}

const en: SiteCopy = {
  title: 'Hodhod — learn the words of a new language, in your own language',
  description:
    'Type any word: Hodhod makes a complete flashcard with meanings in your language, grammar, examples and natural pronunciation, then reminds you to review it right before you forget. English, German, French, Italian, Spanish and Dutch.',
  nav: { features: 'Features', languages: 'Languages', pricing: 'Pricing', faq: 'FAQ', openApp: 'Open the app', menu: 'Menu', language: 'Language' },
  hero: {
    eyebrow: 'Your companion on the way to a new language',
    h1: 'Learn new words better, with Hodhod.',
    lead: 'Hodhod is by your side as you learn new words with their meaning, examples, grammar and pronunciation — and helps you remember them with reviews at the right time.',
    start: 'Start free',
    how: 'How does Hodhod work?',
    free: 'Start for free · no credit card needed',
  },
  stores: { title: 'On every device', ios: 'iPhone & iPad', android: 'Android', web: 'Any browser', soon: 'Coming soon', get: 'Download', open: 'Open now' },
  stats: { title: 'Hodhod in numbers', learners: 'learners', words: 'words saved', reviews: 'reviews done', languages: 'languages' },
  langs: { title: 'Your language. Your next language.', sub: 'Hodhod explains everything in the language you already speak.', speak: 'You speak', learn: 'You learn' },
  features: {
    title: 'Everything you need to really learn words',
    sub: 'Not another dictionary: a companion that reviews with you every day.',
    items: [
      ['A complete card in seconds', 'Meanings in your language, gender with colours, plurals, verb forms, examples and the right level — all from one word.'],
      ['Review at the right moment', 'Hodhod knows which word is about to slip away and shows you exactly that one. A few minutes a day is enough.'],
      ['Natural pronunciation', 'Hear every word and sentence in a natural voice, not a robot.'],
      ['Ready-made packs', 'Words for real life, lesson by lesson: work, doctor, office, home and more.'],
      ['Stories and podcasts', 'Short stories written around your own words, and short spoken conversations to follow sentence by sentence — tap any word to make a card.'],
      ['Listen and speak', 'Dictation and speaking practice: hear and type, or say it out loud and see if it was right.'],
      ['Reminders at your times', 'Choose up to eight times a day, like an alarm clock. Hodhod only calls when there is something to do.'],
      ['Learn with friends', 'Add friends by code and see a weekly board — a little push goes a long way.'],
    ],
  },
  how: {
    title: 'How it works',
    steps: [
      ['Type the word', 'Anything you heard at work, in class or on the street.'],
      ['Your card is ready', 'Meaning, grammar, examples and sound. Look it over and save it.'],
      ['Review a few minutes a day', 'A reminder comes, you review a few cards, and the words stay with you for good.'],
    ],
    shots: ['A finished card', 'Your daily goal', 'Reviewing a card'],
  },
  pricing: {
    title: 'Simple pricing',
    sub: 'Start free. Upgrade when Hodhod becomes part of your day.',
    freeName: 'Free',
    freePrice: '0 €',
    freeFor: 'forever',
    free: ['One language to learn', 'Smart cards and daily review', 'Natural pronunciation', 'Reminders and friends'],
    plusName: 'Hodhod Plus',
    plusFor: 'for serious learners',
    plus: ['Everything in Free', 'More languages at the same time', 'More AI cards and stories every day', 'Support a small independent app'],
    month: 'per month',
    year: 'per year',
    lifetime: 'once, forever',
    soon: 'Coming soon',
    start: 'Start free',
    popular: 'Best value',
  },
  reviews: { title: 'What learners say' },
  faq: {
    title: 'Questions',
    items: [
      ['Is Hodhod free?', 'Yes. You can start and keep learning one language for free. Hodhod Plus adds more languages and more AI help.'],
      ['How do I install it on my phone?', 'Open the app in your browser and choose “Add to Home Screen”. The App Store and Google Play versions are coming soon.'],
      ['Which level is it for?', 'From your very first word to advanced. You choose the words, so the app grows with you.'],
      ['Will I lose my words if I change phones?', 'No. Your words and progress are saved in your account; sign in on the new phone and everything is there.'],
      ['Is my data safe?', 'Your words and progress belong to you alone. Nobody else can see them, and you can delete your account at any time.'],
    ],
  },
  final: { title: 'Make your first card now', sub: 'Signing up takes one minute.' },
  footer: { tagline: 'Smart flashcards in your own language.', legal: 'Legal', languages: 'Languages', contact: 'Contact' },
  suggest: 'View this page in English?',
}

const fa: SiteCopy = {
  title: 'هدهد — واژه‌های یک زبان تازه را با زبان خودت یاد بگیر',
  description:
    'هر واژه‌ای را بنویس: هدهد یک کارت کامل با معنی به زبان خودت، دستور زبان، مثال و تلفظ طبیعی می‌سازد و درست پیش از فراموش کردن، برای مرور یادت می‌اندازد. انگلیسی، آلمانی، فرانسوی، ایتالیایی، اسپانیایی و هلندی.',
  nav: { features: 'امکانات', languages: 'زبان‌ها', pricing: 'قیمت', faq: 'سؤال‌ها', openApp: 'باز کردن اپ', menu: 'منو', language: 'زبان' },
  hero: {
    eyebrow: 'همراه تو در مسیر یادگیری زبان',
    h1: 'واژه‌های تازه را با هدهد، بهتر یاد بگیر.',
    lead: 'هدهد همراه توست تا واژه‌های جدید را با معنی، مثال، دستور زبان و تلفظ یاد بگیری و با مرورهای به‌موقع، آن‌ها را بهتر به خاطر بسپاری.',
    start: 'شروع رایگان',
    how: 'هدهد چطور کار می‌کند؟',
    free: 'رایگان شروع کن · بدون نیاز به کارت بانکی',
  },
  stores: { title: 'روی همهٔ دستگاه‌ها', ios: 'آیفون و آیپد', android: 'اندروید', web: 'هر مرورگری', soon: 'به‌زودی', get: 'دانلود', open: 'همین حالا باز کن' },
  stats: { title: 'هدهد به زبان عدد', learners: 'زبان‌آموز', words: 'واژهٔ ذخیره‌شده', reviews: 'مرور انجام‌شده', languages: 'زبان' },
  langs: { title: 'زبان خودت. زبان بعدی‌ات.', sub: 'هدهد همه‌چیز را به زبانی که بلدی توضیح می‌دهد.', speak: 'زبان تو', learn: 'زبانی که یاد می‌گیری' },
  features: {
    title: 'هر چیزی که برای یاد گرفتن واقعی واژه لازم داری',
    sub: 'نه یک دیکشنری دیگر؛ همراهی که هر روز با تو مرور می‌کند.',
    items: [
      ['کارت کامل در چند ثانیه', 'معنی به زبان خودت، جنس واژه با رنگ، جمع، صرف فعل، مثال و سطح درست؛ همه از یک واژه.'],
      ['مرور درست به‌موقع', 'هدهد می‌داند کدام واژه دارد از یادت می‌رود و همان را نشانت می‌دهد. روزی چند دقیقه کافی است.'],
      ['تلفظ طبیعی', 'هر واژه و هر جمله را با صدای طبیعی بشنو، نه صدای رباتی.'],
      ['بسته‌های آماده', 'واژه‌های زندگی واقعی، درس‌به‌درس: کار، دکتر، اداره، خانه و بیشتر.'],
      ['داستان و پادکست', 'داستان‌های کوتاه با واژه‌های خودت، و گفت‌وگوهای کوتاه صوتی که جمله به جمله دنبالشان می‌کنی. روی هر واژه بزنی، کارتش ساخته می‌شود.'],
      ['شنیدن و گفتن', 'دیکته و تمرین گفتاری: بشنو و بنویس، یا بلند بگو و ببین درست گفتی یا نه.'],
      ['یادآور در ساعت‌های دلخواه', 'تا هشت ساعت در روز، مثل ساعت زنگ‌دار. هدهد فقط وقتی کاری هست صدایت می‌کند.'],
      ['یادگیری با دوستان', 'دوستانت را با کد اضافه کن و جدول هفتگی را ببین؛ یک کم رقابت خیلی کمک می‌کند.'],
    ],
  },
  how: {
    title: 'چطور کار می‌کند؟',
    steps: [
      ['واژه را بنویس', 'هر چیزی که سر کار، در کلاس یا در خیابان شنیدی.'],
      ['کارتت آماده است', 'معنی، دستور زبان، مثال و صدا. نگاهش کن و ذخیره‌اش کن.'],
      ['روزی چند دقیقه مرور', 'یادآور می‌آید، چند کارت مرور می‌کنی و واژه‌ها برای همیشه در ذهنت می‌مانند.'],
    ],
    shots: ['یک کارت آماده', 'هدف روزانه‌ات', 'مرور یک کارت'],
  },
  pricing: {
    title: 'قیمت ساده',
    sub: 'رایگان شروع کن. وقتی هدهد بخشی از روزت شد، ارتقا بده.',
    freeName: 'رایگان',
    freePrice: '۰ €',
    freeFor: 'برای همیشه',
    free: ['یک زبان برای یادگیری', 'کارت هوشمند و مرور روزانه', 'تلفظ طبیعی', 'یادآور و دوستان'],
    plusName: 'هدهد پلاس',
    plusFor: 'برای زبان‌آموزهای جدی',
    plus: ['همهٔ امکانات رایگان', 'چند زبان هم‌زمان', 'کارت و داستان هوشمند بیشتر در روز', 'حمایت از یک اپ مستقل و کوچک'],
    month: 'در ماه',
    year: 'در سال',
    lifetime: 'یک بار، برای همیشه',
    soon: 'به‌زودی',
    start: 'شروع رایگان',
    popular: 'به‌صرفه‌ترین',
  },
  reviews: { title: 'زبان‌آموزها چه می‌گویند' },
  faq: {
    title: 'سؤال‌های رایج',
    items: [
      ['هدهد رایگان است؟', 'بله. می‌توانی یک زبان را رایگان شروع کنی و ادامه بدهی. هدهد پلاس زبان‌های بیشتر و کمک هوشمند بیشتر می‌دهد.'],
      ['چطور روی گوشی نصبش کنم؟', 'اپ را در مرورگر باز کن و «Add to Home Screen» را بزن. نسخه‌های App Store و Google Play به‌زودی می‌آیند.'],
      ['برای چه سطحی مناسب است؟', 'از اولین واژه تا سطح پیشرفته. واژه‌ها را خودت انتخاب می‌کنی، پس اپ همراه تو بزرگ می‌شود.'],
      ['اگر گوشی‌ام را عوض کنم، واژه‌هایم از بین می‌رود؟', 'نه. واژه‌ها و پیشرفتت در حسابت ذخیره است؛ در گوشی تازه وارد شو و همه‌چیز سر جایش است.'],
      ['اطلاعاتم امن است؟', 'واژه‌ها و پیشرفتت فقط مال خودت است و هیچ‌کس دیگری آن‌ها را نمی‌بیند. هر وقت بخواهی حسابت را پاک می‌کنی.'],
    ],
  },
  final: { title: 'اولین کارتت را همین حالا بساز', sub: 'ثبت‌نام یک دقیقه طول می‌کشد.' },
  footer: { tagline: 'کارت‌های هوشمند به زبان خودت.', legal: 'قانونی', languages: 'زبان‌ها', contact: 'تماس' },
  suggest: 'این صفحه را به فارسی ببینی؟',
}

const de: SiteCopy = {
  title: 'Hodhod — Vokabeln einer neuen Sprache lernen, in deiner eigenen Sprache',
  description:
    'Tippe ein Wort: Hodhod erstellt eine vollständige Karteikarte mit Bedeutungen in deiner Sprache, Grammatik, Beispielen und natürlicher Aussprache – und erinnert dich genau dann ans Wiederholen, bevor du es vergisst. Englisch, Deutsch, Französisch, Italienisch, Spanisch und Niederländisch.',
  nav: { features: 'Funktionen', languages: 'Sprachen', pricing: 'Preise', faq: 'FAQ', openApp: 'App öffnen', menu: 'Menü', language: 'Sprache' },
  hero: {
    eyebrow: 'Dein Begleiter beim Sprachenlernen',
    h1: 'Neue Wörter besser lernen – mit Hodhod.',
    lead: 'Hodhod begleitet dich: Du lernst neue Wörter mit Bedeutung, Beispielen, Grammatik und Aussprache und behältst sie besser, weil du sie zur richtigen Zeit wiederholst.',
    start: 'Kostenlos starten',
    how: 'Wie funktioniert Hodhod?',
    free: 'Kostenlos starten · keine Kreditkarte nötig',
  },
  stores: { title: 'Auf jedem Gerät', ios: 'iPhone & iPad', android: 'Android', web: 'Jeder Browser', soon: 'Demnächst', get: 'Laden', open: 'Jetzt öffnen' },
  stats: { title: 'Hodhod in Zahlen', learners: 'Lernende', words: 'gespeicherte Wörter', reviews: 'Wiederholungen', languages: 'Sprachen' },
  langs: { title: 'Deine Sprache. Deine nächste Sprache.', sub: 'Hodhod erklärt alles in der Sprache, die du schon sprichst.', speak: 'Du sprichst', learn: 'Du lernst' },
  features: {
    title: 'Alles, um Wörter wirklich zu lernen',
    sub: 'Kein weiteres Wörterbuch, sondern ein Begleiter, der jeden Tag mit dir wiederholt.',
    items: [
      ['Eine komplette Karte in Sekunden', 'Bedeutungen in deiner Sprache, Genus in Farbe, Plural, Verbformen, Beispiele und das passende Niveau – alles aus einem Wort.'],
      ['Wiederholen im richtigen Moment', 'Hodhod weiß, welches Wort dir gerade entgleitet, und zeigt dir genau dieses. Ein paar Minuten am Tag reichen.'],
      ['Natürliche Aussprache', 'Hör jedes Wort und jeden Satz mit natürlicher Stimme, nicht wie ein Roboter.'],
      ['Fertige Pakete', 'Wörter fürs echte Leben, Lektion für Lektion: Arbeit, Arzt, Amt, Zuhause und mehr.'],
      ['Geschichten und Podcasts', 'Kurze Geschichten mit deinen eigenen Wörtern und kurze Gespräche zum Anhören, Satz für Satz – tippe auf ein Wort und mach eine Karte daraus.'],
      ['Hören und Sprechen', 'Diktat und Sprechübung: hören und tippen oder laut sagen und sehen, ob es stimmt.'],
      ['Erinnerungen zu deinen Zeiten', 'Bis zu acht Zeiten am Tag, wie ein Wecker. Hodhod meldet sich nur, wenn es etwas zu tun gibt.'],
      ['Mit Freunden lernen', 'Freunde per Code hinzufügen und die Wochentabelle sehen – ein kleiner Anstoß wirkt Wunder.'],
    ],
  },
  how: {
    title: 'So funktioniert’s',
    steps: [
      ['Wort eintippen', 'Alles, was du bei der Arbeit, im Kurs oder auf der Straße gehört hast.'],
      ['Deine Karte ist fertig', 'Bedeutung, Grammatik, Beispiele und Ton. Anschauen und speichern.'],
      ['Ein paar Minuten am Tag wiederholen', 'Eine Erinnerung kommt, du wiederholst ein paar Karten, und die Wörter bleiben für immer.'],
    ],
    shots: ['Eine fertige Karte', 'Dein Tagesziel', 'Eine Karte wiederholen'],
  },
  pricing: {
    title: 'Einfache Preise',
    sub: 'Kostenlos starten. Upgraden, wenn Hodhod Teil deines Tages wird.',
    freeName: 'Kostenlos',
    freePrice: '0 €',
    freeFor: 'für immer',
    free: ['Eine Lernsprache', 'Smarte Karten und tägliche Wiederholung', 'Natürliche Aussprache', 'Erinnerungen und Freunde'],
    plusName: 'Hodhod Plus',
    plusFor: 'für ernsthaft Lernende',
    plus: ['Alles aus Kostenlos', 'Mehrere Sprachen gleichzeitig', 'Mehr KI-Karten und Geschichten pro Tag', 'Unterstütze eine kleine unabhängige App'],
    month: 'pro Monat',
    year: 'pro Jahr',
    lifetime: 'einmalig, für immer',
    soon: 'Demnächst',
    start: 'Kostenlos starten',
    popular: 'Bester Preis',
  },
  reviews: { title: 'Was Lernende sagen' },
  faq: {
    title: 'Fragen',
    items: [
      ['Ist Hodhod kostenlos?', 'Ja. Du kannst eine Sprache kostenlos starten und weiterlernen. Hodhod Plus bringt mehr Sprachen und mehr KI-Hilfe.'],
      ['Wie installiere ich es auf dem Handy?', 'Öffne die App im Browser und wähle „Zum Home-Bildschirm“. Die Versionen für App Store und Google Play kommen bald.'],
      ['Für welches Niveau ist es?', 'Vom allerersten Wort bis fortgeschritten. Du wählst die Wörter, also wächst die App mit dir.'],
      ['Verliere ich meine Wörter bei einem neuen Handy?', 'Nein. Wörter und Fortschritt sind in deinem Konto gespeichert; melde dich auf dem neuen Handy an und alles ist da.'],
      ['Sind meine Daten sicher?', 'Deine Wörter und dein Fortschritt gehören nur dir. Niemand sonst sieht sie, und du kannst dein Konto jederzeit löschen.'],
    ],
  },
  final: { title: 'Erstelle jetzt deine erste Karte', sub: 'Die Anmeldung dauert eine Minute.' },
  footer: { tagline: 'Smarte Karteikarten in deiner eigenen Sprache.', legal: 'Rechtliches', languages: 'Sprachen', contact: 'Kontakt' },
  suggest: 'Diese Seite auf Deutsch ansehen?',
}

const fr: SiteCopy = {
  title: 'Hodhod — apprends les mots d’une nouvelle langue, dans ta propre langue',
  description:
    'Tape n’importe quel mot : Hodhod crée une fiche complète avec les sens dans ta langue, la grammaire, des exemples et une prononciation naturelle, puis te le fait réviser juste avant que tu l’oublies. Anglais, allemand, français, italien, espagnol et néerlandais.',
  nav: { features: 'Fonctions', languages: 'Langues', pricing: 'Tarifs', faq: 'FAQ', openApp: 'Ouvrir l’app', menu: 'Menu', language: 'Langue' },
  hero: {
    eyebrow: 'Ton compagnon pour apprendre une langue',
    h1: 'Apprends mieux les mots nouveaux, avec Hodhod.',
    lead: 'Hodhod t’accompagne pour apprendre les mots nouveaux avec leur sens, des exemples, la grammaire et la prononciation, et pour mieux les retenir grâce à des révisions au bon moment.',
    start: 'Commencer gratuitement',
    how: 'Comment fonctionne Hodhod ?',
    free: 'Commence gratuitement · sans carte bancaire',
  },
  stores: { title: 'Sur tous tes appareils', ios: 'iPhone et iPad', android: 'Android', web: 'Tout navigateur', soon: 'Bientôt', get: 'Télécharger', open: 'Ouvrir maintenant' },
  stats: { title: 'Hodhod en chiffres', learners: 'apprenants', words: 'mots enregistrés', reviews: 'révisions', languages: 'langues' },
  langs: { title: 'Ta langue. Ta prochaine langue.', sub: 'Hodhod explique tout dans la langue que tu parles déjà.', speak: 'Tu parles', learn: 'Tu apprends' },
  features: {
    title: 'Tout pour vraiment apprendre des mots',
    sub: 'Pas un dictionnaire de plus : un compagnon qui révise avec toi chaque jour.',
    items: [
      ['Une fiche complète en quelques secondes', 'Sens dans ta langue, genre en couleur, pluriel, conjugaison, exemples et bon niveau — à partir d’un seul mot.'],
      ['Réviser au bon moment', 'Hodhod sait quel mot est sur le point de t’échapper et te montre justement celui-là. Quelques minutes par jour suffisent.'],
      ['Prononciation naturelle', 'Écoute chaque mot et chaque phrase avec une voix naturelle, pas un robot.'],
      ['Paquets prêts à l’emploi', 'Les mots de la vraie vie, leçon par leçon : travail, médecin, administration, maison et plus.'],
      ['Histoires et podcasts', 'De courtes histoires avec tes propres mots, et de courtes conversations à écouter phrase par phrase — touche un mot pour en faire une carte.'],
      ['Écouter et parler', 'Dictée et expression orale : écoute et écris, ou dis-le à voix haute et vois si c’est juste.'],
      ['Rappels à tes heures', 'Jusqu’à huit heures par jour, comme un réveil. Hodhod ne t’appelle que s’il y a quelque chose à faire.'],
      ['Apprendre entre amis', 'Ajoute des amis par code et regarde le classement de la semaine — un petit coup de pouce aide beaucoup.'],
    ],
  },
  how: {
    title: 'Comment ça marche',
    steps: [
      ['Tape le mot', 'Tout ce que tu as entendu au travail, en cours ou dans la rue.'],
      ['Ta fiche est prête', 'Sens, grammaire, exemples et son. Jette un œil et enregistre-la.'],
      ['Révise quelques minutes par jour', 'Un rappel arrive, tu révises quelques fiches, et les mots restent pour de bon.'],
    ],
    shots: ['Une fiche terminée', 'Ton objectif du jour', 'Réviser une fiche'],
  },
  pricing: {
    title: 'Des tarifs simples',
    sub: 'Commence gratuitement. Passe à Plus quand Hodhod fait partie de ta journée.',
    freeName: 'Gratuit',
    freePrice: '0 €',
    freeFor: 'pour toujours',
    free: ['Une langue à apprendre', 'Fiches intelligentes et révision quotidienne', 'Prononciation naturelle', 'Rappels et amis'],
    plusName: 'Hodhod Plus',
    plusFor: 'pour les apprenants motivés',
    plus: ['Tout ce qui est gratuit', 'Plusieurs langues en même temps', 'Plus de fiches et d’histoires IA par jour', 'Soutenir une petite app indépendante'],
    month: 'par mois',
    year: 'par an',
    lifetime: 'une fois, pour toujours',
    soon: 'Bientôt',
    start: 'Commencer gratuitement',
    popular: 'Meilleur prix',
  },
  reviews: { title: 'Ce qu’en disent les apprenants' },
  faq: {
    title: 'Questions',
    items: [
      ['Hodhod est-il gratuit ?', 'Oui. Tu peux commencer et continuer à apprendre une langue gratuitement. Hodhod Plus ajoute d’autres langues et plus d’aide IA.'],
      ['Comment l’installer sur mon téléphone ?', 'Ouvre l’app dans ton navigateur et choisis « Ajouter à l’écran d’accueil ». Les versions App Store et Google Play arrivent bientôt.'],
      ['Pour quel niveau ?', 'Du tout premier mot au niveau avancé. Tu choisis les mots, donc l’app grandit avec toi.'],
      ['Vais-je perdre mes mots si je change de téléphone ?', 'Non. Tes mots et ta progression sont enregistrés dans ton compte ; connecte-toi sur le nouveau téléphone et tout est là.'],
      ['Mes données sont-elles en sécurité ?', 'Tes mots et ta progression n’appartiennent qu’à toi. Personne d’autre ne les voit, et tu peux supprimer ton compte à tout moment.'],
    ],
  },
  final: { title: 'Crée ta première fiche maintenant', sub: 'L’inscription prend une minute.' },
  footer: { tagline: 'Des fiches intelligentes dans ta propre langue.', legal: 'Mentions légales', languages: 'Langues', contact: 'Contact' },
  suggest: 'Voir cette page en français ?',
}

const tr: SiteCopy = {
  title: 'Hodhod — yeni bir dilin kelimelerini kendi dilinde öğren',
  description:
    'Herhangi bir kelime yaz: Hodhod kendi dilinde anlamlar, dil bilgisi, örnekler ve doğal telaffuzla eksiksiz bir kart hazırlar ve unutmadan hemen önce tekrar etmeni hatırlatır. İngilizce, Almanca, Fransızca, İtalyanca, İspanyolca ve Felemenkçe.',
  nav: { features: 'Özellikler', languages: 'Diller', pricing: 'Fiyatlar', faq: 'SSS', openApp: 'Uygulamayı aç', menu: 'Menü', language: 'Dil' },
  hero: {
    eyebrow: 'Dil öğrenme yolunda yol arkadaşın',
    h1: 'Yeni kelimeleri Hodhod’la daha iyi öğren.',
    lead: 'Hodhod yanında: yeni kelimeleri anlamı, örnekleri, dil bilgisi ve telaffuzuyla öğrenirsin; tam zamanında yapılan tekrarlarla da daha iyi aklında tutarsın.',
    start: 'Ücretsiz başla',
    how: 'Hodhod nasıl çalışır?',
    free: 'Ücretsiz başla · kredi kartı gerekmez',
  },
  stores: { title: 'Her cihazda', ios: 'iPhone ve iPad', android: 'Android', web: 'Her tarayıcı', soon: 'Yakında', get: 'İndir', open: 'Şimdi aç' },
  stats: { title: 'Rakamlarla Hodhod', learners: 'öğrenci', words: 'kaydedilen kelime', reviews: 'tekrar', languages: 'dil' },
  langs: { title: 'Senin dilin. Sıradaki dilin.', sub: 'Hodhod her şeyi zaten konuştuğun dilde anlatır.', speak: 'Konuştuğun dil', learn: 'Öğrendiğin dil' },
  features: {
    title: 'Kelimeleri gerçekten öğrenmek için gereken her şey',
    sub: 'Bir sözlük daha değil: her gün seninle tekrar yapan bir arkadaş.',
    items: [
      ['Saniyeler içinde eksiksiz kart', 'Kendi dilinde anlamlar, renkli cinsiyet, çoğul, fiil çekimleri, örnekler ve doğru seviye — hepsi tek bir kelimeden.'],
      ['Doğru anda tekrar', 'Hodhod hangi kelimenin aklından çıkmak üzere olduğunu bilir ve tam onu gösterir. Günde birkaç dakika yeter.'],
      ['Doğal telaffuz', 'Her kelimeyi ve cümleyi robot gibi değil, doğal bir sesle dinle.'],
      ['Hazır paketler', 'Gerçek hayatın kelimeleri, ders ders: iş, doktor, resmî daire, ev ve daha fazlası.'],
      ['Hikâyeler ve podcastler', 'Kendi kelimelerinle kısa hikâyeler ve cümle cümle dinleyeceğin kısa konuşmalar; bir kelimeye dokun, kartı hazır.'],
      ['Dinle ve konuş', 'Dikte ve konuşma pratiği: dinle ve yaz ya da yüksek sesle söyle ve doğru mu gör.'],
      ['İstediğin saatlerde hatırlatma', 'Günde sekize kadar saat, bir çalar saat gibi. Hodhod sadece yapacak bir şey olduğunda seni çağırır.'],
      ['Arkadaşlarla öğren', 'Arkadaşlarını kodla ekle ve haftalık tabloyu gör — küçük bir rekabet çok işe yarar.'],
    ],
  },
  how: {
    title: 'Nasıl çalışır?',
    steps: [
      ['Kelimeyi yaz', 'İşte, kursta ya da sokakta duyduğun her şey.'],
      ['Kartın hazır', 'Anlam, dil bilgisi, örnekler ve ses. Göz at ve kaydet.'],
      ['Günde birkaç dakika tekrar', 'Bir hatırlatma gelir, birkaç kart tekrar edersin ve kelimeler kalıcı olur.'],
    ],
    shots: ['Hazır bir kart', 'Günlük hedefin', 'Bir kartı tekrar etmek'],
  },
  pricing: {
    title: 'Basit fiyatlar',
    sub: 'Ücretsiz başla. Hodhod gününün bir parçası olunca yükselt.',
    freeName: 'Ücretsiz',
    freePrice: '0 €',
    freeFor: 'sonsuza kadar',
    free: ['Öğrenilecek bir dil', 'Akıllı kartlar ve günlük tekrar', 'Doğal telaffuz', 'Hatırlatmalar ve arkadaşlar'],
    plusName: 'Hodhod Plus',
    plusFor: 'kararlı öğrenciler için',
    plus: ['Ücretsiz sürümdeki her şey', 'Aynı anda birden fazla dil', 'Günde daha fazla yapay zekâ kartı ve hikâye', 'Küçük, bağımsız bir uygulamaya destek'],
    month: 'aylık',
    year: 'yıllık',
    lifetime: 'bir kez, sonsuza kadar',
    soon: 'Yakında',
    start: 'Ücretsiz başla',
    popular: 'En avantajlı',
  },
  reviews: { title: 'Öğrenciler ne diyor' },
  faq: {
    title: 'Sorular',
    items: [
      ['Hodhod ücretsiz mi?', 'Evet. Bir dili ücretsiz başlatıp öğrenmeye devam edebilirsin. Hodhod Plus daha fazla dil ve daha fazla yapay zekâ desteği ekler.'],
      ['Telefonuma nasıl kurarım?', 'Uygulamayı tarayıcında aç ve “Ana Ekrana Ekle”yi seç. App Store ve Google Play sürümleri yakında geliyor.'],
      ['Hangi seviye için?', 'İlk kelimenden ileri seviyeye kadar. Kelimeleri sen seçersin, uygulama da seninle büyür.'],
      ['Telefon değiştirirsem kelimelerim kaybolur mu?', 'Hayır. Kelimelerin ve ilerlemen hesabında kayıtlı; yeni telefonda giriş yap, her şey yerinde.'],
      ['Verilerim güvende mi?', 'Kelimelerin ve ilerlemen yalnızca sana ait. Başka kimse göremez ve hesabını istediğin zaman silebilirsin.'],
    ],
  },
  final: { title: 'İlk kartını şimdi oluştur', sub: 'Kayıt bir dakika sürer.' },
  footer: { tagline: 'Kendi dilinde akıllı kartlar.', legal: 'Yasal', languages: 'Diller', contact: 'İletişim' },
  suggest: 'Bu sayfayı Türkçe görmek ister misin?',
}

const uk: SiteCopy = {
  title: 'Hodhod — вивчай слова нової мови рідною мовою',
  description:
    'Напиши будь-яке слово: Hodhod створить повну картку зі значеннями твоєю мовою, граматикою, прикладами й природною вимовою та нагадає повторити його саме тоді, коли ти почнеш забувати. Англійська, німецька, французька, італійська, іспанська й нідерландська.',
  nav: { features: 'Можливості', languages: 'Мови', pricing: 'Ціни', faq: 'Питання', openApp: 'Відкрити застосунок', menu: 'Меню', language: 'Мова' },
  hero: {
    eyebrow: 'Твій супутник на шляху до нової мови',
    h1: 'Вчи нові слова краще — з Hodhod.',
    lead: 'Hodhod поруч, щоб ти вчив нові слова зі значенням, прикладами, граматикою та вимовою і краще запам’ятовував їх завдяки вчасним повторенням.',
    start: 'Почати безкоштовно',
    how: 'Як працює Hodhod?',
    free: 'Почни безкоштовно · без банківської картки',
  },
  stores: { title: 'На будь-якому пристрої', ios: 'iPhone та iPad', android: 'Android', web: 'Будь-який браузер', soon: 'Незабаром', get: 'Завантажити', open: 'Відкрити зараз' },
  stats: { title: 'Hodhod у цифрах', learners: 'учнів', words: 'збережених слів', reviews: 'повторень', languages: 'мов' },
  langs: { title: 'Твоя мова. Твоя наступна мова.', sub: 'Hodhod пояснює все мовою, якою ти вже говориш.', speak: 'Ти говориш', learn: 'Ти вчиш' },
  features: {
    title: 'Усе, щоб справді вивчати слова',
    sub: 'Не ще один словник, а помічник, який щодня повторює з тобою.',
    items: [
      ['Повна картка за секунди', 'Значення твоєю мовою, рід кольором, множина, форми дієслова, приклади й рівень — усе з одного слова.'],
      ['Повторення в потрібну мить', 'Hodhod знає, яке слово ось-ось забудеться, і показує саме його. Кількох хвилин на день досить.'],
      ['Природна вимова', 'Слухай кожне слово й речення природним голосом, а не роботом.'],
      ['Готові набори', 'Слова для реального життя, урок за уроком: робота, лікар, установи, дім та інше.'],
      ['Історії та подкасти', 'Короткі історії з твоїми словами та короткі розмови, які слухаєш речення за реченням, — торкнися слова, щоб створити картку.'],
      ['Слухати й говорити', 'Диктант і розмовна практика: слухай і пиши або скажи вголос і перевір себе.'],
      ['Нагадування у твій час', 'До восьми разів на день, як будильник. Hodhod кличе лише тоді, коли є що робити.'],
      ['Вчитися з друзями', 'Додавай друзів за кодом і дивись тижневу таблицю — трохи змагання дуже допомагає.'],
    ],
  },
  how: {
    title: 'Як це працює',
    steps: [
      ['Напиши слово', 'Усе, що почув на роботі, на курсах чи на вулиці.'],
      ['Картка готова', 'Значення, граматика, приклади й звук. Переглянь і збережи.'],
      ['Кілька хвилин повторення на день', 'Приходить нагадування, ти повторюєш кілька карток — і слова залишаються з тобою.'],
    ],
    shots: ['Готова картка', 'Твоя денна мета', 'Повторення картки'],
  },
  pricing: {
    title: 'Прості ціни',
    sub: 'Почни безкоштовно. Оновлюйся, коли Hodhod стане частиною твого дня.',
    freeName: 'Безкоштовно',
    freePrice: '0 €',
    freeFor: 'назавжди',
    free: ['Одна мова для вивчення', 'Розумні картки й щоденне повторення', 'Природна вимова', 'Нагадування й друзі'],
    plusName: 'Hodhod Plus',
    plusFor: 'для тих, хто вчиться всерйоз',
    plus: ['Усе з безкоштовного', 'Кілька мов одночасно', 'Більше ШІ-карток та історій щодня', 'Підтримка маленького незалежного застосунку'],
    month: 'на місяць',
    year: 'на рік',
    lifetime: 'один раз, назавжди',
    soon: 'Незабаром',
    start: 'Почати безкоштовно',
    popular: 'Найвигідніше',
  },
  reviews: { title: 'Що кажуть учні' },
  faq: {
    title: 'Питання',
    items: [
      ['Hodhod безкоштовний?', 'Так. Ти можеш почати й далі вчити одну мову безкоштовно. Hodhod Plus додає більше мов і більше допомоги ШІ.'],
      ['Як встановити на телефон?', 'Відкрий застосунок у браузері й обери «На початковий екран». Версії для App Store та Google Play незабаром.'],
      ['Для якого рівня?', 'Від першого слова до високого рівня. Слова обираєш ти, тож застосунок росте разом із тобою.'],
      ['Чи зникнуть слова, якщо я зміню телефон?', 'Ні. Слова й прогрес зберігаються в акаунті; увійди на новому телефоні — і все на місці.'],
      ['Чи безпечні мої дані?', 'Твої слова й прогрес належать лише тобі. Ніхто інший їх не бачить, і ти можеш видалити акаунт будь-коли.'],
    ],
  },
  final: { title: 'Створи першу картку вже зараз', sub: 'Реєстрація займає хвилину.' },
  footer: { tagline: 'Розумні картки твоєю мовою.', legal: 'Правова інформація', languages: 'Мови', contact: 'Контакт' },
  suggest: 'Переглянути цю сторінку українською?',
}

const ru: SiteCopy = {
  title: 'Hodhod — учи слова нового языка на своём языке',
  description:
    'Напиши любое слово: Hodhod создаст полную карточку со значениями на твоём языке, грамматикой, примерами и естественным произношением и напомнит повторить его как раз перед тем, как ты его забудешь. Английский, немецкий, французский, итальянский, испанский и нидерландский.',
  nav: { features: 'Возможности', languages: 'Языки', pricing: 'Цены', faq: 'Вопросы', openApp: 'Открыть приложение', menu: 'Меню', language: 'Язык' },
  hero: {
    eyebrow: 'Твой спутник на пути к новому языку',
    h1: 'Учи новые слова лучше — с Hodhod.',
    lead: 'Hodhod рядом, чтобы ты учил новые слова со значением, примерами, грамматикой и произношением и лучше запоминал их благодаря повторениям в нужное время.',
    start: 'Начать бесплатно',
    how: 'Как работает Hodhod?',
    free: 'Начни бесплатно · без банковской карты',
  },
  stores: { title: 'На любом устройстве', ios: 'iPhone и iPad', android: 'Android', web: 'Любой браузер', soon: 'Скоро', get: 'Скачать', open: 'Открыть сейчас' },
  stats: { title: 'Hodhod в цифрах', learners: 'учеников', words: 'сохранённых слов', reviews: 'повторений', languages: 'языков' },
  langs: { title: 'Твой язык. Твой следующий язык.', sub: 'Hodhod объясняет всё на языке, на котором ты уже говоришь.', speak: 'Ты говоришь', learn: 'Ты учишь' },
  features: {
    title: 'Всё, чтобы по-настоящему учить слова',
    sub: 'Не ещё один словарь, а помощник, который каждый день повторяет с тобой.',
    items: [
      ['Полная карточка за секунды', 'Значения на твоём языке, род цветом, множественное число, формы глагола, примеры и уровень — всё из одного слова.'],
      ['Повторение в нужный момент', 'Hodhod знает, какое слово вот-вот забудется, и показывает именно его. Нескольких минут в день достаточно.'],
      ['Естественное произношение', 'Слушай каждое слово и предложение естественным голосом, а не роботом.'],
      ['Готовые наборы', 'Слова для настоящей жизни, урок за уроком: работа, врач, учреждения, дом и другое.'],
      ['Истории и подкасты', 'Короткие истории с твоими словами и короткие разговоры, которые слушаешь предложение за предложением, — нажми на слово, чтобы сделать карточку.'],
      ['Слушать и говорить', 'Диктант и разговорная практика: слушай и пиши или скажи вслух и проверь себя.'],
      ['Напоминания в твоё время', 'До восьми раз в день, как будильник. Hodhod зовёт, только когда есть что делать.'],
      ['Учиться с друзьями', 'Добавляй друзей по коду и смотри недельную таблицу — немного соревнования очень помогает.'],
    ],
  },
  how: {
    title: 'Как это работает',
    steps: [
      ['Напиши слово', 'Всё, что услышал на работе, на курсах или на улице.'],
      ['Карточка готова', 'Значение, грамматика, примеры и звук. Посмотри и сохрани.'],
      ['Несколько минут повторения в день', 'Приходит напоминание, ты повторяешь несколько карточек — и слова остаются с тобой.'],
    ],
    shots: ['Готовая карточка', 'Твоя цель на день', 'Повторение карточки'],
  },
  pricing: {
    title: 'Простые цены',
    sub: 'Начни бесплатно. Переходи на Plus, когда Hodhod станет частью твоего дня.',
    freeName: 'Бесплатно',
    freePrice: '0 €',
    freeFor: 'навсегда',
    free: ['Один язык для изучения', 'Умные карточки и ежедневное повторение', 'Естественное произношение', 'Напоминания и друзья'],
    plusName: 'Hodhod Plus',
    plusFor: 'для тех, кто учится всерьёз',
    plus: ['Всё из бесплатного', 'Несколько языков одновременно', 'Больше ИИ-карточек и историй в день', 'Поддержка маленького независимого приложения'],
    month: 'в месяц',
    year: 'в год',
    lifetime: 'один раз, навсегда',
    soon: 'Скоро',
    start: 'Начать бесплатно',
    popular: 'Выгоднее всего',
  },
  reviews: { title: 'Что говорят ученики' },
  faq: {
    title: 'Вопросы',
    items: [
      ['Hodhod бесплатный?', 'Да. Ты можешь начать и продолжать учить один язык бесплатно. Hodhod Plus добавляет больше языков и больше помощи ИИ.'],
      ['Как установить на телефон?', 'Открой приложение в браузере и выбери «На экран „Домой“». Версии для App Store и Google Play скоро.'],
      ['Для какого уровня?', 'От первого слова до продвинутого уровня. Слова выбираешь ты, поэтому приложение растёт вместе с тобой.'],
      ['Пропадут ли слова, если я сменю телефон?', 'Нет. Слова и прогресс хранятся в аккаунте; войди на новом телефоне — и всё на месте.'],
      ['Мои данные в безопасности?', 'Твои слова и прогресс принадлежат только тебе. Никто другой их не видит, и ты можешь удалить аккаунт в любой момент.'],
    ],
  },
  final: { title: 'Создай первую карточку прямо сейчас', sub: 'Регистрация занимает минуту.' },
  footer: { tagline: 'Умные карточки на твоём языке.', legal: 'Правовая информация', languages: 'Языки', contact: 'Контакт' },
  suggest: 'Открыть эту страницу на русском?',
}

const ar: SiteCopy = {
  title: 'هدهد — تعلّم كلمات لغة جديدة بلغتك أنت',
  description:
    'اكتب أي كلمة: يصنع هدهد بطاقة كاملة بالمعاني بلغتك والقواعد والأمثلة والنطق الطبيعي، ثم يذكّرك بمراجعتها قبل أن تنساها مباشرة. الإنجليزية والألمانية والفرنسية والإيطالية والإسبانية والهولندية.',
  nav: { features: 'المزايا', languages: 'اللغات', pricing: 'الأسعار', faq: 'الأسئلة', openApp: 'افتح التطبيق', menu: 'القائمة', language: 'اللغة' },
  hero: {
    eyebrow: 'رفيقك في طريق تعلّم اللغة',
    h1: 'تعلّم الكلمات الجديدة بشكل أفضل مع هدهد.',
    lead: 'هدهد رفيقك لتتعلّم الكلمات الجديدة بمعناها وأمثلتها وقواعدها ونطقها، وتحفظها بشكل أفضل بمراجعات في وقتها.',
    start: 'ابدأ مجانًا',
    how: 'كيف يعمل هدهد؟',
    free: 'ابدأ مجانًا · دون حاجة إلى بطاقة بنكية',
  },
  stores: { title: 'على كل الأجهزة', ios: 'آيفون وآيباد', android: 'أندرويد', web: 'أي متصفح', soon: 'قريبًا', get: 'تنزيل', open: 'افتحه الآن' },
  stats: { title: 'هدهد بالأرقام', learners: 'متعلّم', words: 'كلمة محفوظة', reviews: 'مراجعة', languages: 'لغات' },
  langs: { title: 'لغتك. لغتك التالية.', sub: 'يشرح هدهد كل شيء باللغة التي تتحدثها بالفعل.', speak: 'لغتك', learn: 'تتعلّم' },
  features: {
    title: 'كل ما تحتاجه لتتعلّم الكلمات حقًا',
    sub: 'ليس قاموسًا آخر، بل رفيق يراجع معك كل يوم.',
    items: [
      ['بطاقة كاملة في ثوانٍ', 'المعاني بلغتك، والجنس بالألوان، والجمع، وتصريف الأفعال، والأمثلة، والمستوى المناسب — كلها من كلمة واحدة.'],
      ['مراجعة في الوقت المناسب', 'يعرف هدهد أي كلمة على وشك أن تُنسى، فيعرضها عليك تحديدًا. بضع دقائق يوميًا تكفي.'],
      ['نطق طبيعي', 'استمع إلى كل كلمة وجملة بصوت طبيعي، لا بصوت آلي.'],
      ['حزم جاهزة', 'كلمات الحياة الحقيقية، درسًا بعد درس: العمل والطبيب والدوائر الرسمية والبيت وغيرها.'],
      ['قصص وبودكاست', 'قصص قصيرة بكلماتك أنت، ومحادثات قصيرة تستمع إليها جملة بجملة — اضغط على أي كلمة لتصنع لها بطاقة.'],
      ['استمع وتكلّم', 'إملاء وتدريب على المحادثة: استمع واكتب، أو قلها بصوت عالٍ وتحقّق من صحتها.'],
      ['تذكيرات في أوقاتك', 'حتى ثماني مرات في اليوم، مثل المنبّه. لا يناديك هدهد إلا عندما يكون هناك ما تفعله.'],
      ['تعلّم مع الأصدقاء', 'أضف أصدقاءك برمز وشاهد لوحة الأسبوع، فقليل من المنافسة يساعد كثيرًا.'],
    ],
  },
  how: {
    title: 'كيف يعمل؟',
    steps: [
      ['اكتب الكلمة', 'أي شيء سمعته في العمل أو الصف أو الشارع.'],
      ['بطاقتك جاهزة', 'المعنى والقواعد والأمثلة والصوت. ألقِ نظرة واحفظها.'],
      ['راجع بضع دقائق يوميًا', 'يصلك تذكير، فتراجع بضع بطاقات، وتبقى الكلمات معك إلى الأبد.'],
    ],
    shots: ['بطاقة جاهزة', 'هدفك اليومي', 'مراجعة بطاقة'],
  },
  pricing: {
    title: 'أسعار بسيطة',
    sub: 'ابدأ مجانًا، وترقَّ عندما يصبح هدهد جزءًا من يومك.',
    freeName: 'مجاني',
    freePrice: '0 €',
    freeFor: 'للأبد',
    free: ['لغة واحدة للتعلّم', 'بطاقات ذكية ومراجعة يومية', 'نطق طبيعي', 'تذكيرات وأصدقاء'],
    plusName: 'هدهد بلس',
    plusFor: 'للمتعلّمين الجادّين',
    plus: ['كل ما في المجاني', 'عدة لغات في الوقت نفسه', 'بطاقات وقصص ذكية أكثر يوميًا', 'ادعم تطبيقًا صغيرًا مستقلًا'],
    month: 'شهريًا',
    year: 'سنويًا',
    lifetime: 'مرة واحدة، للأبد',
    soon: 'قريبًا',
    start: 'ابدأ مجانًا',
    popular: 'الأوفر',
  },
  reviews: { title: 'ماذا يقول المتعلّمون' },
  faq: {
    title: 'الأسئلة الشائعة',
    items: [
      ['هل هدهد مجاني؟', 'نعم. يمكنك أن تبدأ وتواصل تعلّم لغة واحدة مجانًا. يضيف هدهد بلس لغات أكثر ومساعدة ذكية أكبر.'],
      ['كيف أثبّته على هاتفي؟', 'افتح التطبيق في المتصفح واختر «إضافة إلى الشاشة الرئيسية». نسختا App Store وGoogle Play قادمتان قريبًا.'],
      ['لأي مستوى يناسب؟', 'من أول كلمة إلى المستوى المتقدم. أنت تختار الكلمات، فيكبر التطبيق معك.'],
      ['هل أفقد كلماتي إذا غيّرت هاتفي؟', 'لا. كلماتك وتقدّمك محفوظة في حسابك؛ سجّل الدخول على الهاتف الجديد وستجد كل شيء.'],
      ['هل بياناتي آمنة؟', 'كلماتك وتقدّمك لك وحدك. لا يراها أحد غيرك، ويمكنك حذف حسابك متى شئت.'],
    ],
  },
  final: { title: 'اصنع بطاقتك الأولى الآن', sub: 'التسجيل يستغرق دقيقة واحدة.' },
  footer: { tagline: 'بطاقات ذكية بلغتك أنت.', legal: 'معلومات قانونية', languages: 'اللغات', contact: 'تواصل' },
  suggest: 'هل تريد عرض هذه الصفحة بالعربية؟',
}

const es: SiteCopy = {
  title: 'Hodhod — aprende las palabras de un nuevo idioma en tu propio idioma',
  description:
    'Escribe cualquier palabra: Hodhod crea una tarjeta completa con los significados en tu idioma, gramática, ejemplos y pronunciación natural, y te recuerda repasarla justo antes de que la olvides. Inglés, alemán, francés, italiano, español y neerlandés.',
  nav: { features: 'Funciones', languages: 'Idiomas', pricing: 'Precios', faq: 'Preguntas', openApp: 'Abrir la app', menu: 'Menú', language: 'Idioma' },
  hero: {
    eyebrow: 'Tu compañero en el camino de un nuevo idioma',
    h1: 'Aprende mejor las palabras nuevas, con Hodhod.',
    lead: 'Hodhod te acompaña para que aprendas palabras nuevas con su significado, ejemplos, gramática y pronunciación, y las recuerdes mejor con repasos en el momento justo.',
    start: 'Empieza gratis',
    how: '¿Cómo funciona Hodhod?',
    free: 'Empieza gratis · sin tarjeta bancaria',
  },
  stores: { title: 'En todos tus dispositivos', ios: 'iPhone y iPad', android: 'Android', web: 'Cualquier navegador', soon: 'Muy pronto', get: 'Descargar', open: 'Abrir ahora' },
  stats: { title: 'Hodhod en cifras', learners: 'estudiantes', words: 'palabras guardadas', reviews: 'repasos', languages: 'idiomas' },
  langs: { title: 'Tu idioma. Tu próximo idioma.', sub: 'Hodhod lo explica todo en el idioma que ya hablas.', speak: 'Hablas', learn: 'Aprendes' },
  features: {
    title: 'Todo lo que necesitas para aprender palabras de verdad',
    sub: 'No es otro diccionario: es un compañero que repasa contigo cada día.',
    items: [
      ['Una tarjeta completa en segundos', 'Significados en tu idioma, género con colores, plural, formas verbales, ejemplos y el nivel adecuado, todo a partir de una palabra.'],
      ['Repasa en el momento justo', 'Hodhod sabe qué palabra está a punto de escaparse y te muestra justo esa. Unos minutos al día bastan.'],
      ['Pronunciación natural', 'Escucha cada palabra y frase con una voz natural, no robótica.'],
      ['Paquetes listos', 'Palabras de la vida real, lección a lección: trabajo, médico, trámites, casa y más.'],
      ['Historias y pódcasts', 'Historias cortas con tus propias palabras y conversaciones cortas para escuchar frase a frase: toca una palabra para crear su tarjeta.'],
      ['Escucha y habla', 'Dictado y práctica oral: escucha y escribe, o dilo en voz alta y comprueba si está bien.'],
      ['Recordatorios a tu hora', 'Hasta ocho horas al día, como un despertador. Hodhod solo te llama cuando hay algo que hacer.'],
      ['Aprende con amigos', 'Añade amigos con un código y mira la tabla semanal: un pequeño empujón ayuda mucho.'],
    ],
  },
  how: {
    title: 'Cómo funciona',
    steps: [
      ['Escribe la palabra', 'Cualquier cosa que oíste en el trabajo, en clase o en la calle.'],
      ['Tu tarjeta está lista', 'Significado, gramática, ejemplos y sonido. Échale un vistazo y guárdala.'],
      ['Repasa unos minutos al día', 'Llega un recordatorio, repasas unas tarjetas y las palabras se quedan contigo para siempre.'],
    ],
    shots: ['Una tarjeta terminada', 'Tu meta diaria', 'Repasando una tarjeta'],
  },
  pricing: {
    title: 'Precios sencillos',
    sub: 'Empieza gratis. Mejora cuando Hodhod sea parte de tu día.',
    freeName: 'Gratis',
    freePrice: '0 €',
    freeFor: 'para siempre',
    free: ['Un idioma para aprender', 'Tarjetas inteligentes y repaso diario', 'Pronunciación natural', 'Recordatorios y amigos'],
    plusName: 'Hodhod Plus',
    plusFor: 'para estudiantes constantes',
    plus: ['Todo lo de Gratis', 'Varios idiomas a la vez', 'Más tarjetas e historias con IA cada día', 'Apoya una pequeña app independiente'],
    month: 'al mes',
    year: 'al año',
    lifetime: 'un pago, para siempre',
    soon: 'Muy pronto',
    start: 'Empieza gratis',
    popular: 'Mejor precio',
  },
  reviews: { title: 'Lo que dicen los estudiantes' },
  faq: {
    title: 'Preguntas',
    items: [
      ['¿Hodhod es gratis?', 'Sí. Puedes empezar y seguir aprendiendo un idioma gratis. Hodhod Plus añade más idiomas y más ayuda de IA.'],
      ['¿Cómo lo instalo en el móvil?', 'Abre la app en el navegador y elige «Añadir a pantalla de inicio». Las versiones de App Store y Google Play llegarán pronto.'],
      ['¿Para qué nivel es?', 'Desde la primera palabra hasta nivel avanzado. Tú eliges las palabras, así que la app crece contigo.'],
      ['¿Pierdo mis palabras si cambio de móvil?', 'No. Tus palabras y tu progreso se guardan en tu cuenta; inicia sesión en el móvil nuevo y todo estará ahí.'],
      ['¿Mis datos están seguros?', 'Tus palabras y tu progreso son solo tuyos. Nadie más los ve y puedes borrar tu cuenta cuando quieras.'],
    ],
  },
  final: { title: 'Crea tu primera tarjeta ahora', sub: 'Registrarte lleva un minuto.' },
  footer: { tagline: 'Tarjetas inteligentes en tu propio idioma.', legal: 'Aviso legal', languages: 'Idiomas', contact: 'Contacto' },
  suggest: '¿Ver esta página en español?',
}

const nl: SiteCopy = {
  title: 'Hodhod — leer de woorden van een nieuwe taal, in je eigen taal',
  description:
    'Typ een woord: Hodhod maakt een complete flashcard met betekenissen in jouw taal, grammatica, voorbeelden en natuurlijke uitspraak, en herinnert je eraan te herhalen vlak voordat je het vergeet. Engels, Duits, Frans, Italiaans, Spaans en Nederlands.',
  nav: { features: 'Functies', languages: 'Talen', pricing: 'Prijzen', faq: 'Vragen', openApp: 'App openen', menu: 'Menu', language: 'Taal' },
  hero: {
    eyebrow: 'Je metgezel op weg naar een nieuwe taal',
    h1: 'Leer nieuwe woorden beter, met Hodhod.',
    lead: 'Hodhod is er voor je: je leert nieuwe woorden met betekenis, voorbeelden, grammatica en uitspraak, en onthoudt ze beter door ze op het juiste moment te herhalen.',
    start: 'Gratis beginnen',
    how: 'Hoe werkt Hodhod?',
    free: 'Begin gratis · geen creditcard nodig',
  },
  stores: { title: 'Op elk apparaat', ios: 'iPhone en iPad', android: 'Android', web: 'Elke browser', soon: 'Binnenkort', get: 'Downloaden', open: 'Nu openen' },
  stats: { title: 'Hodhod in cijfers', learners: 'leerlingen', words: 'opgeslagen woorden', reviews: 'herhalingen', languages: 'talen' },
  langs: { title: 'Jouw taal. Jouw volgende taal.', sub: 'Hodhod legt alles uit in de taal die je al spreekt.', speak: 'Je spreekt', learn: 'Je leert' },
  features: {
    title: 'Alles om woorden echt te leren',
    sub: 'Geen zoveelste woordenboek, maar een maatje dat elke dag met je herhaalt.',
    items: [
      ['Een complete kaart in seconden', 'Betekenissen in jouw taal, lidwoord in kleur, meervoud, werkwoordsvormen, voorbeelden en het juiste niveau — allemaal uit één woord.'],
      ['Herhalen op het juiste moment', 'Hodhod weet welk woord op het punt staat te verdwijnen en laat precies dat zien. Een paar minuten per dag is genoeg.'],
      ['Natuurlijke uitspraak', 'Hoor elk woord en elke zin met een natuurlijke stem, niet als een robot.'],
      ['Kant-en-klare pakketten', 'Woorden voor het echte leven, les voor les: werk, dokter, gemeente, thuis en meer.'],
      ['Verhalen en podcasts', 'Korte verhalen met je eigen woorden en korte gesprekken om zin voor zin te volgen — tik op een woord om er een kaart van te maken.'],
      ['Luisteren en spreken', 'Dictee en spreekoefening: luister en typ, of zeg het hardop en kijk of het klopt.'],
      ['Herinneringen op jouw tijden', 'Tot acht keer per dag, als een wekker. Hodhod roept je alleen als er iets te doen is.'],
      ['Leren met vrienden', 'Voeg vrienden toe met een code en bekijk het weekoverzicht — een klein duwtje helpt enorm.'],
    ],
  },
  how: {
    title: 'Hoe het werkt',
    steps: [
      ['Typ het woord', 'Alles wat je op je werk, in de les of op straat hoorde.'],
      ['Je kaart is klaar', 'Betekenis, grammatica, voorbeelden en geluid. Bekijk hem en sla hem op.'],
      ['Een paar minuten per dag herhalen', 'Er komt een herinnering, je herhaalt een paar kaarten en de woorden blijven voorgoed hangen.'],
    ],
    shots: ['Een kant-en-klare kaart', 'Je dagdoel', 'Een kaart herhalen'],
  },
  pricing: {
    title: 'Eenvoudige prijzen',
    sub: 'Begin gratis. Upgrade wanneer Hodhod bij je dag hoort.',
    freeName: 'Gratis',
    freePrice: '0 €',
    freeFor: 'voor altijd',
    free: ['Eén taal om te leren', 'Slimme kaarten en dagelijkse herhaling', 'Natuurlijke uitspraak', 'Herinneringen en vrienden'],
    plusName: 'Hodhod Plus',
    plusFor: 'voor serieuze leerlingen',
    plus: ['Alles uit Gratis', 'Meerdere talen tegelijk', 'Meer AI-kaarten en verhalen per dag', 'Steun een kleine onafhankelijke app'],
    month: 'per maand',
    year: 'per jaar',
    lifetime: 'eenmalig, voor altijd',
    soon: 'Binnenkort',
    start: 'Gratis beginnen',
    popular: 'Voordeligst',
  },
  reviews: { title: 'Wat leerlingen zeggen' },
  faq: {
    title: 'Vragen',
    items: [
      ['Is Hodhod gratis?', 'Ja. Je kunt gratis beginnen en één taal blijven leren. Hodhod Plus voegt meer talen en meer AI-hulp toe.'],
      ['Hoe installeer ik het op mijn telefoon?', 'Open de app in je browser en kies „Zet op beginscherm”. De versies voor de App Store en Google Play komen binnenkort.'],
      ['Voor welk niveau is het?', 'Van je allereerste woord tot gevorderd. Jij kiest de woorden, dus de app groeit met je mee.'],
      ['Raak ik mijn woorden kwijt als ik een nieuwe telefoon neem?', 'Nee. Je woorden en voortgang staan in je account; log in op de nieuwe telefoon en alles is er.'],
      ['Zijn mijn gegevens veilig?', 'Je woorden en voortgang zijn alleen van jou. Niemand anders ziet ze en je kunt je account altijd verwijderen.'],
    ],
  },
  final: { title: 'Maak nu je eerste kaart', sub: 'Aanmelden duurt een minuut.' },
  footer: { tagline: 'Slimme flashcards in je eigen taal.', legal: 'Juridisch', languages: 'Talen', contact: 'Contact' },
  suggest: 'Deze pagina in het Nederlands bekijken?',
}

const it: SiteCopy = {
  title: 'Hodhod — impara le parole di una nuova lingua, nella tua lingua',
  description:
    'Scrivi una parola: Hodhod crea una flashcard completa con i significati nella tua lingua, grammatica, esempi e pronuncia naturale, e ti ricorda di ripassarla poco prima che tu la dimentichi. Inglese, tedesco, francese, italiano, spagnolo e olandese.',
  nav: { features: 'Funzioni', languages: 'Lingue', pricing: 'Prezzi', faq: 'Domande', openApp: 'Apri l’app', menu: 'Menu', language: 'Lingua' },
  hero: {
    eyebrow: 'Il tuo compagno nel percorso di una nuova lingua',
    h1: 'Impara meglio le parole nuove, con Hodhod.',
    lead: 'Hodhod ti accompagna mentre impari parole nuove con significato, esempi, grammatica e pronuncia, e ti aiuta a ricordarle meglio con ripassi al momento giusto.',
    start: 'Inizia gratis',
    how: 'Come funziona Hodhod?',
    free: 'Inizia gratis · senza carta di credito',
  },
  stores: { title: 'Su ogni dispositivo', ios: 'iPhone e iPad', android: 'Android', web: 'Qualsiasi browser', soon: 'In arrivo', get: 'Scarica', open: 'Apri ora' },
  stats: { title: 'Hodhod in numeri', learners: 'studenti', words: 'parole salvate', reviews: 'ripassi fatti', languages: 'lingue' },
  langs: { title: 'La tua lingua. La tua prossima lingua.', sub: 'Hodhod spiega tutto nella lingua che parli già.', speak: 'Parli', learn: 'Impari' },
  features: {
    title: 'Tutto quello che serve per imparare davvero le parole',
    sub: 'Non un altro dizionario: un compagno che ripassa con te ogni giorno.',
    items: [
      ['Una carta completa in pochi secondi', 'Significati nella tua lingua, genere a colori, plurali, forme verbali, esempi e il livello giusto: tutto da una sola parola.'],
      ['Ripassa al momento giusto', 'Hodhod sa quale parola stai per dimenticare e ti mostra proprio quella. Bastano pochi minuti al giorno.'],
      ['Pronuncia naturale', 'Ascolta ogni parola e ogni frase con una voce naturale, non da robot.'],
      ['Pacchetti pronti', 'Parole per la vita reale, lezione per lezione: lavoro, medico, ufficio, casa e altro.'],
      ['Storie e podcast', 'Brevi storie con le tue parole e brevi conversazioni da seguire frase per frase: tocca una parola per farne una carta.'],
      ['Ascolta e parla', 'Dettato ed esercizi orali: ascolta e scrivi, oppure dillo ad alta voce e scopri se era giusto.'],
      ['Promemoria ai tuoi orari', 'Scegli fino a otto orari al giorno, come una sveglia. Hodhod ti chiama solo quando c’è qualcosa da fare.'],
      ['Impara con gli amici', 'Aggiungi amici con un codice e guarda la classifica della settimana: una piccola spinta fa molto.'],
    ],
  },
  how: {
    title: 'Come funziona',
    steps: [
      ['Scrivi la parola', 'Qualsiasi cosa tu abbia sentito al lavoro, a lezione o per strada.'],
      ['La tua carta è pronta', 'Significato, grammatica, esempi e audio. Dai un’occhiata e salvala.'],
      ['Ripassa pochi minuti al giorno', 'Arriva un promemoria, ripassi qualche carta e le parole restano con te per sempre.'],
    ],
    shots: ['Una carta finita', 'Il tuo obiettivo del giorno', 'Il ripasso di una carta'],
  },
  pricing: {
    title: 'Prezzi semplici',
    sub: 'Inizia gratis. Passa a Plus quando Hodhod diventa parte della tua giornata.',
    freeName: 'Gratis',
    freePrice: '0 €',
    freeFor: 'per sempre',
    free: ['Una lingua da imparare', 'Carte intelligenti e ripasso quotidiano', 'Pronuncia naturale', 'Promemoria e amici'],
    plusName: 'Hodhod Plus',
    plusFor: 'per chi studia sul serio',
    plus: ['Tutto quello che c’è in Gratis', 'Più lingue contemporaneamente', 'Più carte e storie con l’IA ogni giorno', 'Sostieni una piccola app indipendente'],
    month: 'al mese',
    year: 'all’anno',
    lifetime: 'una volta, per sempre',
    soon: 'In arrivo',
    start: 'Inizia gratis',
    popular: 'Il più conveniente',
  },
  reviews: { title: 'Cosa dice chi studia' },
  faq: {
    title: 'Domande',
    items: [
      ['Hodhod è gratis?', 'Sì. Puoi iniziare e continuare a imparare una lingua gratis. Hodhod Plus aggiunge più lingue e più aiuto dall’IA.'],
      ['Come lo installo sul telefono?', 'Apri l’app nel browser e scegli «Aggiungi a schermata Home». Le versioni per App Store e Google Play arriveranno presto.'],
      ['Per quale livello è?', 'Dalla tua primissima parola al livello avanzato. Le parole le scegli tu, quindi l’app cresce con te.'],
      ['Perdo le mie parole se cambio telefono?', 'No. Parole e progressi sono salvati nel tuo account: accedi dal nuovo telefono e ritrovi tutto.'],
      ['I miei dati sono al sicuro?', 'Le tue parole e i tuoi progressi sono solo tuoi. Nessun altro può vederli e puoi eliminare l’account in qualsiasi momento.'],
    ],
  },
  final: { title: 'Crea ora la tua prima carta', sub: 'Registrarsi richiede un minuto.' },
  footer: { tagline: 'Flashcard intelligenti nella tua lingua.', legal: 'Note legali', languages: 'Lingue', contact: 'Contatti' },
  suggest: 'Vuoi vedere questa pagina in italiano?',
}

export const SITE_COPY = { en, fa, de, fr, it, tr, uk, ru, ar, es, nl } as const
