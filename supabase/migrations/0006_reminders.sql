-- Hodhod, stage 6: reminders that actually arrive, at the times each learner chooses.
-- Before, a daily reminder had one 15-minute chance: if that single run of the scheduler was late
-- or failed, the day was lost. It also only counted cards due for review, so a learner with
-- nothing due that day (common once intervals grow) got no reminder even with new words waiting.
-- Now:
--   * each learner picks their own reminder times (up to 8 a day), like an alarm clock;
--   * each one may go out any time in the 3 hours after its time (once a day each);
--   * by default a reminder comes at its time; "only if I have not studied yet" is a choice;
--   * new words waiting (up to the learner's daily number) count as cards waiting too;
--   * the streak warning may go out from 20:30 to 23:00 (once a day);
--   * times that cross midnight work (a reminder at 23:30 used to never fire).
-- Safe to run more than once.

alter table public.user_settings
  add column if not exists notify_times text[] not null default '{}',
  add column if not exists notify_only_pending boolean not null default false;

alter table public.user_settings drop constraint if exists user_settings_notify_times_check;
alter table public.user_settings add constraint user_settings_notify_times_check check (
  cardinality(notify_times) <= 8
  and array_to_string(notify_times, ',') ~ '^((([01][0-9]|2[0-3]):[0-5][0-9])(,|$))*$'
);

-- no copy of the old single time into the list: while the list is empty the single time is used,
-- so this file can run before the new app is published and the current app keeps working

drop function if exists public.push_candidates(timestamptz);
create function public.push_candidates(p_now timestamptz)
returns table (user_id uuid, kind text, due_count integer, streak integer, ref text)
language sql
stable
security definer
set search_path = ''
as $$
  with people as (
    select
      s.user_id,
      coalesce(s.time_zone, 'Europe/Berlin') as tz,
      s.notify_daily, s.notify_streak, s.notify_only_pending, s.new_per_day,
      case when cardinality(s.notify_times) > 0 then s.notify_times else array[s.notify_time] end as times
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
          and k.state <> 'new' and k.due <= p_now + interval '4 hours') as reviews_due,
      least(
        c.new_per_day,
        (select count(*)::integer from public.cards k join public.words w on w.id = k.word_id
          where k.user_id = c.user_id and w.deleted_at is null and k.card_type = 'recognition' and k.state = 'new')
      ) as new_waiting,
      exists (
        select 1 from public.review_events e
        where e.user_id = c.user_id and e.undone_at is null
          and ((e.reviewed_at at time zone c.tz) - interval '4 hours')::date = c.study_day
      ) as studied_today,
      public.user_streak(c.user_id, c.tz) as streak
    from clock c
  ),
  slots as (
    -- one row per chosen time; "since" is seconds after that time (0 … 86399), so it may cross midnight
    select e.*, t.at,
           mod((extract(epoch from e.local_now::time) - extract(epoch from t.at::time))::numeric + 86400, 86400) as since
    from enriched e, unnest(e.times) as t(at)
    where e.notify_daily
  )
  select s.user_id, 'daily', s.reviews_due + s.new_waiting, s.streak, s.at
  from slots s
  where s.since < 3 * 3600
    and (not s.notify_only_pending or (not s.studied_today and s.reviews_due + s.new_waiting > 0))
    and not exists (select 1 from public.notification_log n
      where n.user_id = s.user_id and n.kind = 'daily' and (n.ref = s.at or n.ref is null)
        and n.sent_at > p_now - interval '20 hours')
  union all
  select e.user_id, 'streak', e.reviews_due + e.new_waiting, e.streak, null
  from enriched e
  where e.notify_streak and not e.studied_today and e.streak > 0
    and not exists (select 1 from public.notification_log n
      where n.user_id = e.user_id and n.kind = 'streak' and n.sent_at > p_now - interval '20 hours')
    -- not right after one of today's reminders: give that one an hour first
    and not exists (select 1 from public.notification_log n
      where n.user_id = e.user_id and n.kind = 'daily' and n.sent_at > p_now - interval '1 hour')
    and e.local_now::time >= time '20:30' and e.local_now::time < time '23:00';
$$;

revoke all on function public.push_candidates(timestamptz) from anon, authenticated, public;
grant execute on function public.push_candidates(timestamptz) to service_role;

-- For the admin panel: is each learner's reminder set up, and did it arrive lately?
create or replace function public.admin_reminders(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'settings', (select jsonb_build_object('daily', s.notify_daily, 'time', s.notify_time, 'times', s.notify_times,
                   'only_pending', s.notify_only_pending, 'streak', s.notify_streak, 'time_zone', s.time_zone)
                 from public.user_settings s where s.user_id = p_user),
    'devices', (select coalesce(jsonb_agg(jsonb_build_object(
                  'agent', left(ps.user_agent, 120), 'created_at', ps.created_at, 'last_success_at', ps.last_success_at, 'failures', ps.failures
                ) order by ps.created_at desc), '[]'::jsonb) from public.push_subscriptions ps where ps.user_id = p_user),
    'sent', (select coalesce(jsonb_agg(jsonb_build_object('kind', n.kind, 'ref', n.ref, 'sent_at', n.sent_at) order by n.sent_at desc), '[]'::jsonb)
             from (select * from public.notification_log n where n.user_id = p_user order by n.sent_at desc limit 14) n)
  );
end;
$$;

revoke all on function public.admin_reminders(uuid) from anon, public;
grant execute on function public.admin_reminders(uuid) to authenticated;
