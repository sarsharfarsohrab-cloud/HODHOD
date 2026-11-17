-- Hodhod, stage 10: a language may be learned through itself (an English speaker learning
-- English words with explanations in English). Only the 'same_language' rule is removed from
-- the profile guard; everything else is as in migration 0004. Safe to run more than once.

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
  return new;
end;
$$;
