/**
 * The account e-mails (confirm sign-up, reset password, change e-mail) in the 10 interface
 * languages. Supabase sends one template per kind; inside it, the account's language
 * (user_metadata.language, set by the app) picks the wording. Accounts without one get English.
 *
 *   bun run scripts/email-templates.ts   → supabase/templates/{confirm,recovery,email-change}.html
 *
 * Paste each file into Supabase → Authentication → Emails → Templates (the subjects are below).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

type Kind = 'confirm' | 'recovery' | 'email-change'
type Text = { title: string; body: string; button: string; ignore: string }

const T: Record<string, Record<Kind, Text> & { sign: string }> = {
  en: {
    confirm: { title: 'Welcome to Hodhod!', body: 'Please confirm your e-mail address to finish creating your account.', button: 'Confirm my e-mail', ignore: "If you didn't sign up for Hodhod, you can ignore this e-mail." },
    recovery: { title: 'Reset your password', body: 'We received a request to reset your password. Tap the button to choose a new one.', button: 'Choose a new password', ignore: "If you didn't ask for this, you can ignore this e-mail — your password stays the same." },
    'email-change': { title: 'Confirm your new e-mail', body: 'Tap the button to use this address for your Hodhod account from now on.', button: 'Confirm new e-mail', ignore: "If you didn't ask for this, please ignore this e-mail." },
    sign: 'Happy learning — Hodhod',
  },
  fa: {
    confirm: { title: 'به هدهد خوش آمدی!', body: 'برای تمام شدن ساخت حسابت، لطفاً نشانی ایمیلت را تأیید کن.', button: 'تأیید ایمیل', ignore: 'اگر در هدهد ثبت‌نام نکرده‌ای، این ایمیل را نادیده بگیر.' },
    recovery: { title: 'تغییر رمز', body: 'درخواستی برای تغییر رمزت رسیده است. دکمه را بزن و رمز تازه انتخاب کن.', button: 'انتخاب رمز تازه', ignore: 'اگر چنین درخواستی نداده‌ای، این ایمیل را نادیده بگیر؛ رمزت عوض نمی‌شود.' },
    'email-change': { title: 'تأیید ایمیل تازه', body: 'دکمه را بزن تا از این به بعد این نشانی برای حساب هدهدت استفاده شود.', button: 'تأیید ایمیل تازه', ignore: 'اگر چنین درخواستی نداده‌ای، این ایمیل را نادیده بگیر.' },
    sign: 'یادگیری خوش بگذرد — هدهد',
  },
  de: {
    confirm: { title: 'Willkommen bei Hodhod!', body: 'Bitte bestätige deine E-Mail-Adresse, damit dein Konto fertig ist.', button: 'E-Mail bestätigen', ignore: 'Wenn du dich nicht bei Hodhod angemeldet hast, kannst du diese E-Mail ignorieren.' },
    recovery: { title: 'Passwort zurücksetzen', body: 'Wir haben eine Anfrage zum Zurücksetzen deines Passworts erhalten. Tippe auf den Button, um ein neues zu wählen.', button: 'Neues Passwort wählen', ignore: 'Wenn du das nicht angefordert hast, ignoriere diese E-Mail – dein Passwort bleibt gleich.' },
    'email-change': { title: 'Neue E-Mail bestätigen', body: 'Tippe auf den Button, um diese Adresse ab jetzt für dein Hodhod-Konto zu verwenden.', button: 'Neue E-Mail bestätigen', ignore: 'Wenn du das nicht angefordert hast, ignoriere bitte diese E-Mail.' },
    sign: 'Viel Spaß beim Lernen – Hodhod',
  },
  fr: {
    confirm: { title: 'Bienvenue sur Hodhod !', body: 'Confirme ton adresse e-mail pour terminer la création de ton compte.', button: 'Confirmer mon e-mail', ignore: 'Si tu ne t’es pas inscrit·e sur Hodhod, ignore cet e-mail.' },
    recovery: { title: 'Réinitialiser ton mot de passe', body: 'Nous avons reçu une demande de réinitialisation de ton mot de passe. Appuie sur le bouton pour en choisir un nouveau.', button: 'Choisir un nouveau mot de passe', ignore: 'Si tu n’as rien demandé, ignore cet e-mail : ton mot de passe ne change pas.' },
    'email-change': { title: 'Confirme ta nouvelle adresse', body: 'Appuie sur le bouton pour utiliser désormais cette adresse pour ton compte Hodhod.', button: 'Confirmer la nouvelle adresse', ignore: 'Si tu n’as rien demandé, ignore cet e-mail.' },
    sign: 'Bon apprentissage — Hodhod',
  },
  tr: {
    confirm: { title: 'Hodhod’a hoş geldin!', body: 'Hesabını oluşturmayı bitirmek için lütfen e-posta adresini onayla.', button: 'E-postamı onayla', ignore: 'Hodhod’a kaydolmadıysan bu e-postayı yok sayabilirsin.' },
    recovery: { title: 'Şifreni sıfırla', body: 'Şifreni sıfırlamak için bir istek aldık. Yeni bir şifre seçmek için düğmeye dokun.', button: 'Yeni şifre seç', ignore: 'Bunu sen istemediysen bu e-postayı yok say; şifren değişmez.' },
    'email-change': { title: 'Yeni e-postanı onayla', body: 'Bu adresi bundan sonra Hodhod hesabın için kullanmak üzere düğmeye dokun.', button: 'Yeni e-postayı onayla', ignore: 'Bunu sen istemediysen lütfen bu e-postayı yok say.' },
    sign: 'Keyifli öğrenmeler — Hodhod',
  },
  uk: {
    confirm: { title: 'Ласкаво просимо до Hodhod!', body: 'Підтверди, будь ласка, свою адресу e-mail, щоб завершити створення акаунта.', button: 'Підтвердити e-mail', ignore: 'Якщо ти не реєструвався в Hodhod, просто ігноруй цей лист.' },
    recovery: { title: 'Скидання пароля', body: 'Ми отримали запит на скидання твого пароля. Натисни кнопку, щоб вибрати новий.', button: 'Вибрати новий пароль', ignore: 'Якщо ти цього не просив, ігноруй цей лист — пароль не зміниться.' },
    'email-change': { title: 'Підтверди нову адресу', body: 'Натисни кнопку, щоб надалі використовувати цю адресу для акаунта Hodhod.', button: 'Підтвердити нову адресу', ignore: 'Якщо ти цього не просив, ігноруй цей лист.' },
    sign: 'Приємного навчання — Hodhod',
  },
  ru: {
    confirm: { title: 'Добро пожаловать в Hodhod!', body: 'Подтверди, пожалуйста, свой адрес e-mail, чтобы завершить создание аккаунта.', button: 'Подтвердить e-mail', ignore: 'Если ты не регистрировался в Hodhod, просто проигнорируй это письмо.' },
    recovery: { title: 'Сброс пароля', body: 'Мы получили запрос на сброс твоего пароля. Нажми кнопку, чтобы выбрать новый.', button: 'Выбрать новый пароль', ignore: 'Если ты этого не просил, проигнорируй письмо — пароль не изменится.' },
    'email-change': { title: 'Подтверди новый адрес', body: 'Нажми кнопку, чтобы дальше использовать этот адрес для аккаунта Hodhod.', button: 'Подтвердить новый адрес', ignore: 'Если ты этого не просил, проигнорируй это письмо.' },
    sign: 'Приятной учёбы — Hodhod',
  },
  ar: {
    confirm: { title: 'أهلًا بك في هدهد!', body: 'يُرجى تأكيد بريدك الإلكتروني لإكمال إنشاء حسابك.', button: 'تأكيد البريد', ignore: 'إذا لم تسجّل في هدهد، يمكنك تجاهل هذه الرسالة.' },
    recovery: { title: 'إعادة تعيين كلمة المرور', body: 'وصلنا طلب لإعادة تعيين كلمة مرورك. اضغط الزر لاختيار كلمة مرور جديدة.', button: 'اختيار كلمة مرور جديدة', ignore: 'إذا لم تطلب ذلك، تجاهل هذه الرسالة؛ ستبقى كلمة مرورك كما هي.' },
    'email-change': { title: 'تأكيد بريدك الجديد', body: 'اضغط الزر لاستخدام هذا العنوان لحسابك في هدهد من الآن فصاعدًا.', button: 'تأكيد البريد الجديد', ignore: 'إذا لم تطلب ذلك، يُرجى تجاهل هذه الرسالة.' },
    sign: 'تعلّمًا ممتعًا — هدهد',
  },
  es: {
    confirm: { title: '¡Te damos la bienvenida a Hodhod!', body: 'Confirma tu correo electrónico para terminar de crear tu cuenta.', button: 'Confirmar mi correo', ignore: 'Si no te registraste en Hodhod, puedes ignorar este correo.' },
    recovery: { title: 'Restablecer tu contraseña', body: 'Recibimos una solicitud para restablecer tu contraseña. Pulsa el botón para elegir una nueva.', button: 'Elegir una contraseña nueva', ignore: 'Si no lo pediste, ignora este correo: tu contraseña no cambia.' },
    'email-change': { title: 'Confirma tu nuevo correo', body: 'Pulsa el botón para usar esta dirección en tu cuenta de Hodhod a partir de ahora.', button: 'Confirmar nuevo correo', ignore: 'Si no lo pediste, ignora este correo.' },
    sign: 'Feliz aprendizaje — Hodhod',
  },
  nl: {
    confirm: { title: 'Welkom bij Hodhod!', body: 'Bevestig je e-mailadres om je account af te ronden.', button: 'E-mail bevestigen', ignore: 'Heb je je niet aangemeld bij Hodhod? Dan kun je deze e-mail negeren.' },
    recovery: { title: 'Wachtwoord opnieuw instellen', body: 'We kregen een verzoek om je wachtwoord opnieuw in te stellen. Tik op de knop om een nieuw wachtwoord te kiezen.', button: 'Nieuw wachtwoord kiezen', ignore: 'Heb je hier niet om gevraagd? Negeer deze e-mail — je wachtwoord blijft hetzelfde.' },
    'email-change': { title: 'Bevestig je nieuwe e-mail', body: 'Tik op de knop om dit adres voortaan voor je Hodhod-account te gebruiken.', button: 'Nieuwe e-mail bevestigen', ignore: 'Heb je hier niet om gevraagd? Negeer dan deze e-mail.' },
    sign: 'Veel leerplezier — Hodhod',
  },
}

/** Subjects stay short and in English plus the account language's title is in the body. */
export const SUBJECTS: Record<Kind, string> = {
  confirm: 'Hodhod · Confirm your e-mail ✉️',
  recovery: 'Hodhod · Reset your password 🔑',
  'email-change': 'Hodhod · Confirm your new e-mail ✉️',
}

