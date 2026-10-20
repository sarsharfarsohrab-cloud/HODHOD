-- Hodhod — stage 3: admin panel, word-pack store, sentence and expression cards,
-- feedback and error reports, AI budget, natural voice, push reminders, friends,
-- short stories, onboarding.
--
-- Safe to run on a database that already has data. Everything is additive, and the
-- previously deployed app keeps working after this migration.

-- ---------------------------------------------------------------------------
-- words: sentences, longer expressions, words from packs and imports
-- ---------------------------------------------------------------------------

alter table public.words drop constraint if exists words_lemma_check;
alter table public.words add constraint words_lemma_check check (char_length(lemma) between 1 and 200);
alter table public.words drop constraint if exists words_normalized_lemma_check;
alter table public.words add constraint words_normalized_lemma_check check (char_length(normalized_lemma) between 1 and 200);
alter table public.words drop constraint if exists words_pos_check;
alter table public.words add constraint words_pos_check check (pos in (
  'noun', 'verb', 'adjective', 'adverb', 'preposition', 'conjunction', 'pronoun',
  'article', 'numeral', 'interjection', 'particle', 'phrase', 'sentence', 'other'));
alter table public.words drop constraint if exists words_primary_meaning_check;
alter table public.words add constraint words_primary_meaning_check check (char_length(primary_meaning) between 1 and 300);
alter table public.words drop constraint if exists words_source_check;
alter table public.words add constraint words_source_check check (source in ('ai', 'manual', 'pack', 'import'));

-- ---------------------------------------------------------------------------
-- settings: onboarding, voice, reminders, celebrations
-- ---------------------------------------------------------------------------

