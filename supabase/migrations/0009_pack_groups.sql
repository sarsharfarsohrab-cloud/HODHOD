-- Hodhod, stage 9: packs whose lessons are named groups ("جاها و آدم‌ها", "روی میز", …).
-- A pack with group names is shown as a set of groups that can be opened in any order; a pack
-- without them keeps its numbered lessons. Safe to run more than once.

alter table public.packs add column if not exists lesson_titles jsonb;

comment on column public.packs.lesson_titles is 'Names of the lessons in order, when the pack is made of named groups; null otherwise.';
