-- Run this ONCE in the Supabase SQL Editor if you already ran the original
-- schema.sql. It only adds the delivery log used by the "Recent deliveries"
-- list. Safe to run twice.

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

drop policy if exists "log: owner select" on public.reminder_log; 
create policy "log: owner select" on public.reminder_log
  for select using (auth.uid() = user_id);

grant select on public.reminder_log to authenticated;
grant all    on public.reminder_log to service_role;