alter table public.user_settings
  add column time_zone text check (time_zone is null or char_length(time_zone) <= 64),
  add column onboarded_at timestamptz,
  add column ai_voice boolean not null default true,
  add column notify_daily boolean not null default false,
  add column notify_time text not null default '20:00' check (notify_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  add column notify_streak boolean not null default true,
  add column notify_updates boolean not null default true,
  add column celebrated_streaks integer[] not null default '{}' check (cardinality(celebrated_streaks) <= 50);

-- Accounts that exist already have chosen their settings: no welcome tour for them.
update public.user_settings set onboarded_at = now() where onboarded_at is null;

-- ---------------------------------------------------------------------------
-- administrators
-- ---------------------------------------------------------------------------

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- Makes the account with this e-mail address an administrator. Run it once in the SQL editor.
create or replace function public.make_admin(p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    return 'no account with this e-mail address';
  end if;
  insert into public.admins (user_id) values (v_id) on conflict do nothing;
  return 'ok';
end;
$$;

-- Per-account overrides set from the admin panel.
create table public.user_limits (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  ai_per_day integer check (ai_per_day is null or ai_per_day between 0 and 5000),
  blocked    boolean not null default false,
  note       text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now()
);

create trigger user_limits_touch before update on public.user_limits
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- AI spending: prices, budget, credit bought
-- ---------------------------------------------------------------------------

insert into public.app_config (key, value) values
  -- US dollars per one million tokens (text) or characters (speech). Edited in the admin panel.
  ('ai_prices', '{"default": {"input": 1.25, "output": 10.0}, "tts": {"input": 15.0, "output": 0}}'::jsonb),
  -- daily_usd: new generations stop for the day above this; new accounts get a smaller allowance
  ('ai_budget', '{"daily_usd": 1.5, "new_user_days": 3, "new_user_per_day": 30, "tts_per_day": 300, "stories_per_day": 3}'::jsonb)
on conflict (key) do nothing;

create table public.ai_credit_entries (
  id         uuid primary key default gen_random_uuid(),
  amount_usd numeric(10, 2) not null check (amount_usd between -10000 and 10000),
  kind       text not null default 'topup' check (kind in ('topup', 'balance')),
  note       text check (note is null or char_length(note) <= 300),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Cost of one logged call, from the price table above.
create or replace function public.ai_cost(p_kind text, p_model text, p_in integer, p_out integer)
returns numeric
language sql
stable
set search_path = ''
as $$
  with prices as (select value as v from public.app_config where key = 'ai_prices')
  select coalesce(
    (
      select
        coalesce(p_in, 0)::numeric * coalesce((pr -> 'input')::text::numeric, 0) / 1000000
        + coalesce(p_out, 0)::numeric * coalesce((pr -> 'output')::text::numeric, 0) / 1000000
      from prices,
      lateral (select coalesce(
        case when p_kind = 'tts' then prices.v -> 'tts' end,
        prices.v -> p_model,
        prices.v -> 'default'
      ) as pr) x
    ),
    0
  );
$$;

-- What the AI function needs to decide whether a fresh generation may run.
create or replace function public.ai_budget_status(p_user uuid, p_kind text)
returns table (
  spent_today_usd numeric,
  daily_usd numeric,
  user_today integer,
  user_limit integer,
  blocked boolean,
  account_age_hours numeric,
  new_user_days integer,
  new_user_per_day integer,
  kind_per_day integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with budget as (select value as v from public.app_config where key = 'ai_budget')
  select
    coalesce((
      select sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens))
      from public.ai_generation_logs l
      where l.created_at >= date_trunc('day', now()) and l.status in ('ok', 'rejected')
    ), 0),
    coalesce((select (v ->> 'daily_usd')::numeric from budget), 1.5),
    (
      select count(*)::integer from public.ai_generation_logs l
      where l.user_id = p_user and l.kind = p_kind
        and l.created_at >= now() - interval '1 day' and l.status in ('ok', 'rejected', 'error')
    ),
    (select ul.ai_per_day from public.user_limits ul where ul.user_id = p_user),
    coalesce((select ul.blocked from public.user_limits ul where ul.user_id = p_user), false),
    coalesce((select extract(epoch from now() - u.created_at) / 3600 from auth.users u where u.id = p_user), 1000000),
    coalesce((select (v ->> 'new_user_days')::integer from budget), 3),
    coalesce((select (v ->> 'new_user_per_day')::integer from budget), 30),
    case p_kind
      when 'tts' then coalesce((select (v ->> 'tts_per_day')::integer from budget), 300)
      when 'story' then coalesce((select (v ->> 'stories_per_day')::integer from budget), 3)
      else null
    end;
$$;

-- ---------------------------------------------------------------------------
-- feedback, client errors, reports about wrong cards
-- ---------------------------------------------------------------------------

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  kind       text not null check (kind in ('bug', 'idea', 'other')),
  message    text not null check (char_length(message) between 1 and 2000),
  context    jsonb not null default '{}'::jsonb check (pg_column_size(context) < 8000),
  status     text not null default 'new' check (status in ('new', 'seen', 'done')),
  created_at timestamptz not null default now()
);

create table public.client_errors (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  message     text not null check (char_length(message) <= 500),
  stack       text check (stack is null or char_length(stack) <= 4000),
  url         text check (url is null or char_length(url) <= 300),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
create index client_errors_time on public.client_errors (created_at);

-- Stores an error report from the app; at most 30 per account and hour.
create or replace function public.log_client_error(p_message text, p_stack text, p_url text, p_version text, p_agent text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;
  if (select count(*) from public.client_errors e where e.user_id = auth.uid() and e.created_at > now() - interval '1 hour') >= 30 then
    return false;
  end if;
  insert into public.client_errors (user_id, message, stack, url, app_version, user_agent)
  values (auth.uid(), left(coalesce(p_message, '?'), 500), left(p_stack, 4000), left(p_url, 300), left(p_version, 40), left(p_agent, 300));
  return true;
end;
$$;

create table public.card_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  word_id    uuid references public.words (id) on delete set null,
  lemma      text not null check (char_length(lemma) <= 200),
  pos        text,
  reason     text not null check (reason in ('meaning', 'example', 'grammar', 'audio', 'other')),
  message    text check (message is null or char_length(message) <= 1000),
  content    jsonb,
  status     text not null default 'new' check (status in ('new', 'fixed', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- ---------------------------------------------------------------------------
-- announcements (shown in the app, optionally sent as a push message)
-- ---------------------------------------------------------------------------

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 120),
  body         text check (body is null or char_length(body) <= 1000),
  published    boolean not null default true,
  push_sent_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- word-pack store
-- ---------------------------------------------------------------------------

create table public.packs (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,80}$'),
  topic          text not null default 'general' check (char_length(topic) <= 60),
  kind           text not null default 'words' check (kind in ('words', 'expressions', 'sentences', 'mixed')),
  level          text check (level in ('basic', 'advanced')),
  title          text not null check (char_length(title) between 1 and 120),
  description    text check (description is null or char_length(description) <= 500),
  emoji          text check (emoji is null or char_length(emoji) <= 16),
  lesson_size    integer not null default 12 check (lesson_size between 5 and 40),
  published      boolean not null default false,
  sort_order     integer not null default 0,
  target_language text not null default 'de' references public.languages (code),
  native_language text not null default 'fa' references public.languages (code),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.pack_items (
  id               uuid primary key default gen_random_uuid(),
  pack_id          uuid not null references public.packs (id) on delete cascade,
  position         integer not null check (position >= 0),
  lesson           integer not null default 1 check (lesson between 1 and 500),
  input            text not null check (char_length(input) between 1 and 200),
  hint             text check (hint is null or char_length(hint) <= 200),
  status           text not null default 'draft' check (status in ('draft', 'ready', 'failed')),
  lemma            text check (lemma is null or char_length(lemma) <= 200),
  normalized_lemma text check (normalized_lemma is null or char_length(normalized_lemma) <= 200),
  pos              text,
  cefr             text,
  primary_meaning  text check (primary_meaning is null or char_length(primary_meaning) <= 300),
  content          jsonb check (content is null or jsonb_typeof(content) = 'object'),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (pack_id, position)
);
create index pack_items_pack on public.pack_items (pack_id, lesson, position);

create trigger packs_touch before update on public.packs
  for each row execute function public.touch_updated_at();
create trigger pack_items_touch before update on public.pack_items
  for each row execute function public.touch_updated_at();

create table public.user_packs (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pack_id  uuid not null references public.packs (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

alter table public.words
  add column pack_id uuid references public.packs (id) on delete set null,
  add column pack_item_id uuid references public.pack_items (id) on delete set null;
create index words_pack on public.words (user_id, pack_id) where pack_id is not null;

-- Puts the words of one lesson of a pack into the learner's bank. Words the learner
-- already has are left alone. Returns how many words were added.
create or replace function public.start_pack_lesson(p_pack uuid, p_lesson integer)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_title text;
  v_count integer;
begin
  select p.title into v_title from public.packs p where p.id = p_pack and p.published;
  if v_title is null then
    raise exception 'pack not found' using errcode = 'P0002';
  end if;
  insert into public.user_packs (user_id, pack_id) values (auth.uid(), p_pack) on conflict do nothing;

  insert into public.words (
    user_id, target_language, native_language, lemma, normalized_lemma, pos, cefr, primary_meaning,
    content, content_version, source, tags, pack_id, pack_item_id
  )
  select
    auth.uid(), p.target_language, p.native_language, i.lemma, i.normalized_lemma, i.pos, i.cefr, i.primary_meaning,
    i.content, coalesce((i.content ->> 'version')::integer, 1), 'pack', array[left(v_title, 30)], p.id, i.id
  from public.pack_items i
  join public.packs p on p.id = i.pack_id
  where i.pack_id = p_pack and i.lesson = p_lesson and i.status = 'ready'
    and not exists (
      select 1 from public.words w
      where w.user_id = auth.uid() and w.target_language = p.target_language
        and w.normalized_lemma = i.normalized_lemma and w.pos = i.pos and w.deleted_at is null
    )
  order by i.position
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- several words at once (import from Anki / Quizlet files)
-- ---------------------------------------------------------------------------

create or replace function public.import_words(p_words jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  if jsonb_typeof(p_words) <> 'array' or jsonb_array_length(p_words) > 500 then
    raise exception 'invalid import' using errcode = '22023';
  end if;
  insert into public.words (
    user_id, target_language, native_language, lemma, normalized_lemma, pos, cefr, primary_meaning,
    content, content_version, source, tags
  )
  select
    auth.uid(), coalesce(w.target_language, 'de'), coalesce(w.native_language, 'fa'), w.lemma, w.normalized_lemma,
    w.pos, w.cefr, w.primary_meaning, w.content, coalesce(w.content_version, 1), 'import', coalesce(w.tags, '{}')
  from jsonb_to_recordset(p_words) as w (
    target_language text, native_language text, lemma text, normalized_lemma text, pos text, cefr text,
    primary_meaning text, content jsonb, content_version integer, tags text[]
  )
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- natural voice (generated once per text, shared by everyone)
-- ---------------------------------------------------------------------------

create table public.tts_cache (
  hash       text primary key check (hash ~ '^[0-9a-f]{64}$'),
  path       text not null,
  chars      integer not null,
  voice      text not null,
  model      text not null,
  created_at timestamptz not null default now()
);

-- the public bucket holding the audio files (only on a real Supabase project)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'storage' and c.relname = 'buckets') then
    execute $q$insert into storage.buckets (id, name, public) values ('tts', 'tts', true) on conflict (id) do nothing$q$;
  end if;
end;
$$;

-- Consecutive study days ending today (or yesterday, if today has not been studied yet).
create or replace function public.user_streak(p_user uuid, p_tz text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with days as (
    select distinct ((e.reviewed_at at time zone p_tz) - interval '4 hours')::date as d
    from public.review_events e
    where e.user_id = p_user and e.undone_at is null and e.reviewed_at > now() - interval '400 days'
  ),
  today as (select ((now() at time zone p_tz) - interval '4 hours')::date as t),
  anchor as (
    select case
      when exists (select 1 from days, today where d = t) then (select t from today)
      when exists (select 1 from days, today where d = t - 1) then (select t - 1 from today)
      else null
    end as a
  ),
  numbered as (
    select d, (select a from anchor) - d as gap, row_number() over (order by d desc) - 1 as rn
    from days where d <= (select a from anchor)
  )
  select coalesce((select count(*)::integer from numbered where gap = rn), 0);
$$;

-- ---------------------------------------------------------------------------
-- push reminders
-- ---------------------------------------------------------------------------

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint        text not null unique check (char_length(endpoint) <= 1000 and endpoint like 'https://%'),
  p256dh          text not null check (char_length(p256dh) <= 200),
  auth            text not null check (char_length(auth) <= 100),
  user_agent      text check (user_agent is null or char_length(user_agent) <= 300),
  failures        integer not null default 0,
  last_success_at timestamptz,
  created_at      timestamptz not null default now()
);

-- Keys and the scheduler's password; readable by the server functions only.
create table public.push_secrets (
  id            integer primary key default 1 check (id = 1),
  vapid_public  text,
  vapid_private jsonb,
  cron_secret   text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now()
);

create table public.notification_log (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null check (kind in ('daily', 'streak', 'update', 'announcement', 'test')),
  ref     text,
  sent_at timestamptz not null default now()
);
create index notification_log_user_time on public.notification_log (user_id, sent_at);

-- Who should get a reminder now. Called by the push function every 15 minutes.
create or replace function public.push_candidates(p_now timestamptz)
returns table (user_id uuid, kind text, due_count integer, streak integer)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select
      s.user_id,
      coalesce(s.time_zone, 'Europe/Berlin') as tz,
      s.notify_daily, s.notify_time, s.notify_streak
    from public.user_settings s
    where (s.notify_daily or s.notify_streak)
      and exists (select 1 from public.push_subscriptions ps where ps.user_id = s.user_id)
  ),
  clock as (
    select
      p.*,
      (p_now at time zone p.tz) as local_now,
      ((p_now at time zone p.tz) - interval '4 hours')::date as study_day
    from people p
  ),
  enriched as (
    select
      c.*,
      (select count(*)::integer from public.cards k join public.words w on w.id = k.word_id
        where k.user_id = c.user_id and w.deleted_at is null and k.card_type = 'recognition'
          and k.state <> 'new' and k.due <= p_now + interval '4 hours') as due_count,
      exists (
        select 1 from public.review_events e
        where e.user_id = c.user_id and e.undone_at is null
          and ((e.reviewed_at at time zone c.tz) - interval '4 hours')::date = c.study_day
      ) as studied_today,
      public.user_streak(c.user_id, c.tz) as streak,
      (select count(*) from public.notification_log n
        where n.user_id = c.user_id and n.sent_at > p_now - interval '20 hours' and n.kind in ('daily', 'streak')) as sent_recently
    from clock c
  )
  select e.user_id, 'daily', e.due_count, e.streak
  from enriched e
  where e.notify_daily and not e.studied_today and e.due_count > 0 and e.sent_recently = 0
    and e.local_now::time >= e.notify_time::time
    and e.local_now::time < e.notify_time::time + interval '15 minutes'
  union all
  select e.user_id, 'streak', e.due_count, e.streak
  from enriched e
  where e.notify_streak and not e.studied_today and e.streak > 0
    and e.local_now::time >= time '20:30' and e.local_now::time < time '20:45'
    and not exists (select 1 from public.notification_log n
      where n.user_id = e.user_id and n.kind = 'streak' and n.sent_at > p_now - interval '20 hours');
$$;

-- ---------------------------------------------------------------------------
-- streaks and friends
-- ---------------------------------------------------------------------------

alter table public.profiles add column friend_code text unique check (friend_code is null or friend_code ~ '^[A-Z2-9]{8}$');

create or replace function public.new_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = v_code);
  end loop;
  return v_code;
end;
$$;

update public.profiles set friend_code = public.new_friend_code() where friend_code is null;

create or replace function public.set_friend_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.friend_code is null then
    new.friend_code := public.new_friend_code();
  end if;
  return new;
end;
$$;

create trigger profiles_friend_code before insert on public.profiles
  for each row execute function public.set_friend_code();

create table public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester    uuid not null references auth.users (id) on delete cascade,
  addressee    uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
create unique index friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

create or replace function public.friend_request(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid;
  v_existing public.friendships;
begin
  select p.id into v_other from public.profiles p where p.friend_code = upper(trim(p_code));
  if v_other is null then
    return 'not_found';
  end if;
  if v_other = auth.uid() then
    return 'self';
  end if;
  select * into v_existing from public.friendships f
  where least(f.requester, f.addressee) = least(auth.uid(), v_other)
    and greatest(f.requester, f.addressee) = greatest(auth.uid(), v_other);
  if found then
    if v_existing.status = 'pending' and v_existing.addressee = auth.uid() then
      update public.friendships set status = 'accepted', responded_at = now() where id = v_existing.id;
      return 'accepted';
    end if;
    return 'exists';
  end if;
  if (select count(*) from public.friendships f where f.requester = auth.uid() and f.status = 'pending') >= 20 then
    return 'too_many';
  end if;
  insert into public.friendships (requester, addressee) values (auth.uid(), v_other);
  return 'sent';
end;
$$;

create or replace function public.friend_respond(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where id = p_id and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where id = p_id and addressee = auth.uid() and status = 'pending';
  end if;
end;
$$;

create or replace function public.friend_remove(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships where id = p_id and (requester = auth.uid() or addressee = auth.uid());
$$;

-- The learner and their friends: only name, streak, this week's answers and learned words.
create or replace function public.friend_board(p_tz text)
returns table (
  friendship_id uuid, user_id uuid, display_name text, is_me boolean, status text, incoming boolean,
  streak integer, week_reviews integer, learned integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select null::uuid as fid, auth.uid() as uid, 'accepted'::text as status, false as incoming
    union all
    select f.id, case when f.requester = auth.uid() then f.addressee else f.requester end, f.status,
           f.addressee = auth.uid() and f.status = 'pending'
    from public.friendships f
    where f.requester = auth.uid() or f.addressee = auth.uid()
  )
  select
    p.fid, p.uid, pr.display_name, p.uid = auth.uid(), p.status, p.incoming,
    case when p.status = 'accepted' then public.user_streak(p.uid, p_tz) else 0 end,
    case when p.status = 'accepted' then (
      select count(*)::integer from public.review_events e
      where e.user_id = p.uid and e.undone_at is null and e.reviewed_at >= date_trunc('week', now())
    ) else 0 end,
    case when p.status = 'accepted' then (
      select count(*)::integer from public.cards c join public.words w on w.id = c.word_id
      where c.user_id = p.uid and c.card_type = 'recognition' and c.state = 'review' and w.deleted_at is null
    ) else 0 end
  from people p
  left join public.profiles pr on pr.id = p.uid;
$$;

-- ---------------------------------------------------------------------------
-- short stories made from the learner's own words
-- ---------------------------------------------------------------------------

create table public.stories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  level      text,
  title_de   text not null check (char_length(title_de) <= 200),
  title_fa   text not null check (char_length(title_fa) <= 200),
  sentences  jsonb not null check (jsonb_typeof(sentences) = 'array'),
  words      text[] not null default '{}',
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index stories_user_time on public.stories (user_id, created_at);

-- ---------------------------------------------------------------------------
-- quiz: listening and speaking
-- ---------------------------------------------------------------------------

alter table public.quiz_sessions drop constraint if exists quiz_sessions_kind_check;
alter table public.quiz_sessions add constraint quiz_sessions_kind_check
  check (kind in ('mixed', 'choice', 'typing', 'article', 'listening', 'speaking'));
alter table public.quiz_answers drop constraint if exists quiz_answers_question_type_check;
alter table public.quiz_answers add constraint quiz_answers_question_type_check
  check (question_type in ('choice_de_fa', 'choice_fa_de', 'typing_fa_de', 'article', 'dictation', 'speaking'));

-- ---------------------------------------------------------------------------
-- admin panel
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_7d', (select count(*) from auth.users u where u.created_at > now() - interval '7 days'),
    'active_today', (select count(distinct e.user_id) from public.review_events e where e.reviewed_at > now() - interval '1 day'),
    'active_7d', (select count(distinct e.user_id) from public.review_events e where e.reviewed_at > now() - interval '7 days'),
    'words', (select count(*) from public.words w where w.deleted_at is null),
    'reviews_today', (select count(*) from public.review_events e where e.reviewed_at > now() - interval '1 day'),
    'reviews_7d', (select count(*) from public.review_events e where e.reviewed_at > now() - interval '7 days'),
    'ai_calls_today', (select count(*) from public.ai_generation_logs l where l.created_at > date_trunc('day', now()) and l.status in ('ok', 'rejected')),
    'cost_today', (select coalesce(sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)), 0) from public.ai_generation_logs l where l.created_at > date_trunc('day', now())),
    'cost_7d', (select coalesce(sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)), 0) from public.ai_generation_logs l where l.created_at > now() - interval '7 days'),
    'cost_30d', (select coalesce(sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)), 0) from public.ai_generation_logs l where l.created_at > now() - interval '30 days'),
    'feedback_new', (select count(*) from public.feedback f where f.status = 'new'),
    'reports_new', (select count(*) from public.card_reports r where r.status = 'new'),
    'errors_24h', (select count(*) from public.client_errors e where e.created_at > now() - interval '1 day'),
    'push_subscribers', (select count(distinct ps.user_id) from public.push_subscriptions ps)
  ) into v;
  return v;
