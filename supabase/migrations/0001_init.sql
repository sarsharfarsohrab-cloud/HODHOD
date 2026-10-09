-- Hodhod — initial schema (stage 1: accounts, words, flashcards, review history, AI cache)
--
-- Conventions
--   * UUID primary keys, timestamptz everywhere, updated_at maintained by trigger.
--   * Every user-owned table has user_id → auth.users ON DELETE CASCADE and RLS that
--     only ever exposes rows where user_id = auth.uid().
--   * Words are soft-deleted (deleted_at); review history is append-only.
--   * A word is the lexical object; a card is one way of practising it (see cards.card_type).

-- ---------------------------------------------------------------------------
-- helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- reference data
-- ---------------------------------------------------------------------------

create table public.languages (
  code          text primary key check (code ~ '^[a-z]{2,3}$'),
  name_en       text not null,
  name_native   text not null,
  direction     text not null check (direction in ('ltr', 'rtl')),
  can_be_target boolean not null default false,
  can_be_native boolean not null default false
);

insert into public.languages (code, name_en, name_native, direction, can_be_target, can_be_native) values
  ('de', 'German',  'Deutsch', 'ltr', true,  false),
  ('fa', 'Persian', 'فارسی',   'rtl', false, true),
  ('en', 'English', 'English', 'ltr', false, false),
  ('fr', 'French',  'Français','ltr', false, false);

create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.app_config (key, value) values
  ('schema_version', '1'::jsonb),
  ('features', '{"quiz": false, "serverAudio": false}'::jsonb);

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

create table public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text check (display_name is null or char_length(display_name) <= 60),
  native_language        text not null default 'fa' references public.languages (code),
  active_target_language text not null default 'de' references public.languages (code),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.user_languages (
  user_id         uuid not null references auth.users (id) on delete cascade,
  target_language text not null references public.languages (code),
  created_at      timestamptz not null default now(),
  primary key (user_id, target_language)
);

create table public.user_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  new_per_day         integer not null default 10 check (new_per_day between 0 and 200),
  daily_goal_minutes  integer not null default 20 check (daily_goal_minutes between 1 and 600),
  -- null = automatic (no cap): due reviews are never hidden from the learner
  max_reviews_per_day integer check (max_reviews_per_day is null or max_reviews_per_day between 1 and 2000),
  desired_retention   numeric(3, 2) not null default 0.90 check (desired_retention between 0.70 and 0.97),
  theme               text not null default 'system' check (theme in ('system', 'light', 'dark')),
  speech_rate         numeric(3, 2) not null default 1.00 check (speech_rate between 0.50 and 1.50),
  autoplay_audio      boolean not null default false,
  updated_at          timestamptz not null default now()
);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger user_settings_touch before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- Creates the profile rows the moment an auth user appears.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 60), ''))
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.user_languages (user_id, target_language) values (new.id, 'de') on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- words
-- ---------------------------------------------------------------------------

