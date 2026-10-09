-- Behavioural tests for migration 0002. Runs after 10_rls_and_reviews.sql (user B still exists).
\set ON_ERROR_STOP on

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000c', 'c@example.test');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';

insert into public.words (id, lemma, normalized_lemma, pos, primary_meaning, content, tags)
values ('30000000-0000-0000-0000-000000000001', 'Tisch', 'Tisch', 'noun', 'میز', '{}', array['Lektion 1', 'خانه']);

-- ---- word groups ----------------------------------------------------------
do $$
begin
  assert (select tags from public.words where id = '30000000-0000-0000-0000-000000000001') = array['Lektion 1', 'خانه'], 'tags are stored';
  assert (select count(*) from public.words where tags @> array['خانه']) = 1, 'words can be found by tag';
  begin
    update public.words set tags = (select array_agg('t' || g) from generate_series(1, 21) g);
    assert false, 'more than 20 tags must be refused';
  exception when check_violation then null;
  end;
end $$;

-- ---- reverse cards --------------------------------------------------------
do $$
declare n integer;
begin
  assert (select count(*) from public.cards) = 1, 'by default a word has only its recognition card';
  n := public.ensure_reverse_cards();
  assert n = 1 and (select count(*) from public.cards where card_type = 'production') = 1, 'missing production cards are created';
  n := public.ensure_reverse_cards();
  assert n = 0, 'calling it again creates nothing';

  update public.user_settings set reverse_cards = true;
  insert into public.words (id, lemma, normalized_lemma, pos, primary_meaning, content)
  values ('30000000-0000-0000-0000-000000000002', 'Lampe', 'Lampe', 'noun', 'چراغ', '{}');
  assert (select count(*) from public.cards where word_id = '30000000-0000-0000-0000-000000000002') = 2,
    'with reverse cards on, a new word gets both cards';
end $$;

-- ---- undo -----------------------------------------------------------------
do $$
declare
  v_card   public.cards;
  v_before jsonb;
  v_result public.cards;
  v_event  jsonb;
begin
  select * into v_card from public.cards where word_id = '30000000-0000-0000-0000-000000000001' and card_type = 'recognition';
  v_before := jsonb_build_object('state', v_card.state, 'due', v_card.due, 'stability', v_card.stability, 'difficulty', v_card.difficulty,
    'scheduled_days', v_card.scheduled_days, 'learning_steps', v_card.learning_steps, 'reps', v_card.reps, 'lapses', v_card.lapses,
    'last_review', v_card.last_review, 'introduced_at', v_card.introduced_at);

  v_event := jsonb_build_object('id', '40000000-0000-0000-0000-000000000001', 'card_id', v_card.id, 'rating', 4,
    'reviewed_at', '2026-10-09T10:00:00Z', 'duration_ms', 3000, 'state_before', 'new', 'state_after', 'review', 'scheduler_version', 't');
  perform public.apply_review(v_event, jsonb_build_object('state', 'review', 'due', '2026-10-17T10:00:00Z', 'stability', 8.3, 'difficulty', 1,
    'scheduled_days', 8, 'learning_steps', 0, 'reps', 1, 'lapses', 0));
  assert (select reviews from public.activity_by_day('UTC', '2026-10-01')) = 1, 'the review counts';

  v_result := public.undo_review('40000000-0000-0000-0000-000000000001', v_before);
  assert v_result.state = 'new' and v_result.reps = 0 and v_result.last_review is null and v_result.introduced_at is null,
    'undo puts the card back exactly as it was';
  assert (select count(*) from public.review_events where undone_at is not null) = 1, 'the event is kept and marked, not deleted';
  assert (select count(*) from public.activity_by_day('UTC', '2026-10-01')) = 0, 'an undone review no longer counts';

  v_result := public.undo_review('40000000-0000-0000-0000-000000000001', jsonb_build_object('state', 'review', 'reps', 99));
  assert v_result.state = 'new' and v_result.reps = 0, 'a repeated undo changes nothing';

  -- two reviews: only the latest may be undone
  perform public.apply_review(v_event || jsonb_build_object('id', '40000000-0000-0000-0000-000000000002'),
    jsonb_build_object('state', 'learning', 'due', '2026-10-09T10:10:00Z', 'stability', 2, 'difficulty', 5, 'scheduled_days', 0, 'learning_steps', 1, 'reps', 1, 'lapses', 0));
  perform public.apply_review(v_event || jsonb_build_object('id', '40000000-0000-0000-0000-000000000003', 'reviewed_at', '2026-10-09T10:10:00Z', 'state_before', 'learning'),
    jsonb_build_object('state', 'review', 'due', '2026-10-11T10:10:00Z', 'stability', 2.5, 'difficulty', 5, 'scheduled_days', 2, 'learning_steps', 0, 'reps', 2, 'lapses', 0));
  begin
    perform public.undo_review('40000000-0000-0000-0000-000000000002', v_before);
    assert false, 'an older review must not be undone';
  exception when raise_exception then null;
  end;
  assert (select reps from public.cards where id = v_card.id) = 2, 'the card is untouched by a refused undo';
end $$;

