-- Behavioural tests for migration 0006 (reminders that arrive every day).
\set ON_ERROR_STOP on

reset role;
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000a6', 'nightowl@example.test', now() - interval '20 days');
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-0000000000a6', 'https://push.example.test/owl', 'k', 'a');

do $$
declare
  midnight timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  n integer;
begin
  update public.user_settings set notify_daily = true, notify_streak = false, notify_time = '23:30', time_zone = 'UTC', new_per_day = 5
  where user_id = '00000000-0000-0000-0000-0000000000a6';

  -- nothing waiting at all: no reminder
  select count(*) into n from public.push_candidates(midnight + interval '23 hours 35 minutes') where user_id = '00000000-0000-0000-0000-0000000000a6';
  assert n = 0, 'no reminder without cards';

  -- only new words waiting (nothing due for review): still a reminder, counting up to the daily number
  insert into public.words (id, user_id, lemma, normalized_lemma, pos, primary_meaning, content, target_language, native_language)
  select gen_random_uuid(), '00000000-0000-0000-0000-0000000000a6', 'Wort' || i, 'wort' || i, 'noun', 'واژه', '{}', 'de', 'fa'
  from generate_series(1, 8) i;
  select due_count into n from public.push_candidates(midnight + interval '23 hours 35 minutes') where user_id = '00000000-0000-0000-0000-0000000000a6' and kind = 'daily';
  assert n = 5, format('new words count, up to the daily number (got %s)', n);

  -- a window that crosses midnight still works
  select count(*) into n from public.push_candidates(midnight + interval '1 day 1 hour') where user_id = '00000000-0000-0000-0000-0000000000a6' and kind = 'daily';
  assert n = 1, 'reminder at 23:30 can still go out after midnight';
end $$;

-- the admin can see a learner's reminder set-up
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
declare v jsonb;
begin
  v := public.admin_reminders('00000000-0000-0000-0000-0000000000a6');
  assert jsonb_array_length(v -> 'devices') = 1, 'one device';
  assert (v -> 'settings' ->> 'time') = '23:30', 'the chosen time';
end $$;
reset role;
select 'reminders: ok';
