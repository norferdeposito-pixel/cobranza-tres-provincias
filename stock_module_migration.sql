create table if not exists public.stock_articulos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  descripcion text not null,
  familia text,
  unidad text,
  proveedor_habitual text,
  lead_time_nacional_dias numeric,
  lead_time_importacion_dias numeric,
  stock_seguridad numeric not null default 0,
  punto_pedido numeric not null default 0,
  cantidad_a_pedir numeric not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_actual (
  codigo_articulo text primary key references public.stock_articulos(codigo) on update cascade on delete cascade,
  stock_actual numeric not null default 0,
  fecha_ultima_actualizacion date,
  updated_at timestamptz not null default now()
);

create index if not exists stock_articulos_familia_idx on public.stock_articulos (familia);
create index if not exists stock_articulos_activo_idx on public.stock_articulos (activo);
create index if not exists stock_actual_fecha_idx on public.stock_actual (fecha_ultima_actualizacion);

alter table public.stock_articulos enable row level security;
alter table public.stock_actual enable row level security;

alter table public.stock_articulos
add column if not exists cantidad_a_pedir numeric not null default 0;

drop policy if exists "stock articulos acceso autorizado" on public.stock_articulos;
drop policy if exists "stock actual acceso autorizado" on public.stock_actual;

create policy "stock articulos acceso autorizado"
on public.stock_articulos
for all
to authenticated
using (
  exists (
    select 1
    from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'logistica', 'deposito')
  )
)
with check (
  exists (
    select 1
    from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'logistica', 'deposito')
  )
);

create policy "stock actual acceso autorizado"
on public.stock_actual
for all
to authenticated
using (
  exists (
    select 1
    from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'logistica', 'deposito')
  )
)
with check (
  exists (
    select 1
    from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'logistica', 'deposito')
  )
);
