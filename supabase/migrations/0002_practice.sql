-- Hodhod — stage 2: undo of the last answer, reverse (production) cards, word groups, quiz.
--
-- Safe to run on a database that already has data. The previous app version keeps
-- working after this migration (everything added here is additive).

-- ---------------------------------------------------------------------------
-- word groups: free-form labels on a word ("Lektion 3", "سفر")
-- ---------------------------------------------------------------------------

alter table public.words
  add column tags text[] not null default '{}'
  check (cardinality(tags) <= 20 and char_length(array_to_string(tags, '')) <= 800);

create index words_tags on public.words using gin (tags);

-- ---------------------------------------------------------------------------
-- reverse cards (Persian → German), opt-in per learner
-- ---------------------------------------------------------------------------

alter table public.user_settings
  add column reverse_cards boolean not null default false;

-- A saved word always gets its recognition card; the production card only when the
-- learner has switched reverse cards on.
create or replace function public.create_default_card()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.cards (user_id, word_id, card_type)
  values (new.user_id, new.id, 'recognition')
  on conflict (word_id, card_type) do nothing;

  if exists (select 1 from public.user_settings s where s.user_id = new.user_id and s.reverse_cards) then
    insert into public.cards (user_id, word_id, card_type)
    values (new.user_id, new.id, 'production')
    on conflict (word_id, card_type) do nothing;
  end if;
  return new;
end;
$$;

-- Creates the missing production cards for every word already in the bank.
-- Called once when the learner switches reverse cards on; harmless to call again.
create or replace function public.ensure_reverse_cards()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.cards (user_id, word_id, card_type)
  select w.user_id, w.id, 'production'
  from public.words w
  where w.user_id = auth.uid() and w.deleted_at is null
  on conflict (word_id, card_type) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- undo of the most recent answer on a card
-- ---------------------------------------------------------------------------

-- History stays append-only: an undone review is marked, not deleted.
alter table public.review_events
  add column undone_at timestamptz;

-- Takes back one review: marks the event as undone and puts the card back to the state
-- it had before (sent by the device that made the review). Only the latest review of a
-- card can be undone, and only by its owner.
-- SECURITY DEFINER because learners have no UPDATE right on review_events; every
-- statement below is restricted to auth.uid().
create or replace function public.undo_review(p_event_id uuid, p_card jsonb)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.review_events;
  v_card  public.cards;
begin
  select * into v_event
  from public.review_events
  where id = p_event_id and user_id = auth.uid();
  if not found then
    raise exception 'review not found' using errcode = 'P0002';
  end if;

  select * into v_card
  from public.cards
  where id = v_event.card_id and user_id = auth.uid()
  for update;
  if not found then
    raise exception 'card not found' using errcode = 'P0002';
  end if;

  -- already undone (a retried request): nothing more to do
  if v_event.undone_at is not null then
    return v_card;
  end if;

  if v_card.last_review is distinct from v_event.reviewed_at then
    raise exception 'only the latest review of a card can be undone' using errcode = 'P0001';
  end if;

  update public.review_events set undone_at = now() where id = v_event.id;

  update public.cards set
    state          = p_card ->> 'state',
    due            = (p_card ->> 'due')::timestamptz,
    stability      = (p_card ->> 'stability')::double precision,
    difficulty     = (p_card ->> 'difficulty')::double precision,
    scheduled_days = (p_card ->> 'scheduled_days')::integer,
    learning_steps = (p_card ->> 'learning_steps')::integer,
    reps           = (p_card ->> 'reps')::integer,
    lapses         = (p_card ->> 'lapses')::integer,
    last_review    = (p_card ->> 'last_review')::timestamptz,
    introduced_at  = (p_card ->> 'introduced_at')::timestamptz
  where id = v_card.id
  returning * into v_card;

  return v_card;
end;
$$;

-- Per-day totals, now without undone reviews and with the numbers needed for retention
-- (answers on cards that were already in review, and how many of those were forgotten).
drop function public.activity_by_day(text, date);

create function public.activity_by_day(p_time_zone text, p_since date)
returns table (
  day date, reviews integer, again integer, new_cards integer, duration_ms bigint,
  mature_reviews integer, mature_again integer
)
language sql
stable
set search_path = ''
as $$
  select
    ((e.reviewed_at at time zone p_time_zone) - interval '4 hours')::date as day,
    count(*)::integer,
    count(*) filter (where e.rating = 1)::integer,
    count(*) filter (where e.state_before = 'new')::integer,
    coalesce(sum(e.duration_ms), 0)::bigint,
    count(*) filter (where e.state_before = 'review')::integer,
    count(*) filter (where e.state_before = 'review' and e.rating = 1)::integer
  from public.review_events e
  where e.user_id = auth.uid()
    and e.undone_at is null
    and e.reviewed_at >= (p_since::timestamp at time zone p_time_zone)
  group by 1
  order by 1;
$$;

-- ---------------------------------------------------------------------------
-- quiz (kept apart from review history: a quiz answer never moves a card)
-- ---------------------------------------------------------------------------

