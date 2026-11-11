-- Hodhod, stage 8: Italian becomes an interface (own) language too, not only a learned one.
-- Safe to run more than once.

update public.languages set can_be_native = true where code = 'it';
