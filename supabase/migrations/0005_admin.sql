-- Hodhod, stage 5: a professional admin panel.
--   admin_costs(days): what each AI feature costs, per day and per user, and whether every model
--   the app used has a price (an unpriced model falls back to the default price and skews the totals).
--   admin_growth(days): sign-ups, active learners, how many come back, and the languages in use.
-- Safe to run more than once.

create or replace function public.admin_costs(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 365);
  v_since timestamptz := now() - make_interval(days => v_days);
  v_prices jsonb := coalesce((select c.value from public.app_config c where c.key = 'ai_prices'), '{}'::jsonb);
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  with logs as (
    select l.*, public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens) as cost
    from public.ai_generation_logs l
    where l.created_at > v_since
  )
  select jsonb_build_object(
    'days', v_days,
    'total', (select coalesce(sum(cost), 0) from logs),
    'by_kind', (
      select coalesce(jsonb_agg(k order by k ->> 'kind'), '[]'::jsonb) from (
        select jsonb_build_object(
          'kind', kind,
          'calls', count(*) filter (where status in ('ok', 'rejected')),
          'ok', count(*) filter (where status = 'ok'),
          'cache_hits', count(*) filter (where status = 'cache_hit'),
          'errors', count(*) filter (where status = 'error'),
          'cost', coalesce(sum(cost), 0),
          'avg_cost', coalesce(avg(cost) filter (where status = 'ok'), 0),
          'users', count(distinct user_id)
        ) as k
        from logs group by kind
      ) x
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'kind', kind, 'cost', cost) order by day, kind), '[]'::jsonb)
      from (select date_trunc('day', created_at)::date as day, kind, sum(cost) as cost from logs group by 1, 2) d
    ),
    'models', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'kind', kind, 'model', model, 'calls', calls,
        'priced', case when kind = 'tts' then v_prices ? 'tts' else model is not null and v_prices ? model end
      ) order by calls desc), '[]'::jsonb)
      from (select kind, model, count(*) as calls from logs where status <> 'cache_hit' group by 1, 2) m
    ),
    'top_users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'user_id', u.user_id, 'email', au.email, 'display_name', p.display_name, 'cost', u.cost, 'calls', u.calls
      ) order by u.cost desc), '[]'::jsonb)
      from (
        select user_id, sum(cost) as cost, count(*) filter (where status in ('ok', 'rejected')) as calls
        from logs where user_id is not null group by user_id order by sum(cost) desc limit 10
      ) u
      left join auth.users au on au.id = u.user_id
      left join public.profiles p on p.id = u.user_id
    ),
    'active_users', (
      select count(distinct x.user_id) from (
        select e.user_id from public.review_events e where e.reviewed_at > v_since
        union select l.user_id from logs l where l.user_id is not null
      ) x
    )
  ) into v;
  return v;
end;
$$;

create or replace function public.admin_growth(p_days integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 365);
  v_since date := (now() - make_interval(days => v_days))::date;
  v jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  with activity as (
    -- a learner counts as active on a day with a review, a quiz answer or a new word
    select e.user_id, e.reviewed_at::date as day from public.review_events e
    union select q.user_id, q.answered_at::date from public.quiz_answers q
    union select w.user_id, w.created_at::date from public.words w
  )
  select jsonb_build_object(
    'days', v_days,
    'users', (select count(*) from auth.users),
    'dau', (select count(distinct user_id) from activity where day = current_date),
    'wau', (select count(distinct user_id) from activity where day > current_date - 7),
    'mau', (select count(distinct user_id) from activity where day > current_date - 30),
    'plus', (select count(*) from public.user_limits ul where ul.plus_until > now()),
    'push', (select count(distinct ps.user_id) from public.push_subscriptions ps),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'signups', d.signups, 'active', d.active) order by d.day), '[]'::jsonb)
      from (
        select g.day::date as day,
               (select count(*) from auth.users u where u.created_at::date = g.day::date) as signups,
               (select count(distinct a.user_id) from activity a where a.day = g.day::date) as active
        from generate_series(v_since + 1, current_date, interval '1 day') g(day)
      ) d
    ),
    -- of the accounts old enough, how many were active again on day 1, within days 1–7 and 8–30
    'retention', jsonb_build_object(
      'd1', (
        select jsonb_build_object('base', count(*), 'back', count(*) filter (where exists (
          select 1 from activity a where a.user_id = u.id and a.day = u.created_at::date + 1)))
        from auth.users u where u.created_at::date <= current_date - 1
      ),
      'd7', (
        select jsonb_build_object('base', count(*), 'back', count(*) filter (where exists (
          select 1 from activity a where a.user_id = u.id and a.day between u.created_at::date + 1 and u.created_at::date + 7)))
        from auth.users u where u.created_at::date <= current_date - 7
      ),
      'd30', (
        select jsonb_build_object('base', count(*), 'back', count(*) filter (where exists (
          select 1 from activity a where a.user_id = u.id and a.day between u.created_at::date + 8 and u.created_at::date + 30)))
        from auth.users u where u.created_at::date <= current_date - 30
      )
    ),
    'native', (
      select coalesce(jsonb_object_agg(native_language, n), '{}'::jsonb)
      from (select p.native_language, count(*) as n from public.profiles p group by 1) x
    ),
    'learning', (
      select coalesce(jsonb_object_agg(target_language, n), '{}'::jsonb)
      from (select ul.target_language, count(distinct ul.user_id) as n from public.user_languages ul group by 1) x
    )
  ) into v;
  return v;
