create table if not exists public.app_snapshots (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_snapshots enable row level security;

drop policy if exists "public users can read app snapshots" on public.app_snapshots;
drop policy if exists "public users can write app snapshots" on public.app_snapshots;
drop policy if exists "public users can update app snapshots" on public.app_snapshots;

create policy "public users can read app snapshots"
  on public.app_snapshots for select to anon, authenticated using (true);

create policy "public users can write app snapshots"
  on public.app_snapshots for insert to anon, authenticated with check (true);

create policy "public users can update app snapshots"
  on public.app_snapshots for update to anon, authenticated using (true) with check (true);
