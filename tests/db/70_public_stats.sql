-- Behavioural tests for migration 0007 (totals for the introduction site).
\set ON_ERROR_STOP on

set role anon;
do $$
declare v jsonb;
begin
  v := public.public_stats();
  assert (v ->> 'learners')::bigint >= 1, 'learners are counted';
  assert v ? 'words' and v ? 'reviews', 'words and reviews are counted';
  assert not (v ? 'email'), 'nothing about one person';
end $$;
reset role;
select 'public stats: ok';