create table public.words (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_language   text not null default 'de' references public.languages (code),
  native_language   text not null default 'fa' references public.languages (code),
  lemma             text not null check (char_length(lemma) between 1 and 80),
  -- duplicate key; capitalisation is significant in German (essen / Essen)
  normalized_lemma  text not null check (char_length(normalized_lemma) between 1 and 80),
  pos               text not null check (pos in (
                      'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun',
                      'article', 'numeral', 'interjection', 'particle', 'phrase', 'other')),
  cefr              text check (cefr in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  primary_meaning   text not null check (char_length(primary_meaning) between 1 and 200),
  -- Meanings, examples, grammar, conjugation, synonyms … as one validated document.
  -- It is always read and written together with the word, so it lives with the word;
  -- the columns above are the parts the database itself needs to filter and sort by.
  content           jsonb not null check (jsonb_typeof(content) = 'object'),
  content_version   integer not null default 1,
  is_favorite       boolean not null default false,
  source            text not null default 'ai' check (source in ('ai', 'manual')),
  ai_prompt_version text,
  ai_model          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create unique index words_unique_active
  on public.words (user_id, target_language, normalized_lemma, pos)
  where deleted_at is null;
create index words_user_updated on public.words (user_id, updated_at);

create trigger words_touch before update on public.words
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- cards (learning representation of a word)
-- ---------------------------------------------------------------------------

create table public.cards (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  word_id           uuid not null references public.words (id) on delete cascade,
  card_type         text not null default 'recognition' check (card_type in (
                      'recognition', 'production', 'sentence', 'listening', 'cloze')),
  state             text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning')),
  due               timestamptz not null default now(),
  stability         double precision not null default 0 check (stability >= 0),
  difficulty        double precision not null default 0 check (difficulty >= 0),
  scheduled_days    integer not null default 0 check (scheduled_days >= 0),
  learning_steps    integer not null default 0 check (learning_steps >= 0),
  reps              integer not null default 0 check (reps >= 0),
  lapses            integer not null default 0 check (lapses >= 0),
  last_review       timestamptz,
  -- first time the card left the "new" state; drives the new-cards-per-day limit
  introduced_at     timestamptz,
  scheduler_version text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (word_id, card_type)
);

create index cards_user_updated on public.cards (user_id, updated_at);
create index cards_user_due on public.cards (user_id, due);

create trigger cards_touch before update on public.cards
  for each row execute function public.touch_updated_at();

-- Saving a word puts it in the Word Bank with a "new" card. It is not being learned yet:
-- the daily queue decides when the card is introduced.
create or replace function public.create_default_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.cards (user_id, word_id, card_type)
  values (new.user_id, new.id, 'recognition')
  on conflict (word_id, card_type) do nothing;
  return new;
end;
$$;

create trigger words_create_card
  after insert on public.words
  for each row execute function public.create_default_card();

-- ---------------------------------------------------------------------------
-- review history (append-only)
-- ---------------------------------------------------------------------------

create table public.review_events (
  -- generated on the device so a retried upload can never be stored twice
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id           uuid not null references public.cards (id) on delete cascade,
  word_id           uuid not null references public.words (id) on delete cascade,
  rating            smallint not null check (rating between 1 and 4), -- 1 again, 2 hard, 3 good, 4 easy
  reviewed_at       timestamptz not null,
  duration_ms       integer check (duration_ms is null or duration_ms >= 0),
  state_before      text not null check (state_before in ('new', 'learning', 'review', 'relearning')),
  state_after       text not null check (state_after in ('new', 'learning', 'review', 'relearning')),
  stability_before  double precision,
  stability_after   double precision,
  difficulty_before double precision,
  difficulty_after  double precision,
  elapsed_days      double precision,
  scheduled_days    integer,
  due_before        timestamptz,
  due_after         timestamptz,
  scheduler_version text not null,
  session_id        uuid,
  created_at        timestamptz not null default now()
);

create index review_events_user_time on public.review_events (user_id, reviewed_at);
create index review_events_card_time on public.review_events (card_id, reviewed_at);

-- Stores one review and moves the card forward, atomically and idempotently.
--   * the same event id twice → second call changes nothing;
--   * an event older than the card's last review (another device was faster) is kept in
--     the history but does not overwrite the newer card state.
create or replace function public.apply_review(p_event jsonb, p_card jsonb)
returns public.cards
language plpgsql
set search_path = ''
as $$
declare
  v_card     public.cards;
  v_inserted integer;
  v_at       timestamptz := (p_event ->> 'reviewed_at')::timestamptz;
begin
  select * into v_card
  from public.cards
  where id = (p_event ->> 'card_id')::uuid and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;

  insert into public.review_events (
    id, user_id, card_id, word_id, rating, reviewed_at, duration_ms,
    state_before, state_after, stability_before, stability_after,
    difficulty_before, difficulty_after, elapsed_days, scheduled_days,
    due_before, due_after, scheduler_version, session_id
  ) values (
    (p_event ->> 'id')::uuid, auth.uid(), v_card.id, v_card.word_id,
    (p_event ->> 'rating')::smallint, v_at, (p_event ->> 'duration_ms')::integer,
    p_event ->> 'state_before', p_event ->> 'state_after',
    (p_event ->> 'stability_before')::double precision, (p_event ->> 'stability_after')::double precision,
    (p_event ->> 'difficulty_before')::double precision, (p_event ->> 'difficulty_after')::double precision,
    (p_event ->> 'elapsed_days')::double precision, (p_event ->> 'scheduled_days')::integer,
    (p_event ->> 'due_before')::timestamptz, (p_event ->> 'due_after')::timestamptz,
    p_event ->> 'scheduler_version', (p_event ->> 'session_id')::uuid
  )
  on conflict (id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 and (v_card.last_review is null or v_card.last_review <= v_at) then
    update public.cards set
      state             = p_card ->> 'state',
      due               = (p_card ->> 'due')::timestamptz,
      stability         = (p_card ->> 'stability')::double precision,
      difficulty        = (p_card ->> 'difficulty')::double precision,
      scheduled_days    = (p_card ->> 'scheduled_days')::integer,
      learning_steps    = (p_card ->> 'learning_steps')::integer,
      reps              = (p_card ->> 'reps')::integer,
      lapses            = (p_card ->> 'lapses')::integer,
      last_review       = v_at,
      introduced_at     = coalesce(v_card.introduced_at, v_at),
      scheduler_version = p_event ->> 'scheduler_version'
    where id = v_card.id
    returning * into v_card;
  end if;

  return v_card;
end;
$$;

-- Per-day study totals in the learner's own time zone. The study day starts at 04:00
-- so a late-night session still belongs to the day it began on.
create or replace function public.activity_by_day(p_time_zone text, p_since date)
returns table (day date, reviews integer, again integer, new_cards integer, duration_ms bigint)
language sql
stable
set search_path = ''
as $$
  select
    ((e.reviewed_at at time zone p_time_zone) - interval '4 hours')::date as day,
    count(*)::integer,
    count(*) filter (where e.rating = 1)::integer,
    count(*) filter (where e.state_before = 'new')::integer,
    coalesce(sum(e.duration_ms), 0)::bigint
  from public.review_events e
  where e.user_id = auth.uid()
    and e.reviewed_at >= (p_since::timestamp at time zone p_time_zone)
  group by 1
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- AI bookkeeping (server only)
-- ---------------------------------------------------------------------------

-- Finished analyses, shared between users: the same word is generated once.
-- A learner's own edits live in their words row and never come back here.
create table public.ai_word_cache (
  id              uuid primary key default gen_random_uuid(),
  target_language text not null references public.languages (code),
  native_language text not null references public.languages (code),
  input_key       text not null,
  prompt_version  text not null,
  model           text not null,
  result          jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (target_language, native_language, input_key, prompt_version)
);

create table public.ai_generation_logs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete set null,
  kind           text not null,
  input          text,
  status         text not null check (status in ('ok', 'rejected', 'error', 'cache_hit')),
  error_code     text,
  prompt_version text,
  model          text,
  input_tokens   integer,
  output_tokens  integer,
  duration_ms    integer,
  created_at     timestamptz not null default now()
);

create index ai_logs_user_time on public.ai_generation_logs (user_id, created_at);
create index ai_logs_time on public.ai_generation_logs (created_at);

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.languages          enable row level security;
alter table public.app_config         enable row level security;
alter table public.profiles           enable row level security;
alter table public.user_languages     enable row level security;
alter table public.user_settings      enable row level security;
alter table public.words              enable row level security;
alter table public.cards              enable row level security;
alter table public.review_events      enable row level security;
alter table public.ai_word_cache      enable row level security; -- no policies: service role only
alter table public.ai_generation_logs enable row level security;

create policy languages_read on public.languages for select to authenticated using (true);
create policy app_config_read on public.app_config for select to authenticated using (true);

create policy profiles_select on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy user_languages_select on public.user_languages for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_languages_insert on public.user_languages for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy user_settings_select on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_settings_update on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy words_select on public.words for select to authenticated using (user_id = (select auth.uid()));
create policy words_insert on public.words for insert to authenticated with check (user_id = (select auth.uid()));
create policy words_update on public.words for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- no delete policy: words are archived (deleted_at), rows disappear only with the account

create policy cards_select on public.cards for select to authenticated using (user_id = (select auth.uid()));
create policy cards_insert on public.cards for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.words w where w.id = word_id and w.user_id = (select auth.uid()))
  );
create policy cards_update on public.cards for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy review_events_select on public.review_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy review_events_insert on public.review_events for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );
-- no update/delete policy: history is append-only

create policy ai_logs_select on public.ai_generation_logs for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- privileges (explicit, so the result does not depend on project defaults)
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

grant select on public.languages, public.app_config to authenticated;
grant select, update on public.profiles, public.user_settings to authenticated;
grant select, insert on public.user_languages to authenticated;
grant select, insert, update on public.words, public.cards to authenticated;
grant select, insert on public.review_events to authenticated;
grant select on public.ai_generation_logs to authenticated;

grant execute on function public.apply_review(jsonb, jsonb) to authenticated;
grant execute on function public.activity_by_day(text, date) to authenticated;

grant all on all tables in schema public to service_role;
