create table if not exists public.clientes_nc (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre text not null,
  domicilio_1 text,
  domicilio_2 text,
  transporte text,
  created_at timestamptz not null default now()
);

create table if not exists public.notas_credito (
  id uuid primary key default gen_random_uuid(),
  fecha_carga date not null default current_date,
  codigo_cliente text,
  cliente text,
  tipo_comprobante text,
  numero_comprobante text,
  fecha_comprobante date,
  detalle text,
  monto numeric,
  moneda text default 'PESOS',
  motivo text,
  vendedor text,
  obs text,
  fecha_generada_nc date,
  numero_nc text,
  realizo text,
  observaciones text,
  estado text not null default 'pendiente',
  dias_transcurridos integer generated always as (
    case
      when fecha_carga is not null and fecha_comprobante is not null
      then fecha_carga - fecha_comprobante
      else null
    end
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_clientes_nc_codigo on public.clientes_nc (codigo);
create index if not exists idx_notas_credito_fecha_carga on public.notas_credito (fecha_carga desc);
create index if not exists idx_notas_credito_codigo_cliente on public.notas_credito (codigo_cliente);
create index if not exists idx_notas_credito_estado on public.notas_credito (estado);

alter table public.clientes_nc enable row level security;
alter table public.notas_credito enable row level security;

drop policy if exists "usuarios autenticados leen clientes nc" on public.clientes_nc;
create policy "usuarios autenticados leen clientes nc"
on public.clientes_nc for select
to authenticated
using (true);

drop policy if exists "admin gestiona clientes nc" on public.clientes_nc;
create policy "admin gestiona clientes nc"
on public.clientes_nc for all
to authenticated
using (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras')
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras')
  )
);

drop policy if exists "usuarios autorizados leen notas credito" on public.notas_credito;
create policy "usuarios autorizados leen notas credito"
on public.notas_credito for select
to authenticated
using (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'vendedor')
  )
);

drop policy if exists "usuarios autorizados gestionan notas credito" on public.notas_credito;
create policy "usuarios autorizados gestionan notas credito"
on public.notas_credito for all
to authenticated
using (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'vendedor')
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'vendedor')
  )
);
