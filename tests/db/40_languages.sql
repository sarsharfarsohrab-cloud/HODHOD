-- Behavioural tests for migrations 0004 and 0010 (many languages, Plus for a second language, a language learned through itself).
\set ON_ERROR_STOP on

reset role;
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000e1', 'polyglot@example.test', now());

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';

do $$
begin
  -- during the welcome tour: own language Ukrainian, learning English (no words yet: free)
  update public.profiles set native_language = 'uk', active_target_language = 'en' where id = '00000000-0000-0000-0000-0000000000e1';
  assert (select active_target_language from public.profiles where id = '00000000-0000-0000-0000-0000000000e1') = 'en', 'first language is free';

  insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content, target_language, native_language)
  values ('table', 'table', 'noun', 'стіл', '{}', 'en', 'uk');

  -- a word in another language than the one being learned is refused
  begin
    insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content, target_language, native_language)
    values ('Tisch', 'tisch', 'noun', 'стіл', '{}', 'de', 'uk');
    assert false, 'a word of another language must be refused';
  exception when sqlstate 'P0003' then null;
  end;

  -- a second language with words in the first one needs Plus
  begin
    update public.profiles set active_target_language = 'fr' where id = '00000000-0000-0000-0000-0000000000e1';
    assert false, 'a second language needs Plus';
  exception when sqlstate 'P0004' then null;
  end;

  -- a language is not refused because it is also the learner's own (migration 0010); Ukrainian is simply not learnable
  begin
    update public.profiles set active_target_language = 'uk' where id = '00000000-0000-0000-0000-0000000000e1';
    assert false, 'Ukrainian is not a learned language';
  exception when sqlstate 'P0003' then null;
  end;
  -- since migration 0008 Italian is an interface language as well
  assert (select can_be_native from public.languages where code = 'it'), 'Italian can be the learner''s own language';
  -- the own language may now equal the learned one (migration 0010); a language that is not offered is still refused
  begin
    update public.profiles set native_language = 'xx' where id = '00000000-0000-0000-0000-0000000000e1';
    assert false, 'an unknown own language is refused';
  exception when sqlstate 'P0003' or sqlstate '23503' then null;
  end;
  assert not public.has_plus('00000000-0000-0000-0000-0000000000e1'), 'no Plus yet';
end $$;

reset role;
insert into public.user_limits (user_id, plus_until) values ('00000000-0000-0000-0000-0000000000e1', now() + interval '30 days');

set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e1';
do $$
begin
  update public.profiles set active_target_language = 'fr' where id = '00000000-0000-0000-0000-0000000000e1';
  assert (select active_target_language from public.profiles where id = '00000000-0000-0000-0000-0000000000e1') = 'fr', 'with Plus a second language opens';
  -- going back to a language that already has words is always free
  update public.profiles set active_target_language = 'en' where id = '00000000-0000-0000-0000-0000000000e1';
  assert (select count(*) from public.user_languages where user_id = '00000000-0000-0000-0000-0000000000e1' and target_language in ('en', 'fr')) = 2, 'both decks are listed';
end $$;

reset role;
select 'languages: ok';

-- an English speaker learning English: allowed, and the words carry the pair
reset role;
insert into auth.users (id, email, created_at) values ('00000000-0000-0000-0000-0000000000e3', 'monolingual@example.test', now());
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000e3';
do $$
begin
  update public.profiles set native_language = 'en', active_target_language = 'en' where id = '00000000-0000-0000-0000-0000000000e3';
  assert (select native_language = 'en' and active_target_language = 'en' from public.profiles where id = '00000000-0000-0000-0000-0000000000e3'), 'English through English';
  insert into public.words (lemma, normalized_lemma, pos, primary_meaning, content, target_language, native_language)
  values ('table', 'table', 'noun', 'a piece of furniture with a flat top', '{}', 'en', 'en');
  update public.profiles set native_language = 'de' where id = '00000000-0000-0000-0000-0000000000e3';
  update public.profiles set native_language = 'en' where id = '00000000-0000-0000-0000-0000000000e3';
end $$;
reset role;
