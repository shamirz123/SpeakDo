-- SpeakDo database schema.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------
create table if not exists public.tasks (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 300),
  notes            text,
  due_at           timestamptz,
  priority         text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  category         text,
  status           text not null default 'todo' check (status in ('todo', 'done')),
  reminder_sent_at timestamptz,
  created_at       timestamptz not null default now(),
  completed_at     timestamptz
);

create index if not exists tasks_user_idx on public.tasks (user_id, status, due_at);
-- Used by the reminder job to find due, un-notified tasks quickly.
create index if not exists tasks_due_idx on public.tasks (due_at)
  where status = 'todo' and reminder_sent_at is null;

-- Changing the due time re-arms the reminder.
create or replace function public.tasks_rearm_reminder() returns trigger
language plpgsql as $$
begin
  if new.due_at is distinct from old.due_at or new.status = 'todo' and old.status = 'done' then
    new.reminder_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_rearm_reminder on public.tasks;
create trigger tasks_rearm_reminder
  before update on public.tasks
  for each row execute function public.tasks_rearm_reminder();

alter table public.tasks enable row level security;

create policy "tasks: owner select" on public.tasks
  for select using (auth.uid() = user_id);
create policy "tasks: owner insert" on public.tasks
  for insert with check (auth.uid() = user_id);
create policy "tasks: owner update" on public.tasks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tasks: owner delete" on public.tasks
  for delete using (auth.uid() = user_id);

-- Live sync: changes made on one device appear instantly on the others.
alter publication supabase_realtime add table public.tasks;

-- ---------------------------------------------------------------------------
-- Web Push subscriptions (one row per browser/device)
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "push: owner select" on public.push_subscriptions
  for select using (auth.uid() = user_id);
create policy "push: owner insert" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);
create policy "push: owner delete" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Delivery log: every reminder attempt, per channel, with the reason it did or
-- didn't go out. This is what the in-app "Recent deliveries" list shows.
-- ---------------------------------------------------------------------------
create table if not exists public.reminder_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  task_id    uuid,
  task_title text not null,
  channel    text not null,
  status     text not null check (status in ('sent', 'failed', 'skipped')),
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists reminder_log_user_idx on public.reminder_log (user_id, created_at desc);

alter table public.reminder_log enable row level security;

create policy "log: owner select" on public.reminder_log
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Daily AI usage cap (keeps you inside the free tier's limits and stops abuse)
-- Only the server (service role) can touch this table.
-- ---------------------------------------------------------------------------
create table if not exists public.api_usage (
  key   text not null,
  day   date not null default (now() at time zone 'utc')::date,
  count int  not null default 0,
  primary key (key, day)
);

alter table public.api_usage enable row level security;
-- No policies: with RLS enabled and no policy, anon/authenticated users cannot read or write.

-- Atomically increments today's counter. Returns true if the call is allowed.
create or replace function public.increment_usage(p_key text, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  new_count int;
begin
  insert into public.api_usage as u (key, day, count)
  values (p_key, (now() at time zone 'utc')::date, 1)
  on conflict (key, day) do update set count = u.count + 1
  returning u.count into new_count;

  return new_count <= p_limit;
end;
$$;

revoke all on function public.increment_usage(text, int) from public, anon, authenticated;
grant execute on function public.increment_usage(text, int) to service_role;

-- ---------------------------------------------------------------------------
-- API permissions. Row Level Security (above) decides WHICH rows each user can
-- touch; these grants decide which tables the API roles can reach at all.
-- Explicit so it works whether or not "Automatically expose new tables" is on.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on public.tasks              to authenticated;
grant select, insert, delete         on public.push_subscriptions to authenticated;
grant select                         on public.reminder_log       to authenticated;

grant all on public.tasks, public.push_subscriptions, public.reminder_log, public.api_usage
  to service_role;

-- ---------------------------------------------------------------------------
-- Reminder scheduler (every minute) — OPTIONAL here, see README.
-- Enable the "pg_cron" and "pg_net" extensions (Database -> Extensions), then
-- replace the two placeholders and run:
--
-- select cron.schedule(
--   'speakdo-reminders',
--   '* * * * *',
--   $$ select net.http_post(
--        url     := 'https://YOUR-APP.vercel.app/api/cron/reminders',
--        headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET')
--      ) $$
-- );
-- ---------------------------------------------------------------------------