-- retention figures: answers on cards that were already in review
do $$
declare r record;
begin
  perform public.apply_review(
    jsonb_build_object('id', '40000000-0000-0000-0000-000000000004',
      'card_id', (select id from public.cards where word_id = '30000000-0000-0000-0000-000000000001' and card_type = 'recognition'),
      'rating', 1, 'reviewed_at', '2026-10-11T10:10:00Z', 'duration_ms', 2000, 'state_before', 'review', 'state_after', 'relearning', 'scheduler_version', 't'),
    jsonb_build_object('state', 'relearning', 'due', '2026-10-11T10:20:00Z', 'stability', 1, 'difficulty', 6, 'scheduled_days', 0, 'learning_steps', 0, 'reps', 3, 'lapses', 1));
  select * into r from public.activity_by_day('UTC', '2026-10-01') where day = '2026-10-11';
  assert r.reviews = 1 and r.mature_reviews = 1 and r.mature_again = 1, 'mature reviews and lapses are reported per day';
  select * into r from public.activity_by_day('UTC', '2026-10-01') where day = '2026-10-09';
  assert r.reviews = 2 and r.mature_reviews = 0, 'learning-step answers are not counted as mature reviews';
end $$;

-- ---- quiz -----------------------------------------------------------------
do $$
declare
  n integer;
  v_session jsonb := jsonb_build_object('id', '50000000-0000-0000-0000-000000000001', 'kind', 'mixed',
    'started_at', '2026-10-09T11:00:00Z', 'finished_at', '2026-10-09T11:03:00Z', 'total', 3, 'correct', 1);
  v_answers jsonb := jsonb_build_array(
    jsonb_build_object('id', '51000000-0000-0000-0000-000000000001', 'word_id', '30000000-0000-0000-0000-000000000001', 'question_type', 'article',
      'prompt', 'Tisch', 'expected', 'der', 'answer', 'die', 'is_correct', false, 'duration_ms', 2100, 'answered_at', '2026-10-09T11:01:00Z'),
    jsonb_build_object('id', '51000000-0000-0000-0000-000000000002', 'word_id', '30000000-0000-0000-0000-000000000001', 'question_type', 'choice_de_fa',
      'prompt', 'der Tisch', 'expected', 'میز', 'answer', 'میز', 'is_correct', true, 'duration_ms', 1500, 'answered_at', '2026-10-09T11:02:00Z'),
    -- a word that does not exist (removed meanwhile): skipped, the rest is still stored
    jsonb_build_object('id', '51000000-0000-0000-0000-000000000003', 'word_id', '39999999-0000-0000-0000-000000000009', 'question_type', 'article',
      'prompt', 'x', 'expected', 'das', 'answer', 'der', 'is_correct', false, 'duration_ms', 900, 'answered_at', '2026-10-09T11:03:00Z'));
  r record;
begin
  n := public.save_quiz(v_session, v_answers);
  assert n = 2, 'answers are stored, unknown words skipped';
  n := public.save_quiz(v_session, v_answers);
  assert n = 0 and (select count(*) from public.quiz_sessions) = 1 and (select count(*) from public.quiz_answers) = 2, 'a retried upload stores nothing twice';

  select * into r from public.quiz_word_stats('2026-10-01T00:00:00Z');
  assert r.attempts = 2 and r.wrong = 1, 'per-word quiz statistics';
  assert (select count(*) from public.quiz_word_stats('2026-11-01T00:00:00Z')) = 0, 'statistics respect the time window';

  -- a quiz never touches review history or card state
  assert (select count(*) from public.review_events where reviewed_at = '2026-10-09T11:01:00Z') = 0, 'quiz answers are not review events';

  update public.quiz_answers set is_correct = true;
  get diagnostics n = row_count;
  assert n = 0, 'quiz history cannot be edited';
exception when insufficient_privilege then null;
end $$;

-- ---- another account sees and can undo nothing ------------------------------
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$
begin
  assert (select count(*) from public.quiz_sessions) = 0 and (select count(*) from public.quiz_answers) = 0, 'B cannot read C''s quizzes';
  assert (select count(*) from public.quiz_word_stats('2026-01-01T00:00:00Z')) = 0, 'B has no quiz statistics';
  assert public.ensure_reverse_cards() = 0, 'B has no words to create cards for';
  begin
    perform public.undo_review('40000000-0000-0000-0000-000000000004', '{}'::jsonb);
    assert false, 'B must not undo C''s review';
  exception when no_data_found then null;
  end;
  begin
    perform public.save_quiz(
      jsonb_build_object('id', '50000000-0000-0000-0000-000000000002', 'kind', 'article', 'started_at', now(), 'finished_at', now(), 'total', 1, 'correct', 0),
      jsonb_build_array(jsonb_build_object('id', '51000000-0000-0000-0000-000000000009', 'word_id', '30000000-0000-0000-0000-000000000001',
        'question_type', 'article', 'prompt', 'Tisch', 'expected', 'der', 'answer', 'das', 'is_correct', false, 'answered_at', now())));
  end;
  assert (select count(*) from public.quiz_answers) = 0, 'B cannot attach answers to C''s words';
end $$;

set role anon;
reset request.jwt.claim.sub;
do $$
begin
  begin
    perform public.undo_review('40000000-0000-0000-0000-000000000004', '{}'::jsonb);
    assert false, 'anon must not call undo_review';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.quiz_answers;
    assert false, 'anon must not reach quiz data';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000c';
do $$
begin
  assert (select count(*) from public.quiz_sessions) = 1, 'B''s own (empty) quiz session remains';
  assert (select count(*) from public.quiz_answers) = 0 and (select count(*) from public.cards) = 0, 'C''s data went with the account';
end $$;

select 'practice tests passed' as result;