end;
$$;

-- Money: what was bought, what the logs say was spent since the first entry, and the rest.
create or replace function public.admin_ai_budget()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_anchor timestamptz;
  v_base numeric;
  v_topups numeric;
  v_spent numeric;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  -- the latest "balance" entry (the real number from the provider) resets the count
  select e.created_at, e.amount_usd into v_anchor, v_base
  from public.ai_credit_entries e where e.kind = 'balance' order by e.created_at desc limit 1;
  if v_anchor is null then
    select min(e.created_at), 0 into v_anchor, v_base from public.ai_credit_entries e;
  end if;
  select coalesce(sum(e.amount_usd), 0) into v_topups
  from public.ai_credit_entries e where e.kind = 'topup' and (v_anchor is null or e.created_at >= v_anchor);
  select coalesce(sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)), 0) into v_spent
  from public.ai_generation_logs l where v_anchor is not null and l.created_at >= v_anchor;
  return jsonb_build_object(
    'since', v_anchor,
    'credit', coalesce(v_base, 0) + v_topups,
    'spent', v_spent,
    'remaining', coalesce(v_base, 0) + v_topups - v_spent,
    'avg_card_cost', (
      select coalesce(avg(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)), 0)
      from public.ai_generation_logs l where l.kind = 'analyze_word' and l.status = 'ok' and l.created_at > now() - interval '30 days'
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'cost', d.cost, 'calls', d.calls) order by d.day), '[]'::jsonb)
      from (
        select date_trunc('day', l.created_at)::date as day,
               sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)) as cost,
               count(*) filter (where l.status in ('ok', 'rejected')) as calls
        from public.ai_generation_logs l
        where l.created_at > now() - interval '30 days'
        group by 1
      ) d
    )
  );