create table public.quiz_sessions (
  id          uuid primary key, -- generated on the device, so uploads can be retried
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('mixed', 'choice', 'typing', 'article')),
  started_at  timestamptz not null,
  finished_at timestamptz not null,
  total       integer not null check (total between 1 and 200),
  correct     integer not null check (correct >= 0 and correct <= total),
  created_at  timestamptz not null default now()
);

create table public.quiz_answers (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id    uuid not null references public.quiz_sessions (id) on delete cascade,
  word_id       uuid not null references public.words (id) on delete cascade,
  question_type text not null check (question_type in ('choice_de_fa', 'choice_fa_de', 'typing_fa_de', 'article')),
  prompt        text not null check (char_length(prompt) <= 300),
  expected      text not null check (char_length(expected) <= 300),
  answer        text not null check (char_length(answer) <= 300),
  is_correct    boolean not null,
  duration_ms   integer check (duration_ms is null or duration_ms >= 0),
  answered_at   timestamptz not null,
  created_at    timestamptz not null default now()
);

create index quiz_sessions_user_time on public.quiz_sessions (user_id, finished_at);
create index quiz_answers_user_time on public.quiz_answers (user_id, answered_at);
create index quiz_answers_word on public.quiz_answers (word_id);

-- Stores a finished quiz in one transaction. Repeating the call stores nothing twice.
create or replace function public.save_quiz(p_session jsonb, p_answers jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.quiz_sessions (id, user_id, kind, started_at, finished_at, total, correct)
  values (
    (p_session ->> 'id')::uuid, auth.uid(), p_session ->> 'kind',
    (p_session ->> 'started_at')::timestamptz, (p_session ->> 'finished_at')::timestamptz,
    (p_session ->> 'total')::integer, (p_session ->> 'correct')::integer
  )
  on conflict (id) do nothing;

  insert into public.quiz_answers (
    id, user_id, session_id, word_id, question_type, prompt, expected, answer, is_correct, duration_ms, answered_at
  )
  select
    a.id, auth.uid(), (p_session ->> 'id')::uuid, a.word_id, a.question_type,
    left(a.prompt, 300), left(a.expected, 300), left(a.answer, 300), a.is_correct, a.duration_ms, a.answered_at
  from jsonb_to_recordset(p_answers) as a (
    id uuid, word_id uuid, question_type text, prompt text, expected text, answer text,
    is_correct boolean, duration_ms integer, answered_at timestamptz
  )
  -- answers about words that have since been removed are skipped rather than failing the upload
  where exists (select 1 from public.words w where w.id = a.word_id and w.user_id = auth.uid())
  on conflict (id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- How each word has done in quizzes recently; used to bring weak words back more often.
create or replace function public.quiz_word_stats(p_since timestamptz)
returns table (word_id uuid, attempts integer, wrong integer, last_answered timestamptz)
language sql
stable
set search_path = ''
as $$
  select a.word_id, count(*)::integer, count(*) filter (where not a.is_correct)::integer, max(a.answered_at)
  from public.quiz_answers a
  where a.user_id = auth.uid() and a.answered_at >= p_since
  group by a.word_id;
$$;

alter table public.quiz_sessions enable row level security;
alter table public.quiz_answers  enable row level security;

create policy quiz_sessions_select on public.quiz_sessions for select to authenticated
  using (user_id = (select auth.uid()));
create policy quiz_sessions_insert on public.quiz_sessions for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy quiz_answers_select on public.quiz_answers for select to authenticated
  using (user_id = (select auth.uid()));
create policy quiz_answers_insert on public.quiz_answers for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.quiz_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
-- no update/delete policy: quiz history is append-only

-- ---------------------------------------------------------------------------
-- privileges
-- ---------------------------------------------------------------------------

revoke all on public.quiz_sessions, public.quiz_answers from anon, authenticated;
grant select, insert on public.quiz_sessions, public.quiz_answers to authenticated;
grant all on public.quiz_sessions, public.quiz_answers to service_role;

revoke all on function public.ensure_reverse_cards() from anon, authenticated, public;
revoke all on function public.undo_review(uuid, jsonb) from anon, authenticated, public;
revoke all on function public.activity_by_day(text, date) from anon, authenticated, public;
revoke all on function public.save_quiz(jsonb, jsonb) from anon, authenticated, public;
revoke all on function public.quiz_word_stats(timestamptz) from anon, authenticated, public;

grant execute on function public.ensure_reverse_cards() to authenticated;
grant execute on function public.undo_review(uuid, jsonb) to authenticated;
grant execute on function public.activity_by_day(text, date) to authenticated;
grant execute on function public.save_quiz(jsonb, jsonb) to authenticated;
grant execute on function public.quiz_word_stats(timestamptz) to authenticated;

update public.app_config set value = '2'::jsonb, updated_at = now() where key = 'schema_version';
update public.app_config
  set value = value || '{"quiz": true}'::jsonb, updated_at = now()
  where key = 'features';
