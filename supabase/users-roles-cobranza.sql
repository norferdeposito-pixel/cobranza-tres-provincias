create table if not exists public.perfiles_usuarios (
  email text primary key,
  nombre text not null default '',
  rol text not null default 'cobrador',
  collector_name text not null default '',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfiles_usuarios
  add column if not exists collector_name text not null default '',
  add column if not exists activo boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table public.perfiles_usuarios enable row level security;

drop policy if exists "authenticated users can read profiles" on public.perfiles_usuarios;
drop policy if exists "admins can manage profiles" on public.perfiles_usuarios;
drop function if exists public.is_admin_user();

create or replace function public.is_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles_usuarios requester
    where requester.email = auth.jwt() ->> 'email'
      and requester.rol = 'admin'
      and requester.activo = true
  );
$$;

create policy "authenticated users can read profiles"
  on public.perfiles_usuarios for select to authenticated using (true);

create policy "admins can manage profiles"
  on public.perfiles_usuarios for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Crear el primer perfil administrador desde el SQL Editor:
-- 1) Crear antes el usuario en Authentication > Users.
-- 2) Reemplazar el email de abajo por el email real del administrador.
-- insert into public.perfiles_usuarios (email, nombre, rol, collector_name, activo)
-- values ('TU_EMAIL_ADMIN@EJEMPLO.COM', 'ADMINISTRADOR', 'admin', '', true)
-- on conflict (email) do update
-- set nombre = excluded.nombre,
--     rol = excluded.rol,
--     collector_name = excluded.collector_name,
--     activo = true,
--     updated_at = now();
