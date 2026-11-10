-- Numbers for the introduction site (apphodhod.com): how many learners, words and reviews.
-- Only totals, never anything about one person; anyone may read them (the site has no sign-in).
-- The site shows them only once they are large enough to mean something.

create or replace function public.public_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'learners', (select count(*) from public.profiles),
    'words', (select count(*) from public.words),
    'reviews', (select count(*) from public.review_events),
    'updated', now()
  )
$$;

revoke all on function public.public_stats() from public;
grant execute on function public.public_stats() to anon, authenticated;
