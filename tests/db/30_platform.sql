-- Behavioural tests for migration 0003 (admin, store, imports, friends, budget, push).
\set ON_ERROR_STOP on

reset role;
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000d1', 'admin@example.test', now() - interval '30 days'),
  ('00000000-0000-0000-0000-0000000000d2', 'learner@example.test', now() - interval '1 hour'),
  ('00000000-0000-0000-0000-0000000000d3', 'friend@example.test', now() - interval '10 days');

-- ---- every account (new or existing) sees the welcome tour once ---------------
do $$
begin
  assert (select onboarded_at from public.user_settings where user_id = '00000000-0000-0000-0000-0000000000d2') is null,
    'a new account has not been welcomed yet';
  assert (select count(*) from public.profiles where friend_code is null) = 0, 'every profile has a friend code';
end $$;

-- ---- administrators -----------------------------------------------------------
do $$
begin
  assert public.make_admin('nobody@example.test') = 'no account with this e-mail address', 'unknown e-mail';
  assert public.make_admin('ADMIN@example.test') = 'ok', 'make_admin ignores case';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $$
begin
  assert not public.is_admin(), 'a learner is not an admin';
  begin
    perform public.admin_overview();
    assert false, 'learners cannot read the admin overview';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.admin_users(null, 10, 0);
    assert false, 'learners cannot list users';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.packs (slug, title) values ('sneaky', 'x');
    assert false, 'learners cannot create packs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.make_admin('learner@example.test');
    assert false, 'learners cannot make themselves admin';
  exception when insufficient_privilege then null;
  end;
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
declare v jsonb;
begin
  assert public.is_admin(), 'the admin is an admin';
  v := public.admin_overview();
  assert (v ->> 'users')::integer >= 3, 'overview counts users';
  assert (select count(*) from public.admin_users('learner', 10, 0)) = 1, 'users can be searched by e-mail';
  perform public.admin_set_limit('00000000-0000-0000-0000-0000000000d3', 5, false, 'test');
  assert (select ai_per_day from public.user_limits where user_id = '00000000-0000-0000-0000-0000000000d3') = 5, 'limits are stored';

  insert into public.packs (id, slug, title, published, lesson_size)
  values ('50000000-0000-0000-0000-000000000001', 'fruits-basic', 'میوه‌ها', false, 5);
  insert into public.pack_items (pack_id, position, lesson, input, status, lemma, normalized_lemma, pos, primary_meaning, content) values
    ('50000000-0000-0000-0000-000000000001', 0, 1, 'der Apfel', 'ready', 'Apfel', 'Apfel', 'noun', 'سیب', '{"version": 2, "lemma": "Apfel"}'),
    ('50000000-0000-0000-0000-000000000001', 1, 1, 'die Banane', 'ready', 'Banane', 'Banane', 'noun', 'موز', '{"version": 2, "lemma": "Banane"}'),
    ('50000000-0000-0000-0000-000000000001', 2, 2, 'die Kirsche', 'ready', 'Kirsche', 'Kirsche', 'noun', 'گیلاس', '{"version": 2}'),
    ('50000000-0000-0000-0000-000000000001', 3, 2, 'reif', 'draft', null, null, null, null, null);
  insert into public.ai_credit_entries (amount_usd, kind, note) values (5, 'topup', 'first');
end $$;

reset role;
insert into public.ai_generation_logs (user_id, kind, status, model, input_tokens, output_tokens)
values ('00000000-0000-0000-0000-0000000000d2', 'analyze_word', 'ok', 'm', 1000000, 100000);
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';

do $$
declare v jsonb;
begin
  v := public.admin_ai_budget();
  assert (v ->> 'credit')::numeric = 5, 'credit bought';
  assert abs((v ->> 'spent')::numeric - 2.25) < 0.001, 'spent = 1M input × 1.25 + 0.1M output × 10';
  assert abs((v ->> 'remaining')::numeric - 2.75) < 0.001, 'remaining credit';
  insert into public.ai_credit_entries (amount_usd, kind, note) values (4.10, 'balance', 'from the provider');
  v := public.admin_ai_budget();
  assert (v ->> 'credit')::numeric = 4.10 and (v ->> 'spent')::numeric = 0, 'a balance entry restarts the count';
end $$;

