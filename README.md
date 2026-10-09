# هدهد (Hodhod)

اپ یادگیری واژه‌های آلمانی برای فارسی‌زبانان: یک کلمه می‌نویسی، هوش مصنوعی کارتش را آماده می‌کند، بعد از تأیید تو در بانک واژه ذخیره می‌شود و با مرور فاصله‌دار (FSRS) به‌نوبت سراغت می‌آید.

A vocabulary app for Persian speakers learning German. Installable web app (PWA) for iPhone, Android and desktop browsers.

- **Stage 1 (this version):** accounts, AI word creation with a mandatory draft/confirm step, Word Bank (search, filters, favourites, archive), word detail with full conjugation and audio, FSRS flashcards with a daily queue, streak and daily goal, settings, offline reviews, data export, account deletion.
- **Not built yet:** quiz, statistics pages, XP/achievements, reverse (Persian → German) cards, server-generated audio, push notifications, Google/Apple sign-in, guest mode. The data model has room for them (see [Roadmap](#roadmap)).

---

## Architecture

```
Browser (static files, no framework)            Supabase project
┌───────────────────────────────┐   HTTPS   ┌──────────────────────────────────────┐
│ src/ui      screens, widgets  │──────────▶│ Auth          e-mail + password       │
│ src/core    scheduler, queue  │           │ Postgres      tables + row level sec. │
│ src/data    sync, outbox,     │           │ Edge Function analyze-word ──▶ AI API │
│             IndexedDB copy    │           │ Edge Function delete-account          │
└───────────────────────────────┘           └──────────────────────────────────────┘
```

| Layer | Where | Notes |
|---|---|---|
| Presentation | `src/ui/` | Plain TypeScript + DOM. All texts in `src/ui/strings.ts`; design tokens in `src/ui/app.css`. |
| Domain | `src/core/` | Pure functions, no browser APIs: scheduler interface, FSRS adapter, daily queue, streak, conjugation. |
| Data | `src/data/` | Small Supabase HTTP client, on-device copy (IndexedDB), outbox, delta sync. |
| Shared rules | `supabase/functions/_shared/` | Input rules and the word-content validator, used by **both** the server function and the app. |
| AI service | `supabase/functions/analyze-word/` | The only code that sees the AI key. Versioned prompt, strict JSON schema, validation, one repair attempt, cache, rate limits, usage log. |
| Database | `supabase/migrations/` | Reproducible SQL migrations. |

Key decisions:

- **No runtime dependencies.** The only third-party code is the FSRS reference implementation [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 5.4.2 (MIT), vendored unmodified in `vendor/ts-fsrs`, and the Vazirmatn font (OFL). The Supabase client in `src/data/supabase.ts` is a thin wrapper over the documented HTTP APIs.
- **Word ≠ card.** `words` holds the lexical content; `cards` is a way of practising a word (`card_type`). Today only `recognition` cards are created.
- **Word content is one validated JSON document** (`words.content`) instead of separate meaning/example/conjugation tables: it is always read and written with the word, and one validator (`wordSchema.ts`) guards every write. Columns the database needs for filtering (`lemma`, `pos`, `cefr`, `primary_meaning`) are kept in step with it.
- **Compound tenses are derived, not generated.** The AI returns Präsens, Präteritum, Konjunktiv I/II, Imperativ and Partizip II; Perfekt, Plusquamperfekt, Futur I/II are built by rule in `src/core/conjugation.ts`.
- **Scheduler:** FSRS-6 with default parameters, learning steps 1 min / 10 min, relearning 10 min, target retention 90 % (adjustable). Every review event stores the scheduler version.
- **Study day starts at 04:00** local time, in the app and in the database function `activity_by_day`.

### Sync and conflicts

- The app keeps a copy of the account's words and cards in IndexedDB (one database per account) and downloads only rows changed since the last sync (keyset cursor on `updated_at, id`).
- Reviews, favourites, archiving and settings are applied locally and queued in an outbox. Review uploads are idempotent (client-generated event id, `apply_review` RPC); an older review arriving late is kept in history but never rewinds a newer card state.
- Editing a word uses optimistic concurrency (`updated_at` must match). On a conflict the newer version is loaded and the user is told; nothing is overwritten silently.
- Creating and editing words needs a connection. Reading the bank and reviewing work offline.

---

## Setup

### 1. Supabase

1. Create a project. Copy **Project URL** and the **publishable (anon) key** into `public/config.js` (see `public/config.example.js`). These two values are public by design.
2. Run the migrations in order. Dashboard: *SQL Editor* → paste `supabase/migrations/0001_init.sql` → *Run*. CLI: `supabase link --project-ref <ref> && supabase db push`.
3. Deploy the two Edge Functions.
   - CLI: `supabase functions deploy analyze-word delete-account`
   - Dashboard: *Edge Functions → Deploy a new function → Via Editor*, name it exactly `analyze-word`, paste `deploy/analyze-word.ts` (generate with `bun run bundle:functions`); repeat for `delete-account`.
   - Turn **Verify JWT with legacy secret** off for both (function *Settings*). The functions verify the caller themselves by asking Supabase Auth, which also works with the newer signing keys.
4. Set the function secrets (*Edge Functions → Secrets*). Names and defaults are listed in [`.env.example`](.env.example). Required: `AI_API_KEY`.
5. *Authentication → URL Configuration*: set **Site URL** to the address the app is served from and add it to **Redirect URLs** (needed for e-mail confirmation and password-reset links).
6. For a private installation: create the accounts, then turn off *Authentication → Sign In / Providers → Allow new users to sign up*. Otherwise anyone who finds the address can register and use AI credit (bounded by the limits in `.env.example`).

### 2. AI provider

| Secret | OpenAI | Mistral |
|---|---|---|
| `AI_PROVIDER` | `openai` (default) | `mistral` |
| `AI_API_KEY` | `sk-…` | key from console.mistral.ai |
| `AI_MODEL` | default `gpt-6-luna` | default `mistral-large-latest` |

Any other service that accepts the OpenAI *Responses* or *chat-completions* format with a strict JSON schema works via `AI_BASE_URL`, `AI_API_STYLE` and `AI_MODEL`.

### 3. Local development

Requires [Bun](https://bun.sh) ≥ 1.2. Nothing to install.

```sh
bun run typecheck        # tsc (needs `typescript` on PATH or `bun install`)
bun test tests/unit      # 150+ unit tests
./scripts/test-db.sh     # migrations + RLS tests on a throw-away local PostgreSQL
bun run build            # → dist/
bun run dev              # build and serve dist/ on http://localhost:4173
bun run e2e              # browser tests (needs Playwright: NODE_PATH=$(npm root -g))
```

### 4. Deployment

`dist/` is a folder of static files; any static host works.

- **GitHub Pages:** push to `main`; `.github/workflows/deploy.yml` tests, builds and publishes. In the repository: *Settings → Pages → Source: GitHub Actions*.
- The app uses hash routes (`#/home`), so no server rewrite rules are needed and it works from a sub-path.

### 5. Installing on a phone

iPhone: open the address in **Safari** → Share → **Add to Home Screen**. Android (Chrome): menu → *Install app*.

---

## Tests

| What | Where | Runs against |
|---|---|---|
| Input rules, content validation, conjugation, FSRS (incl. reference vectors from ts-fsrs/fsrs-rs), queue, streak, search/filter | `tests/unit/*.test.ts` | pure functions |
| AI function: auth, input, repair/retry, timeouts, provider errors, cache, rate limits | `tests/unit/analyzeWord.test.ts` | stand-ins for the AI API and Supabase, defined in the test file |
| Sign-in, token refresh, save/edit/duplicates, offline reviews, idempotent upload, two devices, paging, export, account deletion, isolation between accounts | `tests/unit/appData.test.ts` | `tests/fake-backend/fakeSupabase.ts` |
| Schema, triggers, RLS, `apply_review`, `activity_by_day`, cascade delete | `tests/db/*.sql` | a real local PostgreSQL |
| Full user flows on phone, small phone, landscape and desktop sizes | `tests/e2e/run.mjs` | Chromium + the fake backend |

`tests/fake-backend` and `tests/fixtures` are **test-only**: nothing under `src/` imports them and they are not part of the build. They exist because failures such as timeouts, malformed AI output or a lost response cannot be provoked on the real services.

## Security and privacy

- AI keys and the Supabase service-role key exist only as Edge Function secrets. The browser bundle contains the project URL and the publishable key, nothing else.
- Every user-owned table has row level security (`user_id = auth.uid()`); `tests/db/10_rls_and_reviews.sql` checks that one account cannot read or change another's rows. Review history is append-only; words are soft-deleted.
- `analyze-word` requires a valid session, validates input before spending anything, limits fresh generations per user per minute/day and globally per day, and refuses to run if it cannot check usage.
- The word typed by a learner is sent to the AI provider. Name and e-mail are not. Finished analyses are cached and shared between accounts; a learner's edits are not.
- `delete-account` removes the auth user; all owned rows go with it (`ON DELETE CASCADE`). AI usage logs are kept without the user id.
- A Content-Security-Policy in `index.html` allows scripts, styles and fonts from the app's own origin only.

## Known limitations

- **Not verified on real devices or against the live services from the development environment.** Automated browser tests run in Chromium against the test backend. iPhone Safari, home-screen installation, real Supabase and the real AI provider have to be checked once after deployment.
- **Audio** uses the device's built-in German voice (Web Speech API). Quality depends on the device; some desktop browsers have no German voice; the play buttons disappear once the browser reports that.
- **AI content can be wrong.** It is validated for structure, not for linguistic truth — that is why every card is a draft until confirmed, and every field is editable. CEFR levels are estimates.
- **Notifications** are not implemented. On iOS they would require the installed PWA plus a push server.
- Default AI model names in `aiProviders.ts` are configuration, not something the tests can verify; override with `AI_MODEL` if a provider renames a model.
- Offline: a brand-new device must sync once online before it can be used offline.

## Roadmap

1. Quiz (multiple choice and typing from the learner's own words; cloze via AI) with `quiz_*` tables kept separate from review history.
2. Statistics (retention, forecast, difficult words).
3. XP, levels, milestones; streak freeze.
4. Server-side audio with caching behind the existing `AudioProvider` interface.
5. Production cards (Persian → German) via `cards.card_type`.
6. Google / Apple sign-in; native packaging (Capacitor) for the App Store.

## Licences

Application code: © the project owner. `vendor/ts-fsrs`: MIT (see `vendor/ts-fsrs/LICENSE`). Vazirmatn font: SIL Open Font License 1.1 (see `src/ui/fonts/OFL.txt`).