end;
$$;

create or replace function public.admin_users(p_search text, p_limit integer, p_offset integer)
returns table (
  user_id uuid, email text, display_name text, created_at timestamptz, last_sign_in_at timestamptz,
  last_active_at timestamptz, words integer, reviews_30d integer, ai_calls_30d integer, cost_30d numeric,
  packs integer, ai_per_day integer, blocked boolean, is_admin boolean, banned boolean, total bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  with base as (
    select u.id, u.email::text as email, u.created_at, u.last_sign_in_at,
           (u.banned_until is not null and u.banned_until > now()) as banned,
           p.display_name
    from auth.users u
    left join public.profiles p on p.id = u.id
    where p_search is null or p_search = ''
       or u.email ilike '%' || p_search || '%' or p.display_name ilike '%' || p_search || '%'
  )
  select
    b.id, b.email, b.display_name, b.created_at, b.last_sign_in_at,
    (select max(e.reviewed_at) from public.review_events e where e.user_id = b.id),
    (select count(*)::integer from public.words w where w.user_id = b.id and w.deleted_at is null),
    (select count(*)::integer from public.review_events e where e.user_id = b.id and e.reviewed_at > now() - interval '30 days'),
    (select count(*)::integer from public.ai_generation_logs l where l.user_id = b.id and l.created_at > now() - interval '30 days' and l.status in ('ok', 'rejected')),
    (select coalesce(sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)), 0) from public.ai_generation_logs l where l.user_id = b.id and l.created_at > now() - interval '30 days'),
    (select count(*)::integer from public.user_packs up where up.user_id = b.id),
    (select ul.ai_per_day from public.user_limits ul where ul.user_id = b.id),
    coalesce((select ul.blocked from public.user_limits ul where ul.user_id = b.id), false),
    exists (select 1 from public.admins a where a.user_id = b.id),
    b.banned,
    count(*) over ()
  from base b
  order by b.created_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.admin_set_limit(p_user uuid, p_ai_per_day integer, p_blocked boolean, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.user_limits (user_id, ai_per_day, blocked, note)
  values (p_user, p_ai_per_day, coalesce(p_blocked, false), p_note)
  on conflict (user_id) do update set ai_per_day = excluded.ai_per_day, blocked = excluded.blocked, note = excluded.note;
end;
$$;

-- Corrects the shared AI analysis of a word (after a report), so later learners get the fix.
create or replace function public.admin_fix_cache(p_input_key text, p_content jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.ai_word_cache
  set result = jsonb_set(result, '{content}', p_content), updated_at = now()
  where input_key = lower(p_input_key) and result ->> 'status' = 'ok';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.admins             enable row level security;
alter table public.user_limits        enable row level security;
alter table public.ai_credit_entries  enable row level security;
alter table public.feedback           enable row level security;
alter table public.client_errors      enable row level security;
alter table public.card_reports       enable row level security;
alter table public.announcements      enable row level security;
alter table public.packs              enable row level security;
alter table public.pack_items         enable row level security;
alter table public.user_packs         enable row level security;
alter table public.tts_cache          enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_secrets       enable row level security;
alter table public.notification_log   enable row level security;
alter table public.friendships        enable row level security;
alter table public.stories            enable row level security;

create policy admins_self on public.admins for select to authenticated using (user_id = (select auth.uid()));

create policy user_limits_self on public.user_limits for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy credit_admin on public.ai_credit_entries for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy app_config_admin_update on public.app_config for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy feedback_insert on public.feedback for insert to authenticated with check (user_id = (select auth.uid()));
create policy feedback_select on public.feedback for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy feedback_admin_update on public.feedback for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy client_errors_admin on public.client_errors for select to authenticated using ((select public.is_admin()));

create policy card_reports_insert on public.card_reports for insert to authenticated with check (user_id = (select auth.uid()));
create policy card_reports_select on public.card_reports for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy card_reports_admin_update on public.card_reports for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy announcements_read on public.announcements for select to authenticated
  using (published or (select public.is_admin()));
create policy announcements_admin on public.announcements for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy packs_read on public.packs for select to authenticated using (published or (select public.is_admin()));
create policy packs_admin on public.packs for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy pack_items_read on public.pack_items for select to authenticated
  using (
    (status = 'ready' and exists (select 1 from public.packs p where p.id = pack_id and p.published))
    or (select public.is_admin())
  );
create policy pack_items_admin on public.pack_items for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy user_packs_select on public.user_packs for select to authenticated using (user_id = (select auth.uid()));
create policy user_packs_insert on public.user_packs for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_packs_delete on public.user_packs for delete to authenticated using (user_id = (select auth.uid()));

create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy friendships_own on public.friendships for select to authenticated
  using (requester = (select auth.uid()) or addressee = (select auth.uid()));

create policy stories_own_select on public.stories for select to authenticated using (user_id = (select auth.uid()));
create policy stories_own_update on public.stories for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- tts_cache, push_secrets, notification_log: no policy — server functions only

-- ---------------------------------------------------------------------------
-- privileges
-- ---------------------------------------------------------------------------

revoke all on public.admins, public.user_limits, public.ai_credit_entries, public.feedback, public.client_errors,
  public.card_reports, public.announcements, public.packs, public.pack_items, public.user_packs, public.tts_cache,
  public.push_subscriptions, public.push_secrets, public.notification_log, public.friendships, public.stories
  from anon, authenticated;

grant select on public.admins, public.user_limits, public.client_errors, public.friendships to authenticated;
grant select, insert, update, delete on public.ai_credit_entries, public.announcements, public.packs, public.pack_items to authenticated;
grant select, insert, update on public.feedback, public.card_reports to authenticated;
grant select, insert, delete on public.user_packs to authenticated;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, update on public.stories to authenticated;
grant update on public.app_config to authenticated;

grant all on public.admins, public.user_limits, public.ai_credit_entries, public.feedback, public.client_errors,
  public.card_reports, public.announcements, public.packs, public.pack_items, public.user_packs, public.tts_cache,
  public.push_subscriptions, public.push_secrets, public.notification_log, public.friendships, public.stories
  to service_role;

revoke all on function public.is_admin() from anon, public;
revoke all on function public.make_admin(text) from anon, authenticated, public;
revoke all on function public.ai_cost(text, text, integer, integer) from anon, authenticated, public;
revoke all on function public.ai_budget_status(uuid, text) from anon, authenticated, public;
revoke all on function public.log_client_error(text, text, text, text, text) from anon, public;
revoke all on function public.start_pack_lesson(uuid, integer) from anon, public;
revoke all on function public.import_words(jsonb) from anon, public;
revoke all on function public.push_candidates(timestamptz) from anon, authenticated, public;
revoke all on function public.user_streak(uuid, text) from anon, authenticated, public;
revoke all on function public.new_friend_code() from anon, authenticated, public;
revoke all on function public.friend_request(text) from anon, public;
revoke all on function public.friend_respond(uuid, boolean) from anon, public;
revoke all on function public.friend_remove(uuid) from anon, public;
revoke all on function public.friend_board(text) from anon, public;
revoke all on function public.admin_overview() from anon, public;
revoke all on function public.admin_ai_budget() from anon, public;
revoke all on function public.admin_users(text, integer, integer) from anon, public;
revoke all on function public.admin_set_limit(uuid, integer, boolean, text) from anon, public;
revoke all on function public.admin_fix_cache(text, jsonb) from anon, public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.log_client_error(text, text, text, text, text) to authenticated;
grant execute on function public.start_pack_lesson(uuid, integer) to authenticated;
grant execute on function public.import_words(jsonb) to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;
grant execute on function public.friend_board(text) to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_ai_budget() to authenticated;
grant execute on function public.admin_users(text, integer, integer) to authenticated;
grant execute on function public.admin_set_limit(uuid, integer, boolean, text) to authenticated;
grant execute on function public.admin_fix_cache(text, jsonb) to authenticated;
grant execute on all functions in schema public to service_role;

update public.app_config set value = '3'::jsonb, updated_at = now() where key = 'schema_version';
update public.app_config
  set value = value || '{"store": true, "admin": true, "serverAudio": true, "push": true, "friends": true, "stories": true}'::jsonb,
      updated_at = now()
  where key = 'features';
