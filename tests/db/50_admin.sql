-- Behavioural tests for migration 0005 (accounting and growth in the admin panel).
\set ON_ERROR_STOP on

reset role;
insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'spender@example.test', now() - interval '3 days');
update public.app_config set value = value || '{"gpt-test": {"input": 1, "output": 2}}'::jsonb where key = 'ai_prices';
insert into public.ai_generation_logs (user_id, kind, status, model, input_tokens, output_tokens, created_at) values
  ('00000000-0000-0000-0000-0000000000f1', 'analyze_word', 'ok', 'gpt-test', 1000000, 1000000, now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000f1', 'analyze_word', 'cache_hit', null, null, null, now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000f1', 'story', 'ok', 'gpt-unknown', 10, 10, now());

-- learners cannot read the accounting
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000f1';
do $$
begin
  begin
    perform public.admin_costs(30);
    assert false, 'learners cannot read the costs';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.admin_growth(30);
    assert false, 'learners cannot read the growth numbers';
  exception when insufficient_privilege then null;
  end;
end $$;

-- the administrator (made admin in 30_platform.sql)
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000d1';
do $$
declare
  v jsonb;
  card jsonb;
begin
  v := public.admin_costs(30);
  select k into card from jsonb_array_elements(v -> 'by_kind') k where k ->> 'kind' = 'analyze_word';
  assert (card ->> 'ok')::integer >= 1 and (card ->> 'cache_hits')::integer >= 1, 'cards and cache hits are counted apart';
  assert (card ->> 'cost')::numeric >= 3, 'the cost uses the model''s own price (1 + 2 dollars)';
  assert exists (select 1 from jsonb_array_elements(v -> 'models') m where m ->> 'model' = 'gpt-unknown' and (m ->> 'priced')::boolean = false),
    'a model without a price is flagged';
  assert exists (select 1 from jsonb_array_elements(v -> 'models') m where m ->> 'model' = 'gpt-test' and (m ->> 'priced')::boolean),
    'a model with a price is not flagged';
  assert (v -> 'top_users' -> 0 ->> 'email') = 'spender@example.test', 'the biggest spender comes first';

  v := public.admin_growth(30);
  assert (v ->> 'users')::integer >= 4, 'growth counts accounts';
  assert jsonb_array_length(v -> 'daily') = 30, 'one row per day';
  assert (v -> 'retention' -> 'd1' ->> 'base')::integer >= 1, 'retention has a base';
  assert (v -> 'native') ? 'fa', 'own languages are counted';
end $$;
reset role;
select 'admin: ok';
