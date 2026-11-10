-- Hodhod, stage 4: many languages.
--   Learned languages: German, English, French, Italian, Spanish, Dutch.
--   Own (interface) languages: Persian, German, English, French, Turkish, Ukrainian, Russian,
--   Arabic, Spanish, Dutch.
-- A free account learns one language; words in a second language need Hodhod Plus.
-- Safe to run more than once.

insert into public.languages (code, name_en, name_native, direction, can_be_target, can_be_native) values
  ('de', 'German',    'Deutsch',    'ltr', true,  true),
  ('fa', 'Persian',   'فارسی',      'rtl', false, true),
  ('en', 'English',   'English',    'ltr', true,  true),
  ('fr', 'French',    'Français',   'ltr', true,  true),
  ('it', 'Italian',   'Italiano',   'ltr', true,  false),
  ('es', 'Spanish',   'Español',    'ltr', true,  true),
  ('nl', 'Dutch',     'Nederlands', 'ltr', true,  true),
  ('tr', 'Turkish',   'Türkçe',     'ltr', false, true),
  ('uk', 'Ukrainian', 'Українська', 'ltr', false, true),
  ('ru', 'Russian',   'Русский',    'ltr', false, true),
  ('ar', 'Arabic',    'العربية',    'rtl', false, true)
on conflict (code) do update set
  name_en = excluded.name_en,
  name_native = excluded.name_native,
  direction = excluded.direction,
  can_be_target = excluded.can_be_target,
  can_be_native = excluded.can_be_native;

-- Hodhod Plus: until when an account has it (set by the administrator for now, later by payments).
alter table public.user_limits add column if not exists plus_until timestamptz;

create or replace function public.has_plus(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = p_user)
      or exists (select 1 from public.user_limits ul where ul.user_id = p_user and ul.plus_until > now());
$$;

-- Choosing the language to learn and the own language. The first language is free; a learner who
-- already has words in another language needs Plus for a new one. Languages without words do
-- not count, so changing one's mind during the welcome tour is free.
create or replace function public.guard_profile_languages()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.native_language is distinct from old.native_language
     and not exists (select 1 from public.languages l where l.code = new.native_language and l.can_be_native) then
    raise exception 'language_not_available' using errcode = 'P0003';
  end if;
  if new.active_target_language is distinct from old.active_target_language then
    if not exists (select 1 from public.languages l where l.code = new.active_target_language and l.can_be_target) then
      raise exception 'language_not_available' using errcode = 'P0003';
    end if;
    if not exists (
         select 1 from public.words w
         where w.user_id = new.id and w.target_language = new.active_target_language and w.deleted_at is null
       )
       and exists (
         select 1 from public.words w
         where w.user_id = new.id and w.target_language <> new.active_target_language and w.deleted_at is null
       )
       and not public.has_plus(new.id) then
      raise exception 'plus_required' using errcode = 'P0004';
    end if;
    insert into public.user_languages (user_id, target_language)
    values (new.id, new.active_target_language)
    on conflict do nothing;
  end if;
  if new.active_target_language = new.native_language then
    raise exception 'same_language' using errcode = 'P0003';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_language_guard on public.profiles;
create trigger profiles_language_guard before update on public.profiles
  for each row execute function public.guard_profile_languages();

-- A word always belongs to the language the learner is learning now, so the Plus rule above
-- cannot be bypassed by writing words of another language directly.
create or replace function public.guard_word_language()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.user_id and p.active_target_language = new.target_language and p.native_language = new.native_language
  ) then
    raise exception 'wrong_language' using errcode = 'P0003';
  end if;
  return new;
end;
$$;

drop trigger if exists words_language_guard on public.words;
create trigger words_language_guard before insert on public.words
  for each row execute function public.guard_word_language();

-- Each deck can have its own colour later; nothing else to store per language for now.
revoke all on function public.has_plus(uuid) from anon, public;
grant execute on function public.has_plus(uuid) to authenticated;

-- The price of the model the app actually uses (gpt-6-luna: $0.10 input, $0.50 output per
-- million tokens). Without it the default price of a far dearer model was counted.
update public.app_config
set value = value || '{"gpt-6-luna": {"input": 0.10, "output": 0.50}}'::jsonb
where key = 'ai_prices' and not (value ? 'gpt-6-luna');

-- The administrator gives (or takes back) Hodhod Plus by hand until payments exist.
-- p_days > 0: Plus for that many days from now; 0 or null: no Plus.
create or replace function public.admin_set_plus(p_user uuid, p_days integer)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_until timestamptz := case when coalesce(p_days, 0) > 0 then now() + make_interval(days => p_days) else null end;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.user_limits (user_id, plus_until) values (p_user, v_until)
  on conflict (user_id) do update set plus_until = excluded.plus_until;
  return v_until;
end;
$$;

revoke all on function public.admin_set_plus(uuid, integer) from anon, public;
grant execute on function public.admin_set_plus(uuid, integer) to authenticated;