const RTL = new Set(['fa', 'ar'])

function block(lang: string, kind: Kind, url: string): string {
  const t = T[lang]![kind]
  const dir = RTL.has(lang) ? 'rtl' : 'ltr'
  const align = RTL.has(lang) ? 'right' : 'left'
  return `<div dir="${dir}" lang="${lang}" style="text-align:${align}">
  <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#25223f">${t.title}</h1>
  <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#5c5978">${t.body}</p>
  <p style="margin:0 0 28px"><a href="${url}" style="display:inline-block;padding:14px 26px;border-radius:999px;background:#f5922b;color:#25223f;font-weight:700;font-size:16px;text-decoration:none">${t.button}</a></p>
  <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#8a87a3">${t.ignore}</p>
  <p style="margin:18px 0 0;font-size:14px;color:#5c5978">${T[lang]!.sign}</p>
</div>`
}

function template(kind: Kind): string {
  const url = '{{ .ConfirmationURL }}'
  const langs = Object.keys(T).filter((l) => l !== 'en')
  // printf turns a missing language into "<no value>", so eq never compares against nothing
  const branches = langs.map((l, i) => `{{ ${i === 0 ? 'if' : 'else if'} eq $lang "${l}" }}\n${block(l, kind, url)}`).join('\n')
  return `{{ $lang := printf "%v" .Data.language }}<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f4f3fb;font-family:Vazirmatn,Tahoma,'Segoe UI',Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f3fb;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:24px;padding:32px 28px;box-shadow:0 12px 28px -12px rgba(37,34,63,.22)">
<tr><td align="center" style="padding-bottom:18px"><img src="https://apphodhod.com/img/icon-192.png" width="64" height="64" alt="Hodhod" style="border-radius:16px"></td></tr>
<tr><td>
${branches}
{{ else }}
${block('en', kind, url)}
{{ end }}
</td></tr>
</table>
<p style="margin:18px 0 0;font-size:12px;color:#8a87a3;font-family:Arial,sans-serif">Hodhod · <a href="https://apphodhod.com" style="color:#8a87a3">apphodhod.com</a> · <a href="mailto:support@apphodhod.com" style="color:#8a87a3">support@apphodhod.com</a></p>
</td></tr>
</table>
</body>
</html>
`
}

if (import.meta.main) {
  const dir = join(import.meta.dir, '../supabase/templates')
  await mkdir(dir, { recursive: true })
  for (const kind of ['confirm', 'recovery', 'email-change'] as const) {
    await writeFile(join(dir, `${kind}.html`), template(kind))
    console.log(`${kind}.html   subject: ${SUBJECTS[kind]}`)
  }
}

export { template }
