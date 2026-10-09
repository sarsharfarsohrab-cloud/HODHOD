-- Behavioural tests for the schema. Any failed assertion aborts with an error.
\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test', '{"display_name":"  سهراب  "}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test', '{}');

do $$
begin
  assert (select count(*) from public.profiles) = 2, 'profile rows are created with the auth user';
  assert (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'سهراب',
    'display name is trimmed';
  assert (select new_per_day from public.user_settings where user_id = '00000000-0000-0000-0000-00000000000b') = 10,
    'settings get product defaults';
end $$;

-- ---- user A --------------------------------------------------------------
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';

insert into public.words (id, lemma, normalized_lemma, pos, cefr, primary_meaning, content)
values ('10000000-0000-0000-0000-000000000001', 'aufgeben', 'aufgeben', 'verb', 'B1', 'تسلیم شدن', '{"lemma":"aufgeben"}');

do $$
declare
  v_card public.cards;
  v_event jsonb;
  v_next jsonb;
  v_result public.cards;
begin
  select * into v_card from public.cards where word_id = '10000000-0000-0000-0000-000000000001';
  assert found, 'saving a word creates its recognition card';
  assert v_card.state = 'new' and v_card.introduced_at is null, 'a saved word is not being learned yet';

  v_event := jsonb_build_object(
    'id', '20000000-0000-0000-0000-000000000001', 'card_id', v_card.id, 'rating', 3,
    'reviewed_at', '2026-10-09T10:00:00Z', 'duration_ms', 4200,
    'state_before', 'new', 'state_after', 'learning',
    'stability_before', 0, 'stability_after', 2.3, 'difficulty_before', 0, 'difficulty_after', 2.1,
    'elapsed_days', 0, 'scheduled_days', 0,
    'due_before', '2026-10-09T09:00:00Z', 'due_after', '2026-10-09T10:10:00Z',
    'scheduler_version', 'fsrs-6/ts-fsrs-5.4.2');
  v_next := jsonb_build_object('state', 'learning', 'due', '2026-10-09T10:10:00Z', 'stability', 2.3,
    'difficulty', 2.1, 'scheduled_days', 0, 'learning_steps', 1, 'reps', 1, 'lapses', 0);

  v_result := public.apply_review(v_event, v_next);
  assert v_result.state = 'learning' and v_result.reps = 1, 'review moves the card forward';
  assert v_result.introduced_at = '2026-10-09T10:00:00Z', 'first review marks the card as introduced';

  -- same event again (retry after a lost response): nothing may change
  v_next := v_next || jsonb_build_object('reps', 99);
  v_result := public.apply_review(v_event, v_next);
  assert v_result.reps = 1, 'a repeated event id is ignored';
  assert (select count(*) from public.review_events) = 1, 'a repeated event id is stored once';

  -- an older event arriving late (from another device) is recorded but must not rewind the card
  v_event := v_event || jsonb_build_object('id', '20000000-0000-0000-0000-000000000002', 'reviewed_at', '2026-10-09T09:30:00Z');
  v_result := public.apply_review(v_event, v_next);
  assert v_result.reps = 1 and v_result.last_review = '2026-10-09T10:00:00Z', 'a stale event does not overwrite newer state';
  assert (select count(*) from public.review_events) = 2, 'a stale event is still kept in the history';
end $$;

-- duplicates: same lemma + part of speech is refused, a different part of speech is a different word
do $$
begin
  begin
    insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content)
    values ('aufgeben', 'aufgeben', 'verb', 'x', '{}');
    assert false, 'duplicate word must be rejected';
  exception when unique_violation then null;
  end;
  insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content)
  values ('Essen', 'Essen', 'noun', 'غذا', '{}'), ('essen', 'essen', 'verb', 'خوردن', '{}');
end $$;

-- history is append-only and words cannot be hard-deleted through the API
do $$
declare n integer;
begin
  update public.review_events set rating = 1;
  get diagnostics n = row_count;
  assert n = 0, 'review history cannot be edited';
  delete from public.words;
  get diagnostics n = row_count;
  assert n = 0, 'words cannot be hard-deleted';
exception when insufficient_privilege then null; -- refused outright: equally good
end $$;

-- archived words free their slot for a fresh copy
update public.words set deleted_at = now() where id = '10000000-0000-0000-0000-000000000001';
insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content)
values ('aufgeben', 'aufgeben', 'verb', 'تسلیم شدن', '{}');

do $$
declare r record;
begin
  select * into r from public.activity_by_day('Europe/Berlin', '2026-10-01');
  assert r.day = '2026-10-09' and r.reviews = 2 and r.new_cards = 2 and r.duration_ms = 8400, 'activity is grouped per local day';
  -- 01:30 local time still counts for the previous study day (day starts at 04:00)
  perform public.apply_review(
    jsonb_build_object('id', '20000000-0000-0000-0000-000000000003',
      'card_id', (select id from public.cards where word_id = '10000000-0000-0000-0000-000000000001'),
      'rating', 1, 'reviewed_at', '2026-10-10T23:30:00Z', 'state_before', 'learning', 'state_after', 'learning',
      'scheduler_version', 't'),
    jsonb_build_object('state', 'learning', 'due', '2026-10-10T23:31:00Z', 'stability', 1, 'difficulty', 5,
      'scheduled_days', 0, 'learning_steps', 0, 'reps', 2, 'lapses', 0));
  assert (select count(*) from public.activity_by_day('Europe/Berlin', '2026-10-01') where day = '2026-10-10') = 1,
    '01:30 belongs to the previous study day';
end $$;

-- ---- user B must see nothing of A ----------------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
declare n integer;
begin
  assert (select count(*) from public.words) = 0, 'B cannot read A''s words';
  assert (select count(*) from public.cards) = 0, 'B cannot read A''s cards';
  assert (select count(*) from public.review_events) = 0, 'B cannot read A''s history';
  assert (select count(*) from public.profiles) = 1, 'B sees only their own profile';
  assert (select count(*) from public.activity_by_day('UTC', '2026-01-01')) = 0, 'B has no activity';

  update public.words set is_favorite = true;
  get diagnostics n = row_count;
  assert n = 0, 'B cannot change A''s words';

  begin
    insert into public.words (user_id, lemma, normalized_lemma, pos, primary_meaning, content)
    values ('00000000-0000-0000-0000-00000000000a', 'x', 'x', 'noun', 'x', '{}');
    assert false, 'B must not create rows for A';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.apply_review(
      jsonb_build_object('id', gen_random_uuid(), 'card_id', (select id from public.cards limit 1), 'rating', 3,
        'reviewed_at', now(), 'state_before', 'new', 'state_after', 'learning', 'scheduler_version', 't'),
      '{}'::jsonb);
    assert false, 'B must not review A''s cards';
  exception when no_data_found then null;
  end;

  begin
    perform 1 from public.ai_word_cache;
    assert false, 'the AI cache is server-only';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---- signed-out visitors get nothing at all --------------------------------
set role anon;
reset request.jwt.claim.sub;
do $$
begin
  begin
    perform 1 from public.words;
    assert false, 'anon must not reach words';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.activity_by_day('UTC', '2026-01-01');
    assert false, 'anon must not call functions';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ---- deleting the account removes everything it owned ------------------------
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$
begin
  assert (select count(*) from public.words) = 0, 'words go with the account';
  assert (select count(*) from public.cards) = 0, 'cards go with the account';
  assert (select count(*) from public.review_events) = 0, 'history goes with the account';
  assert (select count(*) from public.profiles) = 1, 'the other account is untouched';
end $$;

select 'database tests passed' as result;