-- ---- the store, seen by a learner ---------------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $$
declare n integer;
begin
  assert (select count(*) from public.packs) = 0, 'unpublished packs are invisible';
  assert (select count(*) from public.pack_items) = 0, 'and so are their items';
  begin
    perform public.start_pack_lesson('50000000-0000-0000-0000-000000000001', 1);
    assert false, 'an unpublished pack cannot be started';
  exception when no_data_found then null;
  end;
end $$;

reset role;
update public.packs set published = true where slug = 'fruits-basic';
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';

insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content)
values ('Banane', 'Banane', 'noun', 'موز', '{}');

do $$
declare n integer;
begin
  assert (select count(*) from public.pack_items) = 3, 'only ready items are visible';
  assert (select items from public.store_packs() where slug = 'fruits-basic') = 3, 'the store counts ready items';
  assert (select lessons from public.store_packs() where slug = 'fruits-basic') = 2, 'and lessons';
  assert not (select owned from public.store_packs() where slug = 'fruits-basic'), 'not owned yet';
  n := public.start_pack_lesson('50000000-0000-0000-0000-000000000001', 1);
  assert n = 1, 'the word already in the bank is skipped';
  assert (select count(*) from public.user_packs) = 1, 'the pack is now the learner''s';
  assert (select owned from public.store_packs() where slug = 'fruits-basic'), 'owned after starting a lesson';
  assert (select source from public.words where lemma = 'Apfel') = 'pack', 'source is pack';
  assert (select pack_id from public.words where lemma = 'Apfel') = '50000000-0000-0000-0000-000000000001', 'word remembers its pack';
  assert (select tags from public.words where lemma = 'Apfel') = array['میوه‌ها'], 'word carries the pack as group';
  assert (select count(*) from public.cards c join public.words w on w.id = c.word_id where w.lemma = 'Apfel') = 1, 'a card was created';
  n := public.start_pack_lesson('50000000-0000-0000-0000-000000000001', 1);
  assert n = 0, 'starting a lesson twice adds nothing';
end $$;

-- ---- longer content, imports ---------------------------------------------------
do $$
declare n integer;
begin
  insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content)
  values ('Kannst du mir bitte kurz beim Tragen der Kisten in den dritten Stock helfen?', 'Kannst du mir bitte kurz beim Tragen der Kisten in den dritten Stock helfen?', 'sentence', 'می‌توانی کمکم کنی؟', '{}');
  n := public.import_words('[
    {"lemma": "Stuhl", "normalized_lemma": "Stuhl", "pos": "noun", "primary_meaning": "صندلی", "content": {}, "tags": ["Anki"]},
    {"lemma": "Apfel", "normalized_lemma": "Apfel", "pos": "noun", "primary_meaning": "سیب", "content": {}}
  ]');
  assert n = 1, 'imports skip words already in the bank';
  assert (select source from public.words where lemma = 'Stuhl') = 'import', 'imported words are marked';
  begin
    perform public.import_words((select jsonb_agg(jsonb_build_object('lemma', 'w' || g)) from generate_series(1, 501) g));
    assert false, 'imports are bounded';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ---- feedback and error reports --------------------------------------------------
do $$
declare ok boolean;
begin
  insert into public.feedback (kind, message) values ('bug', 'Das Quiz hängt');
  assert (select count(*) from public.feedback) = 1, 'own feedback is visible';
  for i in 1..30 loop
    ok := public.log_client_error('boom', null, '/x', '1', 'ua');
  end loop;
  ok := public.log_client_error('boom', null, '/x', '1', 'ua');
  assert not ok, 'error reports are rate-limited';
  assert (select count(*) from public.client_errors) = 0, 'learners cannot read error logs';
  insert into public.card_reports (lemma, reason, message) values ('Apfel', 'meaning', 'falsch');
end $$;

-- ---- friends --------------------------------------------------------------------
do $$
declare v_code text; r text;
begin
  select friend_code into v_code from public.profiles where id = '00000000-0000-0000-0000-0000000000d3';
  assert v_code is null, 'other people''s profiles (and codes) are not readable';
end $$;

reset role;
select friend_code as d3_code from public.profiles where id = '00000000-0000-0000-0000-0000000000d3' \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
select public.friend_request(:'d3_code') = 'sent' as sent \gset
\if :sent
\else
  \echo 'friend request should be sent'
  select 1/0;
