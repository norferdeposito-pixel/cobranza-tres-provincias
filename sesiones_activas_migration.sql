create table if not exists public.sesiones_activas (
  session_token text primary key,
  email text not null,
  nombre text,
  rol text,
  office text,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create index if not exists sesiones_activas_email_idx on public.sesiones_activas (email);
create index if not exists sesiones_activas_office_idx on public.sesiones_activas (office);
create index if not exists sesiones_activas_last_seen_idx on public.sesiones_activas (last_seen);

alter table public.sesiones_activas enable row level security;

drop policy if exists "sesiones_activas_select" on public.sesiones_activas;
drop policy if exists "sesiones_activas_insert" on public.sesiones_activas;
drop policy if exists "sesiones_activas_update" on public.sesiones_activas;
drop policy if exists "sesiones_activas_delete" on public.sesiones_activas;

create policy "sesiones_activas_select"
on public.sesiones_activas
for select
to authenticated
using (true);

create policy "sesiones_activas_insert"
on public.sesiones_activas
for insert
to authenticated
with check (auth.uid() is not null);

create policy "sesiones_activas_update"
on public.sesiones_activas
for update
to authenticated
using (true)
with check (auth.uid() is not null);

create policy "sesiones_activas_delete"
on public.sesiones_activas
for delete
to authenticated
using (true);

notify pgrst, 'reload schema';
