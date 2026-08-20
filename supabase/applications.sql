create table if not exists public.application_pass_rate_records (
  id text primary key,
  date text not null default '',
  company text not null default '',
  role text not null default '',
  result text not null default '미정' check (result in ('합격', '불합격', '미정')),
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.application_pass_rate_records enable row level security;

grant select, insert, update, delete
on table public.application_pass_rate_records
to anon, authenticated;

drop policy if exists "Allow public read application records"
on public.application_pass_rate_records;

create policy "Allow public read application records"
on public.application_pass_rate_records
for select
to anon, authenticated
using (true);

drop policy if exists "Allow public insert application records"
on public.application_pass_rate_records;

create policy "Allow public insert application records"
on public.application_pass_rate_records
for insert
to anon, authenticated
with check (true);

drop policy if exists "Allow public update application records"
on public.application_pass_rate_records;

create policy "Allow public update application records"
on public.application_pass_rate_records
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Allow public delete application records"
on public.application_pass_rate_records;

create policy "Allow public delete application records"
on public.application_pass_rate_records
for delete
to anon, authenticated
using (true);