\endif

do $$
begin
  assert public.friend_request('ZZZZZZZZ') = 'not_found', 'unknown code';
  assert (select count(*) from public.friend_board('UTC') where not is_me and status = 'pending') = 1, 'pending request is listed';
end $$;

set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d3';
do $$
declare v_id uuid;
begin
  select friendship_id into v_id from public.friend_board('UTC') where incoming;
  assert v_id is not null, 'the addressee sees the incoming request';
  perform public.friend_respond(v_id, true);
  assert (select count(*) from public.friend_board('UTC') where status = 'accepted' and not is_me) = 1, 'now friends';
end $$;

-- ---- streaks ----------------------------------------------------------------------
reset role;
do $$
declare v_card uuid;
begin
  insert into public.words (id, user_id, lemma, normalized_lemma, pos, primary_meaning, content)
  values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000d3', 'Haus', 'Haus', 'noun', 'خانه', '{}');
  select id into v_card from public.cards where word_id = '60000000-0000-0000-0000-000000000001';
  insert into public.review_events (id, user_id, card_id, word_id, rating, reviewed_at, state_before, state_after,
    stability_before, stability_after, difficulty_before, difficulty_after, elapsed_days, scheduled_days, due_before, due_after, scheduler_version)
  select gen_random_uuid(), '00000000-0000-0000-0000-0000000000d3', v_card, '60000000-0000-0000-0000-000000000001', 3,
    now() - (g || ' days')::interval, 'review', 'review', 1, 2, 5, 5, 1, 2, now(), now(), 't'
  from generate_series(1, 3) g;
  assert public.user_streak('00000000-0000-0000-0000-0000000000d3', 'UTC') = 3, 'three days in a row, not yet today';
  assert public.user_streak('00000000-0000-0000-0000-0000000000d2', 'UTC') = 0, 'no reviews, no streak';
end $$;

-- ---- AI budget ------------------------------------------------------------------------
do $$
declare r record;
begin
  select * into r from public.ai_budget_status('00000000-0000-0000-0000-0000000000d2', 'analyze_word');
  assert r.account_age_hours < 2, 'new account age';
  assert r.user_today = 1, 'calls of the last day are counted';
  assert r.daily_usd = 1.5, 'default daily budget';
  select * into r from public.ai_budget_status('00000000-0000-0000-0000-0000000000d3', 'tts');
  assert r.user_limit = 5 and r.kind_per_day = 300, 'per-user override and per-kind limit';
end $$;

-- ---- push candidates --------------------------------------------------------------------
do $$
declare n integer;
begin
  update public.user_settings set notify_daily = true, notify_time = '09:00', time_zone = 'UTC'
  where user_id = '00000000-0000-0000-0000-0000000000d3';
  update public.cards set state = 'review', due = now() - interval '1 day'
  where word_id = '60000000-0000-0000-0000-000000000001';
  assert (select count(*) from public.push_candidates((date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '9 hours 5 minutes')) = 0,
    'no subscription, no reminder';
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values ('00000000-0000-0000-0000-0000000000d3', 'https://push.example.test/1', 'k', 'a');
  select count(*) into n from public.push_candidates((date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '9 hours 5 minutes') where kind = 'daily';
  assert n = 1, 'reminder due inside the 15-minute window';
  select count(*) into n from public.push_candidates((date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '9 hours 20 minutes') where kind = 'daily';
  assert n = 0, 'not outside the window';
  select count(*) into n from public.push_candidates((date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') + interval '20 hours 35 minutes') where kind = 'streak';
  assert n = 1, 'streak reminder in the evening when today was not studied';
  insert into public.notification_log (user_id, kind) values ('00000000-0000-0000-0000-0000000000d3', 'daily');
  select count(*) into n from public.push_candidates(now()) where kind = 'daily';
  assert n = 0, 'at most one daily reminder';
  assert (select count(*) from public.push_secrets) = 0, 'no secrets until the push function creates them';
end $$;

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $$
begin
  begin
    perform * from public.push_candidates(now());
    assert false, 'learners cannot call push_candidates';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.push_secrets;
    assert false, 'learners cannot read push secrets';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
\echo ' platform tests passed'
