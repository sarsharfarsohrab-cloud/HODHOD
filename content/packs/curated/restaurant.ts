/**
 * Hand-written packs for one topic: restaurant and café (German for Persian speakers).
 * Unlike the list packs, every card here is written out in full — nothing is left to the AI —
 * and the words come in named groups. `scripts/curated-packs.ts` turns this into full cards,
 * checks every one against the card schema and writes the import files.
 *
 * Written for Hodhod; not taken from any book. Not yet reviewed by a teacher.
 */
import type { CuratedPack } from './types.ts'

export const restaurantWords: CuratedPack = {
  slug: 'restaurant-words',
  kind: 'words',
  level: 'basic',
  emoji: '🍽️',
  title: 'رستوران و کافه: واژه‌ها',
  description:
    'همهٔ واژه‌هایی که در کافه و رستوران می‌بینی و می‌شنوی: آدم‌ها و جاها، منو، نوشیدنی‌ها و غذاها، ظرف‌های روی میز، مزه‌ها، رژیم غذایی و حساب.',
  groups: [
    {
      title: 'جاها و آدم‌ها',
      words: [
        { w: 'Restaurant', g: 'n', pl: 'Restaurants', lv: 'A1', fa: 'رستوران', ex: ['Das Restaurant ist heute voll.', 'رستوران امروز پر است.'] },
        { w: 'Café', g: 'n', pl: 'Cafés', lv: 'A1', fa: 'کافه', ex: ['Wir treffen uns im Café.', 'در کافه همدیگر را می‌بینیم.'] },
        { w: 'Kneipe', g: 'f', pl: 'Kneipen', lv: 'A2', fa: 'میخانهٔ ساده؛ پاتوق', ex: ['Die Kneipe ist gleich um die Ecke.', 'میخانه همین سر کوچه است.'], tip: 'Kneipe جای ساده و خودمانی برای نوشیدنی است. برای غذا خوردن معمولاً Restaurant یا Gasthaus می‌گویند.' },
        { w: 'Imbiss', g: 'm', pl: 'Imbisse', lv: 'A2', fa: 'غذاخوری سرپایی؛ خوراک سبک', ex: ['Am Imbiss gibt es Pommes.', 'در غذاخوری سرپایی سیب‌زمینی سرخ‌کرده هست.'] },
        { w: 'Bäckerei', g: 'f', pl: 'Bäckereien', lv: 'A1', fa: 'نانوایی', ex: ['Die Bäckerei öffnet um sechs Uhr.', 'نانوایی ساعت شش باز می‌شود.'], tip: 'در آلمان بیشتر نانوایی‌ها قهوه و کیک هم دارند و می‌شود همان‌جا نشست.' },
        { w: 'Kellner', g: 'm', pl: 'Kellner', lv: 'A1', fa: 'گارسون (مرد)', ex: ['Der Kellner bringt die Karte.', 'گارسون منو را می‌آورد.'], tip: 'برای زن: die Kellnerin. واژهٔ die Bedienung هم به خود گارسون گفته می‌شود و هم به «سرویس‌دهی».' },
        { w: 'Kellnerin', g: 'f', pl: 'Kellnerinnen', lv: 'A1', fa: 'گارسون (زن)', ex: ['Die Kellnerin ist sehr freundlich.', 'گارسون خیلی خوش‌برخورد است.'] },
        { w: 'Bedienung', g: 'f', pl: 'Bedienungen', lv: 'A2', fa: 'سرویس‌دهی؛ گارسون', ex: ['Die Bedienung kommt gleich.', 'گارسون الان می‌آید.'] },
        { w: 'Koch', g: 'm', pl: 'Köche', lv: 'A1', fa: 'آشپز (مرد)', ex: ['Der Koch arbeitet in der Küche.', 'آشپز در آشپزخانه کار می‌کند.'], tip: 'برای زن: die Köchin.' },
        { w: 'Gast', g: 'm', pl: 'Gäste', lv: 'A1', fa: 'مهمان؛ مشتری رستوران', ex: ['Die Gäste warten auf das Essen.', 'مشتری‌ها منتظر غذا هستند.'] },
      ],
    },
    {
      title: 'بخش‌های رستوران',
      words: [
        { w: 'Eingang', g: 'm', pl: 'Eingänge', lv: 'A1', fa: 'ورودی', ex: ['Wir warten am Eingang.', 'کنار ورودی منتظر می‌مانیم.'] },
        { w: 'Ausgang', g: 'm', pl: 'Ausgänge', lv: 'A1', fa: 'خروجی', ex: ['Der Ausgang ist dort hinten.', 'خروجی آن پشت است.'] },
        { w: 'Platz', g: 'm', pl: 'Plätze', lv: 'A1', fa: 'جا؛ صندلی خالی', ex: ['Ist dieser Platz noch frei?', 'این جا هنوز خالی است؟'] },
        { w: 'Terrasse', g: 'f', pl: 'Terrassen', lv: 'A2', fa: 'تراس؛ فضای بیرون', ex: ['Im Sommer sitzen wir auf der Terrasse.', 'تابستان روی تراس می‌نشینیم.'] },
        { w: 'Theke', g: 'f', pl: 'Theken', lv: 'A2', fa: 'پیشخوان', ex: ['Bitte bestellen Sie an der Theke.', 'لطفاً کنار پیشخوان سفارش بدهید.'], tip: 'در خیلی از کافه‌ها و نانوایی‌ها گارسون سر میز نمی‌آید و باید کنار Theke سفارش بدهی و همان‌جا حساب کنی.' },
        { w: 'Küche', g: 'f', pl: 'Küchen', lv: 'A1', fa: 'آشپزخانه', ex: ['Die Küche schließt um zehn Uhr.', 'آشپزخانه ساعت ده می‌بندد.'], tip: 'Küche معنی «سبک آشپزی» هم می‌دهد: die deutsche Küche یعنی غذاهای آلمانی.' },
        { w: 'Toilette', g: 'f', pl: 'Toiletten', lv: 'A1', fa: 'دستشویی', ex: ['Wo ist die Toilette, bitte?', 'ببخشید، دستشویی کجاست؟'] },
        { w: 'Kasse', g: 'f', pl: 'Kassen', lv: 'A1', fa: 'صندوق', ex: ['Bitte zahlen Sie an der Kasse.', 'لطفاً کنار صندوق پرداخت کنید.'] },
      ],
    },
    {
      title: 'منو و وعده‌ها',
      words: [
        { w: 'Speisekarte', g: 'f', pl: 'Speisekarten', lv: 'A1', fa: 'منو (فهرست غذا)', ex: ['Die Speisekarte ist auf Deutsch.', 'منو به آلمانی است.'] },
        { w: 'Getränkekarte', g: 'f', pl: 'Getränkekarten', lv: 'A2', fa: 'فهرست نوشیدنی‌ها', ex: ['Hier ist die Getränkekarte.', 'این فهرست نوشیدنی‌هاست.'] },
        { w: 'Menü', g: 'n', pl: 'Menüs', lv: 'A2', fa: 'غذای چندمرحله‌ای با قیمت ثابت', ex: ['Das Menü hat drei Gänge.', 'این منو سه مرحله دارد.'], tip: 'مراقب باش: das Menü در آلمانی «فهرست غذا» نیست. فهرست غذا die Speisekarte است.' },
        { w: 'Frühstück', g: 'n', pl: 'Frühstücke', lv: 'A1', fa: 'صبحانه', ex: ['Das Frühstück gibt es bis elf Uhr.', 'صبحانه تا ساعت یازده هست.'] },
        { w: 'Mittagessen', g: 'n', pl: 'Mittagessen', lv: 'A1', fa: 'ناهار', ex: ['Das Mittagessen war gut.', 'ناهار خوب بود.'] },
        { w: 'Abendessen', g: 'n', pl: 'Abendessen', lv: 'A1', fa: 'شام', ex: ['Das Abendessen ist um sieben.', 'شام ساعت هفت است.'] },
        { w: 'Vorspeise', g: 'f', pl: 'Vorspeisen', lv: 'A2', fa: 'پیش‌غذا', ex: ['Als Vorspeise nehme ich Salat.', 'برای پیش‌غذا سالاد می‌گیرم.'] },
        { w: 'Hauptgericht', g: 'n', pl: 'Hauptgerichte', lv: 'A2', fa: 'غذای اصلی', ex: ['Das Hauptgericht kommt gleich.', 'غذای اصلی الان می‌آید.'] },
        { w: 'Beilage', g: 'f', pl: 'Beilagen', lv: 'A2', fa: 'مخلفات کنار غذا', ex: ['Als Beilage gibt es Reis oder Kartoffeln.', 'کنار غذا برنج یا سیب‌زمینی هست.'] },
        { w: 'Nachtisch', g: 'm', pl: 'Nachtische', lv: 'A1', fa: 'دسر', ex: ['Möchten Sie einen Nachtisch?', 'دسر میل دارید؟'], tip: 'die Nachspeise و das Dessert همین معنی را دارند. Nachtisch روزمره‌تر است.' },
        { w: 'Tagesgericht', g: 'n', pl: 'Tagesgerichte', lv: 'A2', fa: 'غذای روز', ex: ['Das Tagesgericht kostet neun Euro.', 'غذای روز نُه یورو است.'] },
        { w: 'Portion', g: 'f', pl: 'Portionen', lv: 'A2', fa: 'پُرس', ex: ['Die Portion ist sehr groß.', 'این پرس خیلی بزرگ است.'] },
      ],
    },
    {
      title: 'نوشیدنی‌ها',
      words: [
        { w: 'Getränk', g: 'n', pl: 'Getränke', lv: 'A1', fa: 'نوشیدنی', ex: ['Welche Getränke haben Sie?', 'چه نوشیدنی‌هایی دارید؟'] },
        { w: 'Kaffee', g: 'm', pl: 'Kaffees', lv: 'A1', fa: 'قهوه', ex: ['Der Kaffee ist stark.', 'قهوه غلیظ است.'] },
        { w: 'Tee', g: 'm', pl: 'Tees', lv: 'A1', fa: 'چای', ex: ['Der Tee ist ohne Zucker.', 'چای بدون شکر است.'] },
        { w: 'Wasser', g: 'n', pl: null, lv: 'A1', fa: 'آب', ex: ['Das Wasser ist kalt.', 'آب خنک است.'], tip: 'در رستوران می‌پرسند: mit oder ohne Kohlensäure? یعنی گازدار یا بی‌گاز. آب شیر (Leitungswasser) را باید خودت بخواهی.' },
        { w: 'Mineralwasser', g: 'n', pl: null, lv: 'A1', fa: 'آب معدنی', ex: ['Ein Mineralwasser ohne Kohlensäure, bitte.', 'یک آب معدنی بی‌گاز، لطفاً.'] },
        { w: 'Saft', g: 'm', pl: 'Säfte', lv: 'A1', fa: 'آب‌میوه', ex: ['Der Saft ist frisch.', 'آب‌میوه تازه است.'] },
        { w: 'Milch', g: 'f', pl: null, lv: 'A1', fa: 'شیر', ex: ['Kaffee mit Milch, bitte.', 'قهوه با شیر، لطفاً.'] },
        { w: 'Limonade', g: 'f', pl: 'Limonaden', lv: 'A2', fa: 'نوشابهٔ گازدار؛ لیموناد', ex: ['Die Limonade ist sehr süß.', 'نوشابه خیلی شیرین است.'] },
        { w: 'Schorle', g: 'f', pl: 'Schorlen', lv: 'A2', fa: 'آب‌میوه با آب گازدار', ex: ['Eine Apfelschorle, bitte.', 'یک آب‌سیب گازدار، لطفاً.'], tip: 'Schorle نوشیدنی خیلی رایجی در آلمان است: نصف آب‌میوه، نصف آب گازدار. معروف‌ترینش Apfelschorle است.' },
        { w: 'Bier', g: 'n', pl: 'Biere', lv: 'A1', fa: 'آبجو', ex: ['Das Bier ist alkoholfrei.', 'این آبجو بدون الکل است.'] },
        { w: 'Wein', g: 'm', pl: 'Weine', lv: 'A1', fa: 'شراب', ex: ['Der Wein kommt aus Italien.', 'این شراب از ایتالیاست.'] },
      ],
    },
    {
      title: 'غذاها',
      words: [
        { w: 'Suppe', g: 'f', pl: 'Suppen', lv: 'A1', fa: 'سوپ', ex: ['Die Suppe ist noch heiß.', 'سوپ هنوز داغ است.'] },
        { w: 'Salat', g: 'm', pl: 'Salate', lv: 'A1', fa: 'سالاد؛ کاهو', ex: ['Der Salat ist frisch.', 'سالاد تازه است.'] },
        { w: 'Fleisch', g: 'n', pl: null, lv: 'A1', fa: 'گوشت', ex: ['Ich esse kein Fleisch.', 'من گوشت نمی‌خورم.'] },
        { w: 'Hähnchen', g: 'n', pl: 'Hähnchen', lv: 'A1', fa: 'مرغ (غذا)', ex: ['Das Hähnchen ist gegrillt.', 'مرغ کبابی است.'], tip: 'در جنوب آلمان و اتریش به‌جای Hähnchen می‌گویند das Hendl.' },
        { w: 'Rindfleisch', g: 'n', pl: null, lv: 'A2', fa: 'گوشت گاو', ex: ['Das Rindfleisch ist sehr zart.', 'گوشت گاو خیلی نرم است.'] },
        { w: 'Schweinefleisch', g: 'n', pl: null, lv: 'A2', fa: 'گوشت خوک', ex: ['Ist das mit Schweinefleisch?', 'این گوشت خوک دارد؟'], tip: 'در آلمان خیلی از غذاها (سوسیس، شنیتسل، ژامبون) گوشت خوک دارند. اگر نمی‌خوری، بپرس: Ist das mit Schweinefleisch?' },
        { w: 'Fisch', g: 'm', pl: 'Fische', lv: 'A1', fa: 'ماهی', ex: ['Freitags gibt es Fisch.', 'جمعه‌ها ماهی هست.'] },
        { w: 'Wurst', g: 'f', pl: 'Würste', lv: 'A1', fa: 'سوسیس؛ کالباس', ex: ['Die Wurst kommt mit Senf.', 'سوسیس با خردل می‌آید.'] },
        { w: 'Schnitzel', g: 'n', pl: 'Schnitzel', lv: 'A2', fa: 'شنیتسل (گوشت سوخاری‌شده)', ex: ['Das Schnitzel ist so groß wie der Teller.', 'شنیتسل به اندازهٔ بشقاب است.'], tip: 'Schnitzel معمولاً از گوشت خوک است. اگر از گوساله باشد می‌نویسند Wiener Schnitzel یا vom Kalb.' },
        { w: 'Kartoffel', g: 'f', pl: 'Kartoffeln', lv: 'A1', fa: 'سیب‌زمینی', ex: ['Die Kartoffeln sind noch warm.', 'سیب‌زمینی‌ها هنوز گرم‌اند.'] },
        { w: 'Pommes', g: 'pl', pl: null, lv: 'A1', fa: 'سیب‌زمینی سرخ‌کرده', ex: ['Die Pommes sind zu salzig.', 'سیب‌زمینی سرخ‌کرده زیادی شور است.'], tip: 'شکل کاملش Pommes frites است، ولی همه می‌گویند Pommes. همیشه جمع است.' },
        { w: 'Reis', g: 'm', pl: null, lv: 'A1', fa: 'برنج', ex: ['Ich nehme Reis als Beilage.', 'برای کنار غذا برنج می‌گیرم.'] },
        { w: 'Nudeln', g: 'pl', pl: null, lv: 'A1', fa: 'ماکارونی؛ رشته', ex: ['Die Kinder möchten Nudeln.', 'بچه‌ها ماکارونی می‌خواهند.'] },
        { w: 'Gemüse', g: 'n', pl: null, lv: 'A1', fa: 'سبزیجات', ex: ['Das Gemüse ist gekocht.', 'سبزیجات آب‌پز است.'] },
        { w: 'Brot', g: 'n', pl: 'Brote', lv: 'A1', fa: 'نان', ex: ['Das Brot ist frisch.', 'نان تازه است.'] },
        { w: 'Käse', g: 'm', pl: null, lv: 'A1', fa: 'پنیر', ex: ['Die Pizza ist mit viel Käse.', 'پیتزا پنیر زیاد دارد.'] },
      ],
    },
    {
      title: 'خوراکی‌های کافه',
      words: [
        { w: 'Kuchen', g: 'm', pl: 'Kuchen', lv: 'A1', fa: 'کیک (ساده)', ex: ['Der Kuchen ist hausgemacht.', 'کیک خانگی است.'], tip: 'der Kuchen کیک ساده است (سیب، شکلاتی). die Torte کیک خامه‌ای و چندلایه است.' },
        { w: 'Torte', g: 'f', pl: 'Torten', lv: 'A2', fa: 'کیک خامه‌ای', ex: ['Die Torte sieht toll aus.', 'کیک خامه‌ای عالی به نظر می‌رسد.'] },
        { w: 'Stück', g: 'n', pl: 'Stücke', lv: 'A1', fa: 'تکه؛ برش', ex: ['Ein Stück Kuchen, bitte.', 'یک برش کیک، لطفاً.'] },
        { w: 'Brötchen', g: 'n', pl: 'Brötchen', lv: 'A1', fa: 'نان کوچک', ex: ['Das Brötchen ist noch warm.', 'نان هنوز گرم است.'], tip: 'اسم این نان در هر منطقه فرق دارد: در جنوب die Semmel، در برلین die Schrippe.' },
        { w: 'Croissant', g: 'n', pl: 'Croissants', lv: 'A2', fa: 'کروسان', ex: ['Ich nehme ein Croissant und einen Kaffee.', 'یک کروسان و یک قهوه می‌گیرم.'] },
        { w: 'Eis', g: 'n', pl: null, lv: 'A1', fa: 'بستنی؛ یخ', ex: ['Die Kinder möchten ein Eis.', 'بچه‌ها بستنی می‌خواهند.'], tip: 'Eis هم «بستنی» است و هم «یخ». برای نوشیدنی: mit Eis یعنی با یخ.' },
        { w: 'Zucker', g: 'm', pl: null, lv: 'A1', fa: 'شکر', ex: ['Nehmen Sie Zucker?', 'شکر می‌خواهید؟'] },
        { w: 'Sahne', g: 'f', pl: null, lv: 'A2', fa: 'خامه', ex: ['Mit oder ohne Sahne?', 'با خامه یا بی‌خامه؟'] },
        { w: 'Schokolade', g: 'f', pl: 'Schokoladen', lv: 'A1', fa: 'شکلات', ex: ['Eine heiße Schokolade, bitte.', 'یک شکلات داغ، لطفاً.'] },
      ],
    },
    {
      title: 'روی میز',
      words: [
        { w: 'Tisch', g: 'm', pl: 'Tische', lv: 'A1', fa: 'میز', ex: ['Der Tisch am Fenster ist frei.', 'میز کنار پنجره خالی است.'] },
        { w: 'Stuhl', g: 'm', pl: 'Stühle', lv: 'A1', fa: 'صندلی', ex: ['Wir brauchen noch einen Stuhl.', 'یک صندلی دیگر لازم داریم.'] },
        { w: 'Teller', g: 'm', pl: 'Teller', lv: 'A1', fa: 'بشقاب', ex: ['Der Teller ist leer.', 'بشقاب خالی است.'] },
        { w: 'Glas', g: 'n', pl: 'Gläser', lv: 'A1', fa: 'لیوان شیشه‌ای', ex: ['Ein Glas Wasser, bitte.', 'یک لیوان آب، لطفاً.'], tip: 'das Glas شیشه‌ای است (آب، آب‌میوه). die Tasse فنجانِ دسته‌دار است (قهوه، چای). der Becher لیوان سادهٔ بی‌پایه یا کاغذی است (قهوهٔ بیرون‌بر).' },
        { w: 'Tasse', g: 'f', pl: 'Tassen', lv: 'A1', fa: 'فنجان', ex: ['Eine Tasse Kaffee, bitte.', 'یک فنجان قهوه، لطفاً.'] },
        { w: 'Becher', g: 'm', pl: 'Becher', lv: 'A2', fa: 'لیوان (ساده یا کاغذی)', ex: ['Der Kaffee ist im Becher.', 'قهوه در لیوان کاغذی است.'] },
        { w: 'Flasche', g: 'f', pl: 'Flaschen', lv: 'A1', fa: 'بطری', ex: ['Eine Flasche Wasser für den Tisch.', 'یک بطری آب برای میز.'] },
        { w: 'Gabel', g: 'f', pl: 'Gabeln', lv: 'A1', fa: 'چنگال', ex: ['Die Gabel liegt links.', 'چنگال سمت چپ است.'] },
        { w: 'Messer', g: 'n', pl: 'Messer', lv: 'A1', fa: 'چاقو', ex: ['Das Messer ist scharf.', 'چاقو تیز است.'] },
        { w: 'Löffel', g: 'm', pl: 'Löffel', lv: 'A1', fa: 'قاشق', ex: ['Für die Suppe brauche ich einen Löffel.', 'برای سوپ قاشق لازم دارم.'] },
        { w: 'Serviette', g: 'f', pl: 'Servietten', lv: 'A2', fa: 'دستمال سفره', ex: ['Haben Sie eine Serviette?', 'دستمال سفره دارید؟'] },
        { w: 'Salz', g: 'n', pl: null, lv: 'A1', fa: 'نمک', ex: ['Können Sie mir das Salz geben?', 'می‌شود نمک را به من بدهید؟'] },
        { w: 'Pfeffer', g: 'm', pl: null, lv: 'A1', fa: 'فلفل (سیاه)', ex: ['Salz und Pfeffer stehen auf dem Tisch.', 'نمک و فلفل روی میز است.'] },
      ],
    },
    {
      title: 'مزه و حالت غذا',
      words: [
        { w: 'lecker', p: 'adjective', cmp: ['leckerer', 'am leckersten'], lv: 'A1', fa: 'خوشمزه', ex: ['Der Kuchen ist lecker.', 'کیک خوشمزه است.'] },
        { w: 'süß', p: 'adjective', cmp: ['süßer', 'am süßesten'], lv: 'A1', fa: 'شیرین', ex: ['Der Tee ist zu süß.', 'چای زیادی شیرین است.'] },
        { w: 'salzig', p: 'adjective', cmp: ['salziger', 'am salzigsten'], lv: 'A2', fa: 'شور', ex: ['Die Suppe ist zu salzig.', 'سوپ زیادی شور است.'] },
        { w: 'sauer', p: 'adjective', cmp: ['saurer', 'am sauersten'], lv: 'A2', fa: 'ترش', ex: ['Die Zitrone ist sauer.', 'لیمو ترش است.'] },
        { w: 'scharf', p: 'adjective', cmp: ['schärfer', 'am schärfsten'], lv: 'A2', fa: 'تند؛ تیز', ex: ['Ist das Essen scharf?', 'این غذا تند است؟'], tip: 'scharf دو معنی دارد: غذای تند، و چاقوی تیز.' },
        { w: 'bitter', p: 'adjective', cmp: ['bitterer', 'am bittersten'], lv: 'A2', fa: 'تلخ', ex: ['Der Kaffee ist bitter.', 'قهوه تلخ است.'] },
        { w: 'heiß', p: 'adjective', cmp: ['heißer', 'am heißesten'], lv: 'A1', fa: 'داغ', ex: ['Vorsicht, der Teller ist heiß!', 'مواظب باشید، بشقاب داغ است!'] },
        { w: 'warm', p: 'adjective', cmp: ['wärmer', 'am wärmsten'], lv: 'A1', fa: 'گرم', ex: ['Das Brot ist noch warm.', 'نان هنوز گرم است.'], tip: 'warme Küche یعنی غذای گرم. تابلوی «warme Küche bis 22 Uhr» یعنی تا ساعت ده غذای گرم سرو می‌شود.' },
        { w: 'kalt', p: 'adjective', cmp: ['kälter', 'am kältesten'], lv: 'A1', fa: 'سرد', ex: ['Mein Essen ist leider kalt.', 'متأسفانه غذای من سرد است.'] },
        { w: 'frisch', p: 'adjective', cmp: ['frischer', 'am frischesten'], lv: 'A1', fa: 'تازه', ex: ['Der Fisch ist ganz frisch.', 'ماهی کاملاً تازه است.'] },
        { w: 'fettig', p: 'adjective', cmp: ['fettiger', 'am fettigsten'], lv: 'A2', fa: 'چرب', ex: ['Die Pommes sind sehr fettig.', 'سیب‌زمینی سرخ‌کرده خیلی چرب است.'] },
      ],
    },
    {
      title: 'پخت و رژیم غذایی',
      words: [
        { w: 'gebraten', p: 'adjective', lv: 'A2', fa: 'سرخ‌شده (در تابه)', ex: ['Der Fisch ist gebraten.', 'ماهی سرخ‌شده است.'] },
        { w: 'gekocht', p: 'adjective', lv: 'A2', fa: 'آب‌پز؛ پخته', ex: ['Ich möchte ein gekochtes Ei.', 'یک تخم‌مرغ آب‌پز می‌خواهم.'] },
        { w: 'gegrillt', p: 'adjective', lv: 'A2', fa: 'کبابی', ex: ['Das Gemüse ist gegrillt.', 'سبزیجات کبابی است.'] },
        { w: 'gebacken', p: 'adjective', lv: 'A2', fa: 'پخته در فر', ex: ['Das Brot ist frisch gebacken.', 'نان تازه از فر درآمده.'] },
        { w: 'roh', p: 'adjective', lv: 'A2', fa: 'خام', ex: ['Das Fleisch ist noch roh.', 'گوشت هنوز خام است.'] },
        { w: 'vegetarisch', p: 'adjective', lv: 'A2', fa: 'گیاهی (بدون گوشت)', ex: ['Haben Sie etwas Vegetarisches?', 'غذای گیاهی دارید؟'], tip: 'vegetarisch یعنی بدون گوشت و ماهی. vegan یعنی بدون هیچ فراوردهٔ حیوانی (شیر، تخم‌مرغ، عسل هم نه).' },
        { w: 'vegan', p: 'adjective', lv: 'A2', fa: 'وگان (بدون فراوردهٔ حیوانی)', ex: ['Die Suppe ist vegan.', 'این سوپ وگان است.'] },
        { w: 'glutenfrei', p: 'adjective', lv: 'B1', fa: 'بدون گلوتن', ex: ['Haben Sie glutenfreies Brot?', 'نان بدون گلوتن دارید؟'] },
        { w: 'laktosefrei', p: 'adjective', lv: 'B1', fa: 'بدون لاکتوز', ex: ['Haben Sie laktosefreie Milch?', 'شیر بدون لاکتوز دارید؟'] },
        { w: 'Allergie', g: 'f', pl: 'Allergien', lv: 'A2', fa: 'حساسیت', ex: ['Ich habe eine Allergie gegen Nüsse.', 'من به آجیل حساسیت دارم.'], tip: 'حرف اضافه‌اش gegen است: eine Allergie gegen Nüsse. صفتش: allergisch gegen.' },
        { w: 'Nuss', g: 'f', pl: 'Nüsse', lv: 'A2', fa: 'آجیل؛ مغز', ex: ['Sind in dem Kuchen Nüsse?', 'این کیک آجیل دارد؟'] },
      ],
    },
    {
      title: 'حساب و پرداخت',
      words: [
        { w: 'Rechnung', g: 'f', pl: 'Rechnungen', lv: 'A1', fa: 'صورت‌حساب', ex: ['Die Rechnung kommt sofort.', 'صورت‌حساب همین الان می‌آید.'] },
        { w: 'Trinkgeld', g: 'n', pl: 'Trinkgelder', lv: 'A2', fa: 'انعام', ex: ['Das Trinkgeld ist für die Bedienung.', 'انعام برای گارسون است.'], tip: 'در آلمان انعام معمولاً حدود ۵ تا ۱۰ درصد است. روی میز نمی‌گذارند؛ هنگام پرداخت مبلغ کل را می‌گویند.' },
        { w: 'Preis', g: 'm', pl: 'Preise', lv: 'A1', fa: 'قیمت', ex: ['Die Preise sind hier hoch.', 'قیمت‌ها این‌جا بالاست.'] },
        { w: 'Karte', g: 'f', pl: 'Karten', lv: 'A1', fa: 'کارت (بانکی)؛ منو', ex: ['Zahlen Sie mit Karte?', 'با کارت پرداخت می‌کنید؟'], tip: 'die Karte دو معنی دارد: کارت بانکی، و کوتاه‌شدهٔ Speisekarte (منو).' },
        { w: 'bar', p: 'adverb', lv: 'A1', fa: 'نقد', ex: ['Ich zahle bar.', 'نقد می‌پردازم.'], tip: 'خیلی از کافه‌ها و رستوران‌های کوچک آلمان فقط نقد می‌گیرند: Nur Barzahlung.' },
        { w: 'Kleingeld', g: 'n', pl: null, lv: 'A2', fa: 'پول خرد', ex: ['Ich habe kein Kleingeld.', 'پول خرد ندارم.'] },
        { w: 'Quittung', g: 'f', pl: 'Quittungen', lv: 'A2', fa: 'رسید', ex: ['Kann ich eine Quittung bekommen?', 'می‌شود یک رسید بگیرم؟'] },
        { w: 'teuer', p: 'adjective', cmp: ['teurer', 'am teuersten'], lv: 'A1', fa: 'گران', ex: ['Das Restaurant ist sehr teuer.', 'این رستوران خیلی گران است.'] },
        { w: 'günstig', p: 'adjective', cmp: ['günstiger', 'am günstigsten'], lv: 'A2', fa: 'ارزان؛ به‌صرفه', ex: ['Das Mittagsmenü ist günstig.', 'منوی ناهار به‌صرفه است.'], tip: 'billig هم یعنی ارزان، ولی گاهی معنی «بی‌کیفیت» می‌دهد. günstig مؤدبانه‌تر است.' },
      ],
    },
    {
      title: 'فعل‌ها',
      words: [
        { w: 'bestellen', p: 'verb', v: { p2: 'bestellt' }, lv: 'A1', fa: 'سفارش دادن', ex: ['Wir möchten bestellen.', 'می‌خواهیم سفارش بدهیم.'] },
        { w: 'bezahlen', p: 'verb', v: { p2: 'bezahlt' }, lv: 'A1', fa: 'پرداختن', ex: ['Ich möchte bezahlen.', 'می‌خواهم حساب کنم.'], tip: 'zahlen همین معنی را دارد و در رستوران رایج‌تر است: Zahlen, bitte!' },
        { w: 'reservieren', p: 'verb', v: { p2: 'reserviert', imp: 'reserviere' }, lv: 'A2', fa: 'رزرو کردن', ex: ['Ich möchte einen Tisch reservieren.', 'می‌خواهم یک میز رزرو کنم.'] },
        { w: 'essen', p: 'verb', v: { p2: 'gegessen', du: 'isst', er: 'isst', prat: 'aß', k2: 'äß', imp: 'iss', irregular: true }, lv: 'A1', fa: 'خوردن', ex: ['Was möchten Sie essen?', 'چه میل دارید؟'] },
        { w: 'trinken', p: 'verb', v: { p2: 'getrunken', prat: 'trank', k2: 'tränk', irregular: true }, lv: 'A1', fa: 'نوشیدن', ex: ['Was möchten Sie trinken?', 'چه می‌نوشید؟'] },
        { w: 'nehmen', p: 'verb', v: { p2: 'genommen', du: 'nimmst', er: 'nimmt', prat: 'nahm', k2: 'nähm', imp: 'nimm', irregular: true }, lv: 'A1', fa: 'گرفتن؛ برداشتن', ex: ['Ich nehme die Suppe.', 'من سوپ می‌گیرم.'], tip: 'برای سفارش دادن، Ich nehme … ساده‌ترین جمله است.' },
        { w: 'bringen', p: 'verb', v: { p2: 'gebracht', pratWeak: 'brach', k2Weak: 'bräch', irregular: true }, lv: 'A1', fa: 'آوردن', ex: ['Können Sie uns die Karte bringen?', 'می‌شود منو را برایمان بیاورید؟'] },
        { w: 'schmecken', p: 'verb', v: { p2: 'geschmeckt' }, lv: 'A1', fa: 'مزه دادن؛ خوشمزه بودن', ex: ['Die Suppe schmeckt gut.', 'سوپ خوشمزه است.'], tip: 'با مفعول باواسطه می‌آید: Es schmeckt mir یعنی «به دهانم خوشمزه است».' },
        { w: 'empfehlen', p: 'verb', v: { p2: 'empfohlen', du: 'empfiehlst', er: 'empfiehlt', prat: 'empfahl', k2: 'empfähl', imp: 'empfiehl', irregular: true }, lv: 'A2', fa: 'پیشنهاد کردن', ex: ['Was können Sie empfehlen?', 'چه پیشنهادی دارید؟'] },
        { w: 'probieren', p: 'verb', v: { p2: 'probiert', imp: 'probiere' }, lv: 'A2', fa: 'چشیدن؛ امتحان کردن', ex: ['Möchtest du mal probieren?', 'می‌خواهی یک‌کم بچشی؟'] },
        { w: 'kosten', p: 'verb', v: { p2: 'gekostet' }, lv: 'A1', fa: 'قیمت داشتن', ex: ['Was kostet ein Kaffee?', 'یک قهوه چند است؟'] },
        { w: 'warten', p: 'verb', v: { p2: 'gewartet', gov: 'auf + Akkusativ' }, lv: 'A1', fa: 'منتظر ماندن', ex: ['Wir warten auf das Essen.', 'منتظر غذا هستیم.'] },
        { w: 'kochen', p: 'verb', v: { p2: 'gekocht' }, lv: 'A1', fa: 'پختن؛ آشپزی کردن', ex: ['Der Koch kocht sehr gut.', 'آشپز خیلی خوب آشپزی می‌کند.'] },
        { w: 'einladen', p: 'verb', v: { p2: 'eingeladen', sep: 'ein', du: 'lädst', er: 'lädt', prat: 'lud', k2: 'lüd', irregular: true }, lv: 'A2', fa: 'دعوت کردن؛ مهمان کردن', ex: ['Heute lade ich dich ein.', 'امروز مهمان منی.'], tip: 'Ich lade dich ein یعنی «حساب با من». اگر کسی این را بگوید، او پول را می‌دهد.' },
      ],
    },
    {
      title: 'چند واژهٔ پرکاربرد',
      words: [
        { w: 'frei', p: 'adjective', lv: 'A1', fa: 'خالی؛ آزاد', ex: ['Ist der Tisch frei?', 'این میز خالی است؟'] },
        { w: 'besetzt', p: 'adjective', lv: 'A2', fa: 'پُر؛ گرفته‌شده', ex: ['Der Platz ist leider besetzt.', 'متأسفانه این جا گرفته شده.'] },
        { w: 'satt', p: 'adjective', lv: 'A2', fa: 'سیر', ex: ['Danke, ich bin satt.', 'ممنون، سیر شدم.'], tip: 'نگو Ich bin voll. آن یعنی «مستم». برای سیر بودن فقط Ich bin satt.' },
        { w: 'hungrig', p: 'adjective', cmp: ['hungriger', 'am hungrigsten'], lv: 'A1', fa: 'گرسنه', ex: ['Die Kinder sind hungrig.', 'بچه‌ها گرسنه‌اند.'], tip: 'رایج‌تر این است: Ich habe Hunger.' },
        { w: 'durstig', p: 'adjective', cmp: ['durstiger', 'am durstigsten'], lv: 'A1', fa: 'تشنه', ex: ['Ich bin sehr durstig.', 'خیلی تشنه‌ام.'], tip: 'رایج‌تر این است: Ich habe Durst.' },
        { w: 'voll', p: 'adjective', cmp: ['voller', 'am vollsten'], lv: 'A1', fa: 'پُر', ex: ['Das Café ist heute voll.', 'کافه امروز پر است.'] },
        { w: 'leer', p: 'adjective', cmp: ['leerer', 'am leersten'], lv: 'A1', fa: 'خالی (بدون محتوا)', ex: ['Mein Glas ist leer.', 'لیوان من خالی است.'], tip: 'leer یعنی چیزی داخلش نیست (لیوان، بشقاب). frei یعنی کسی آن‌جا ننشسته (میز، صندلی).' },
        { w: 'zusammen', p: 'adverb', lv: 'A1', fa: 'با هم', ex: ['Wir zahlen zusammen.', 'با هم حساب می‌کنیم.'] },
        { w: 'getrennt', p: 'adverb', lv: 'A2', fa: 'جدا', ex: ['Wir zahlen getrennt.', 'جدا حساب می‌کنیم.'], tip: 'در آلمان جدا حساب کردن کاملاً عادی است و گارسون خودش می‌پرسد: Zusammen oder getrennt?' },
      ],
    },
  ],
}

