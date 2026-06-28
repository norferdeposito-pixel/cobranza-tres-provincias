create table if not exists public.devoluciones (
  id uuid primary key default gen_random_uuid(),
  fecha_devolucion date,
  proveedor text not null,
  numero_devolucion text unique,
  numero_oc text,
  numero_factura text,
  numero_nc text,
  estado text not null default 'EN CURSO',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.devoluciones
  add column if not exists fecha_devolucion date,
  add column if not exists proveedor text,
  add column if not exists numero_devolucion text,
  add column if not exists numero_oc text,
  add column if not exists numero_factura text,
  add column if not exists numero_nc text,
  add column if not exists estado text default 'EN CURSO',
  add column if not exists observaciones text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create unique index if not exists devoluciones_numero_devolucion_key
  on public.devoluciones (numero_devolucion)
  where numero_devolucion is not null;

create index if not exists devoluciones_fecha_idx on public.devoluciones (fecha_devolucion);
create index if not exists devoluciones_estado_idx on public.devoluciones (estado);
create index if not exists devoluciones_proveedor_idx on public.devoluciones (proveedor);

alter table public.devoluciones
  alter column estado set default 'EN CURSO';

update public.devoluciones
set estado = 'EN CURSO'
where estado is null or upper(estado) = 'PENDIENTE';

update public.devoluciones
set estado = 'TERMINADO'
where numero_nc is not null
  and btrim(numero_nc) <> '';

alter table public.devoluciones enable row level security;

drop policy if exists "devoluciones acceso autorizado" on public.devoluciones;

create policy "devoluciones acceso autorizado"
on public.devoluciones
for all
to authenticated
using (
  exists (
    select 1
    from public.perfiles_usuarios p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
      and lower(p.rol) in (
        'admin',
        'compras',
        'vendedor',
        'comercial',
        'produccion',
        'consultor',
        'gerencia',
        'administracion',
        'contaduria',
        'logistica',
        'deposito'
      )
  )
)
with check (
  exists (
    select 1
    from public.perfiles_usuarios p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
      and lower(p.rol) in (
        'admin',
        'compras',
        'vendedor',
        'comercial',
        'produccion',
        'consultor',
        'gerencia',
        'administracion',
        'contaduria',
        'logistica',
        'deposito'
      )
  )
);
