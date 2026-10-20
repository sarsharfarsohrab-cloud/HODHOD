-- Hodhod: send reminders every 15 minutes.
-- Run once in Supabase → SQL Editor, AFTER migration 0003 and after deploying the "push"
-- function with "Verify JWT" switched OFF (the function checks its own secret).
-- Contains no secret: the scheduler password is read from the database itself.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- the scheduler password (created here if the app has not asked for push keys yet)
insert into public.push_secrets (id) values (1) on conflict (id) do nothing;

-- replace an older schedule of the same name
select cron.unschedule(jobid) from cron.job where jobname = 'hodhod-reminders';

select cron.schedule(
  'hodhod-reminders',
  '*/15 * * * *',
  $job$
  select net.http_post(
    url := 'https://arhmdxtclovgfwokrxob.supabase.co/functions/v1/push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('action', 'cron', 'secret', (select s.cron_secret from public.push_secrets s where s.id = 1)),
    timeout_milliseconds := 30000
  );
  $job$
);

-- check: one row named hodhod-reminders
select jobname, schedule, active from cron.job where jobname = 'hodhod-reminders';