const G = 'مشتری'
const K = 'گارسون'

export const restaurantTalk: CuratedPack = {
  slug: 'restaurant-talk',
  kind: 'sentences',
  level: 'basic',
  emoji: '💬',
  title: 'رستوران و کافه: گفت‌وگوها',
  description:
    'نُه صحنهٔ کوتاه، از رزرو تلفنی تا پرداخت. هر صحنه یک گفت‌وگوی واقعی است و هر جمله‌اش یک کارت: چه کسی می‌گوید، کِی، و جواب معمولش چیست.',
  groups: [
    {
      title: 'رزرو تلفنی',
      lines: [
        { who: G, de: 'Guten Tag, ich möchte einen Tisch reservieren.', fa: 'روز به خیر، می‌خواهم یک میز رزرو کنم.', when: 'اول تماس تلفنی با رستوران.', lv: 'A2', reply: ['Gern. Für wann?', 'با کمال میل. برای کِی؟'] },
        { who: K, de: 'Für wann und für wie viele Personen?', fa: 'برای کِی و برای چند نفر؟', when: 'گارسون برای ثبت رزرو می‌پرسد.', lv: 'A2', reply: ['Für heute Abend, für vier Personen.', 'برای امشب، برای چهار نفر.'] },
        { who: G, de: 'Für heute Abend um sieben Uhr, für vier Personen.', fa: 'برای امشب ساعت هفت، برای چهار نفر.', when: 'زمان و تعداد را می‌گویی.', lv: 'A2' },
        { who: K, de: 'Auf welchen Namen?', fa: 'به چه نامی؟', when: 'برای نوشتن رزرو، نامت را می‌پرسد.', lv: 'A2', reply: ['Auf den Namen Ahmadi.', 'به نام احمدی.'] },
        { who: K, de: 'Alles klar, bis heute Abend!', fa: 'بسیار خب، تا امشب!', when: 'رزرو ثبت شد و تماس تمام می‌شود.', lv: 'A2', reply: ['Vielen Dank, bis später!', 'خیلی ممنون، تا بعد!'] },
      ],
    },
    {
      title: 'ورود و نشستن',
      lines: [
        { who: G, de: 'Guten Abend, wir haben einen Tisch reserviert.', fa: 'شب به خیر، ما یک میز رزرو کرده‌ایم.', when: 'هنگام ورود، اگر رزرو داری.', lv: 'A2', reply: ['Auf welchen Namen, bitte?', 'به چه نامی، لطفاً؟'] },
        { who: G, de: 'Haben Sie einen Tisch für zwei?', fa: 'یک میز دونفره دارید؟', when: 'هنگام ورود، اگر رزرو نداری.', lv: 'A1', reply: ['Ja, kommen Sie bitte mit.', 'بله، لطفاً همراهم بیایید.'] },
        { who: G, de: 'Ist hier noch frei?', fa: 'این‌جا خالی است؟', when: 'وقتی می‌خواهی کنار کسی یا سر میزی بنشینی.', lv: 'A1', reply: ['Ja, bitte.', 'بله، بفرمایید.'] },
        { who: K, de: 'Möchten Sie drinnen oder draußen sitzen?', fa: 'می‌خواهید داخل بنشینید یا بیرون؟', when: 'وقتی رستوران تراس دارد.', lv: 'A2', reply: ['Draußen, bitte.', 'بیرون، لطفاً.'] },
        { who: G, de: 'Können wir am Fenster sitzen?', fa: 'می‌شود کنار پنجره بنشینیم؟', when: 'وقتی جای خاصی را می‌خواهی.', lv: 'A2', reply: ['Natürlich, gern.', 'البته، با کمال میل.'] },
      ],
    },
    {
      title: 'سفارش نوشیدنی',
      lines: [
        { who: G, de: 'Die Speisekarte, bitte.', fa: 'منو، لطفاً.', when: 'بعد از نشستن، اگر منو روی میز نیست.', lv: 'A1', reply: ['Bitte schön.', 'بفرمایید.'] },
        { who: K, de: 'Was möchten Sie trinken?', fa: 'چه می‌نوشید؟', when: 'معمولاً اول نوشیدنی را می‌پرسند.', lv: 'A1', reply: ['Ein Wasser, bitte.', 'یک آب، لطفاً.'] },
        { who: G, de: 'Ich hätte gern ein Wasser.', fa: 'یک آب می‌خواستم.', when: 'مؤدبانه‌ترین راه سفارش دادن.', lv: 'A2', lit: '«دوست می‌داشتم یک آب داشته باشم.»', alt: ['Ich möchte ein Wasser.', 'Ein Wasser, bitte.'] },
        { who: K, de: 'Mit oder ohne Kohlensäure?', fa: 'گازدار یا بی‌گاز؟', when: 'هر بار که آب سفارش بدهی می‌پرسند.', lv: 'A2', reply: ['Ohne, bitte.', 'بی‌گاز، لطفاً.'] },
        { who: G, de: 'Für mich einen Kaffee, bitte.', fa: 'برای من یک قهوه، لطفاً.', when: 'وقتی چند نفرید و هر کس سفارش خودش را می‌گوید.', lv: 'A1' },
      ],
    },
    {
      title: 'سفارش غذا',
      lines: [
        { who: K, de: 'Haben Sie schon gewählt?', fa: 'انتخاب کرده‌اید؟', when: 'گارسون برای گرفتن سفارش غذا می‌آید.', lv: 'A2', reply: ['Ja, ich nehme die Suppe.', 'بله، من سوپ می‌گیرم.'], alt: ['Was darf es sein?'] },
        { who: G, de: 'Wir brauchen noch einen Moment.', fa: 'یک لحظهٔ دیگر وقت لازم داریم.', when: 'وقتی هنوز تصمیم نگرفته‌ای.', lv: 'A2', reply: ['Kein Problem.', 'مشکلی نیست.'] },
        { who: G, de: 'Was können Sie empfehlen?', fa: 'چه پیشنهادی دارید؟', when: 'وقتی نمی‌دانی چه سفارش بدهی.', lv: 'A2', reply: ['Das Tagesgericht ist sehr gut.', 'غذای روز خیلی خوب است.'] },
        { who: G, de: 'Ich nehme das Tagesgericht.', fa: 'من غذای روز را می‌گیرم.', when: 'ساده‌ترین راه سفارش دادن غذا.', lv: 'A1', alt: ['Ich hätte gern das Tagesgericht.'] },
        { who: K, de: 'Sonst noch etwas?', fa: 'چیز دیگری هم می‌خواهید؟', when: 'بعد از گرفتن سفارش.', lv: 'A1', reply: ['Nein danke, das ist alles.', 'نه ممنون، همین.'] },
        { who: G, de: 'Nein danke, das ist alles.', fa: 'نه ممنون، همین.', when: 'وقتی سفارشت تمام شده.', lv: 'A1' },
      ],
    },
    {
      title: 'پرسیدن دربارهٔ غذا',
      lines: [
        { who: G, de: 'Was ist das genau?', fa: 'این دقیقاً چیست؟', when: 'وقتی اسم غذایی را در منو نمی‌شناسی.', lv: 'A1' },
        { who: G, de: 'Ist das scharf?', fa: 'این تند است؟', when: 'پیش از سفارش دادن.', lv: 'A2', reply: ['Nur ein bisschen.', 'فقط یک‌کم.'] },
        { who: G, de: 'Ich esse kein Schweinefleisch.', fa: 'من گوشت خوک نمی‌خورم.', when: 'وقتی می‌خواهی مطمئن شوی غذا گوشت خوک ندارد.', lv: 'A2', reply: ['Dann empfehle ich das Hähnchen.', 'پس مرغ را پیشنهاد می‌کنم.'] },
        { who: G, de: 'Haben Sie etwas Vegetarisches?', fa: 'غذای گیاهی دارید؟', when: 'وقتی گوشت نمی‌خوری.', lv: 'A2', reply: ['Ja, die Gemüsepfanne.', 'بله، خوراک سبزیجات.'] },
        { who: G, de: 'Ich bin allergisch gegen Nüsse.', fa: 'من به آجیل حساسیت دارم.', when: 'حتماً پیش از سفارش بگو.', lv: 'A2', reply: ['Ich frage in der Küche nach.', 'از آشپزخانه می‌پرسم.'] },
      ],
    },
    {
      title: 'وسط غذا',
      lines: [
        { who: K, de: 'Guten Appetit!', fa: 'نوش جان!', when: 'وقتی غذا را می‌آورد. سر میز هم به همدیگر می‌گویند.', lv: 'A1', reply: ['Danke, gleichfalls!', 'ممنون، همچنین!'] },
        { who: G, de: 'Noch ein Wasser, bitte.', fa: 'یک آب دیگر، لطفاً.', when: 'وقتی یکی دیگر از همان را می‌خواهی.', lv: 'A1', reply: ['Kommt sofort.', 'الان می‌آورم.'] },
        { who: G, de: 'Können wir noch etwas Brot bekommen?', fa: 'می‌شود کمی نان دیگر بگیریم؟', when: 'وقتی چیز بیشتری می‌خواهی.', lv: 'A2', reply: ['Natürlich.', 'البته.'] },
        { who: K, de: 'Ist alles in Ordnung?', fa: 'همه‌چیز خوب است؟', when: 'گارسون وسط غذا سر می‌زند.', lv: 'A2', reply: ['Ja, danke, alles super.', 'بله ممنون، همه‌چیز عالی است.'] },
        { who: K, de: 'Hat es geschmeckt?', fa: 'خوشمزه بود؟', when: 'هنگام بردن بشقاب‌ها.', lv: 'A2', reply: ['Ja, sehr gut, danke.', 'بله، خیلی خوب بود، ممنون.'] },
        { who: G, de: 'Es war sehr lecker.', fa: 'خیلی خوشمزه بود.', when: 'تعریف از غذا، بعد از خوردن.', lv: 'A1', reply: ['Das freut mich.', 'خوشحالم.'] },
      ],
    },
    {
      title: 'وقتی مشکلی هست',
      lines: [
        { who: G, de: 'Entschuldigung, das habe ich nicht bestellt.', fa: 'ببخشید، من این را سفارش نداده‌ام.', when: 'وقتی غذای اشتباه آورده‌اند.', lv: 'A2', reply: ['Oh, das tut mir leid.', 'آخ، متأسفم.'] },
        { who: G, de: 'Das Essen ist leider kalt.', fa: 'متأسفانه غذا سرد است.', when: 'شکایت مؤدبانه. واژهٔ leider لحن را نرم می‌کند.', lv: 'A2', reply: ['Ich bringe Ihnen sofort ein neues.', 'همین الان یکی دیگر برایتان می‌آورم.'] },
        { who: G, de: 'Wir warten schon sehr lange.', fa: 'خیلی وقت است منتظریم.', when: 'وقتی غذا دیر کرده.', lv: 'A2', reply: ['Entschuldigung, es kommt gleich.', 'ببخشید، الان می‌آید.'] },
        { who: K, de: 'Das tut mir leid, ich bringe sofort ein neues.', fa: 'متأسفم، همین الان یکی دیگر می‌آورم.', when: 'جواب گارسون به شکایت.', lv: 'A2' },
      ],
    },
    {
      title: 'در کافه و بیرون‌بر',
      lines: [
        { who: K, de: 'Zum Hieressen oder zum Mitnehmen?', fa: 'همین‌جا میل می‌کنید یا می‌برید؟', when: 'در کافه، نانوایی و غذاخوری سرپایی می‌پرسند.', lv: 'A2', reply: ['Zum Mitnehmen, bitte.', 'می‌برم، لطفاً.'] },
        { who: G, de: 'Zum Mitnehmen, bitte.', fa: 'می‌برم، لطفاً.', when: 'وقتی نمی‌خواهی همان‌جا بنشینی.', lv: 'A2', alt: ['Zum Hieressen, bitte.'] },
        { who: G, de: 'Ein Stück Kuchen und einen Kaffee, bitte.', fa: 'یک برش کیک و یک قهوه، لطفاً.', when: 'سفارش کنار پیشخوان.', lv: 'A1', reply: ['Gern. Sonst noch etwas?', 'با کمال میل. چیز دیگری هم؟'] },
        { who: G, de: 'Können Sie das bitte einpacken?', fa: 'می‌شود لطفاً این را بسته‌بندی کنید؟', when: 'وقتی غذایت زیاد آمده و می‌خواهی ببری.', lv: 'A2', reply: ['Ja, natürlich.', 'بله، البته.'] },
      ],
    },
    {
      title: 'پرداخت و خداحافظی',
      lines: [
        { who: G, de: 'Die Rechnung, bitte.', fa: 'صورت‌حساب، لطفاً.', when: 'در پایان. در آلمان تا نخواهی، صورت‌حساب را نمی‌آورند.', lv: 'A1', reply: ['Kommt sofort.', 'الان می‌آورم.'], alt: ['Zahlen, bitte!', 'Wir möchten zahlen.'] },
        { who: K, de: 'Zusammen oder getrennt?', fa: 'با هم حساب می‌کنید یا جدا؟', when: 'وقتی چند نفرید. جدا حساب کردن کاملاً عادی است.', lv: 'A2', reply: ['Getrennt, bitte.', 'جدا، لطفاً.'] },
        { who: G, de: 'Kann ich mit Karte zahlen?', fa: 'می‌توانم با کارت بپردازم؟', when: 'پیش از پرداخت بپرس؛ بعضی جاها فقط نقد می‌گیرند.', lv: 'A2', reply: ['Leider nur bar.', 'متأسفانه فقط نقد.'] },
        { who: K, de: 'Das macht zweiunddreißig Euro fünfzig.', fa: 'می‌شود سی‌ودو یورو و پنجاه سنت.', when: 'گارسون مبلغ را می‌گوید.', lv: 'A2', lit: '«این می‌سازد سی‌ودو یورو پنجاه.»' },
        { who: G, de: 'Stimmt so.', fa: 'بقیه‌اش مال خودتان.', when: 'وقتی نقد می‌دهی و می‌خواهی باقی پول انعام باشد.', lv: 'A2', lit: '«همین‌طور درست است.»', reply: ['Vielen Dank!', 'خیلی ممنون!'], alt: ['Der Rest ist für Sie.'] },
        { who: G, de: 'Ich lade dich ein.', fa: 'مهمان من باش.', when: 'به دوستت می‌گویی، یعنی حساب با من.', lv: 'A2', lit: '«من تو را دعوت می‌کنم.»', reply: ['Oh, danke! Das nächste Mal zahle ich.', 'وای، ممنون! دفعهٔ بعد من حساب می‌کنم.'] },
        { who: K, de: 'Vielen Dank und einen schönen Abend!', fa: 'خیلی ممنون و شب خوبی داشته باشید!', when: 'خداحافظی گارسون.', lv: 'A1', reply: ['Danke, gleichfalls!', 'ممنون، همچنین!'] },
      ],
    },
  ],
}

export const restaurantPacks = [restaurantWords, restaurantTalk]
