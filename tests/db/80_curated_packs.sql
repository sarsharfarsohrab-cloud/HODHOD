-- Behavioural tests for migration 0009 and the hand-written packs (supabase/seed/curated-packs.sql).
\set ON_ERROR_STOP on

reset role;
\i supabase/seed/curated-packs.sql
-- running it again changes nothing
\i supabase/seed/curated-packs.sql

do $$
declare v_words uuid; v_talk uuid;
begin
  select id into v_words from public.packs where slug = 'restaurant-words';
  select id into v_talk from public.packs where slug = 'restaurant-talk';
  assert v_words is not null and v_talk is not null, 'both packs exist';
  assert (select count(*) from public.packs where slug like 'restaurant-%' and published) = 0, 'they arrive unpublished';
  assert (select jsonb_array_length(lesson_titles) from public.packs where id = v_words) = 12, 'twelve named groups';
  assert (select count(*) from public.pack_items where pack_id = v_words) >= 100, 'the word pack is complete';
  assert (select count(*) from public.pack_items where pack_id = v_talk) >= 40, 'the sentence pack is complete';
  assert (select count(*) from public.pack_items i join public.packs p on p.id = i.pack_id
          where p.slug like 'restaurant-%' and (i.status <> 'ready' or i.content is null or i.lemma is null)) = 0, 'every entry is a finished card';
  assert (select max(lesson) from public.pack_items where pack_id = v_words) = 12, 'every group has entries';
  assert (select count(*) from public.pack_items where pack_id = v_talk and hint is null) = 0, 'every sentence says who speaks';
  update public.packs set published = true where slug like 'restaurant-%';
end $$;

-- the seed does not take a pack off the shelf again
\i supabase/seed/curated-packs.sql
do $$
begin
  assert (select count(*) from public.packs where slug like 'restaurant-%' and published) = 2, 'a published pack stays published';
end $$;

-- a learner reads the group names and takes one group of each pack
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d2';
do $$
declare v_words uuid; v_talk uuid; v_added integer;
begin
  select id into v_words from public.packs where slug = 'restaurant-words';
  select id into v_talk from public.packs where slug = 'restaurant-talk';
  assert (select lesson_titles ->> 6 from public.packs where id = v_words) is not null, 'a learner can read the group names';
  v_added := public.start_pack_lesson(v_words, 7);
  assert v_added >= 10, format('the group "on the table" went into the bank (%s)', v_added);
  assert (select count(*) from public.words where pack_id = v_words and source = 'pack') = v_added, 'the words carry their pack';
  assert public.start_pack_lesson(v_words, 7) = 0, 'taking the same group again adds nothing';
  v_added := public.start_pack_lesson(v_talk, 9);
  assert v_added = 7, format('the scene "paying" went into the bank (%s)', v_added);
  assert (select count(*) from public.cards c join public.words w on w.id = c.word_id where w.pack_id = v_talk) >= 7, 'the sentences have cards';
end $$;
reset role;
select 'curated packs: ok';