end;
$$;

-- Everything about one learner on one page.
create or replace function public.admin_user(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
  v_tz text;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select coalesce(s.time_zone, 'Europe/Berlin') into v_tz from public.user_settings s where s.user_id = p_user;
  select jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'display_name', p.display_name,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'banned', (u.banned_until is not null and u.banned_until > now()),
    'is_admin', exists (select 1 from public.admins a where a.user_id = u.id),
    'native_language', p.native_language,
    'active_language', p.active_target_language,
    'languages', (
      select coalesce(jsonb_agg(jsonb_build_object('language', x.target_language, 'words', x.words) order by x.words desc), '[]'::jsonb)
      from (
        select ul.target_language,
               (select count(*) from public.words w where w.user_id = u.id and w.target_language = ul.target_language and w.deleted_at is null) as words
        from public.user_languages ul where ul.user_id = u.id
      ) x
    ),
    'words', (select count(*) from public.words w where w.user_id = u.id and w.deleted_at is null),
    'cards', (
      select coalesce(jsonb_object_agg(state, n), '{}'::jsonb)
      from (select k.state, count(*) as n from public.cards k join public.words w on w.id = k.word_id
            where k.user_id = u.id and w.deleted_at is null and k.card_type = 'recognition' group by k.state) c
    ),
    'reviews_7d', (select count(*) from public.review_events e where e.user_id = u.id and e.reviewed_at > now() - interval '7 days'),
    'reviews_30d', (select count(*) from public.review_events e where e.user_id = u.id and e.reviewed_at > now() - interval '30 days'),
    'last_active_at', (select max(e.reviewed_at) from public.review_events e where e.user_id = u.id),
    'streak', public.user_streak(u.id, coalesce(v_tz, 'Europe/Berlin')),
    'costs_30d', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'calls', calls, 'cost', cost) order by cost desc), '[]'::jsonb)
      from (
        select l.kind, count(*) filter (where l.status in ('ok', 'rejected')) as calls,
               sum(public.ai_cost(l.kind, l.model, l.input_tokens, l.output_tokens)) as cost
        from public.ai_generation_logs l where l.user_id = u.id and l.created_at > now() - interval '30 days' group by l.kind
      ) k
    ),
    'ai_per_day', (select ul.ai_per_day from public.user_limits ul where ul.user_id = u.id),
    'blocked', coalesce((select ul.blocked from public.user_limits ul where ul.user_id = u.id), false),
    'plus_until', (select ul.plus_until from public.user_limits ul where ul.user_id = u.id),
    'packs', (select count(*) from public.user_packs up where up.user_id = u.id),
    'friends', (select count(*) from public.friendships f where f.status = 'accepted' and (f.requester = u.id or f.addressee = u.id)),
    'stories', (select count(*) from public.stories st where st.user_id = u.id)
  ) into v
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user;
  if v is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

revoke all on function public.admin_user(uuid) from anon, public;
grant execute on function public.admin_user(uuid) to authenticated;

revoke all on function public.admin_costs(integer) from anon, public;
grant execute on function public.admin_costs(integer) to authenticated;
revoke all on function public.admin_growth(integer) from anon, public;
grant execute on function public.admin_growth(integer) to authenticated;
