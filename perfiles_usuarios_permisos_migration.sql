alter table public.perfiles_usuarios
  add column if not exists permisos text[];

create or replace function public.es_admin_perfiles()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.perfiles_usuarios p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
      and lower(coalesce(p.rol, '')) in ('admin', 'compras')
      and coalesce(p.activo, true) = true
  );
$$;

update public.perfiles_usuarios
set permisos = case lower(coalesce(rol, ''))
  when 'admin' then array[
    'ver_dashboard',
    'ver_pedidos',
    'crear_pedidos',
    'editar_pedidos',
    'cargar_recibidos',
    'colocar_novedades',
    'ver_alertas',
    'ver_cotizaciones',
    'ver_reportes',
    'ver_notas_credito',
    'cerrar_notas_credito',
    'ver_clientes',
    'ver_stock',
    'ver_devoluciones',
    'ver_proveedores',
    'ver_usuarios'
  ]::text[]
  when 'compras' then array[
    'ver_dashboard',
    'ver_pedidos',
    'crear_pedidos',
    'editar_pedidos',
    'cargar_recibidos',
    'colocar_novedades',
    'ver_alertas',
    'ver_cotizaciones',
    'ver_reportes',
    'ver_notas_credito',
    'cerrar_notas_credito',
    'ver_clientes',
    'ver_stock',
    'ver_devoluciones',
    'ver_proveedores',
    'ver_usuarios'
  ]::text[]
  when 'comercial' then array[
    'ver_pedidos',
    'crear_pedidos',
    'ver_notas_credito',
    'ver_devoluciones'
  ]::text[]
  when 'produccion' then array[
    'ver_pedidos',
    'crear_pedidos',
    'ver_notas_credito',
    'ver_devoluciones'
  ]::text[]
  when 'vendedor' then array[
    'ver_pedidos',
    'crear_pedidos',
    'ver_notas_credito',
    'ver_devoluciones'
  ]::text[]
  when 'consultor' then array[
    'ver_pedidos',
    'ver_reportes',
    'ver_cotizaciones',
    'ver_notas_credito'
  ]::text[]
  when 'gerencia' then array[
    'ver_pedidos',
    'ver_reportes',
    'ver_cotizaciones',
    'ver_notas_credito'
  ]::text[]
  when 'administracion' then array[
    'ver_notas_credito',
    'cerrar_notas_credito',
    'ver_clientes',
    'ver_devoluciones'
  ]::text[]
  when 'contaduria' then array[
    'ver_pedidos',
    'ver_reportes',
    'ver_notas_credito',
    'ver_devoluciones'
  ]::text[]
  when 'logistica' then array[
    'ver_pedidos',
    'crear_pedidos',
    'cargar_recibidos',
    'colocar_novedades',
    'ver_devoluciones'
  ]::text[]
  when 'deposito' then array[
    'ver_pedidos',
    'crear_pedidos',
    'cargar_recibidos',
    'colocar_novedades',
    'ver_stock',
    'ver_devoluciones'
  ]::text[]
  else permisos
end
where permisos is null;

alter table public.perfiles_usuarios enable row level security;

drop policy if exists perfiles_usuarios_admin_select on public.perfiles_usuarios;
create policy perfiles_usuarios_admin_select
on public.perfiles_usuarios
for select
to authenticated
using (
  public.es_admin_perfiles()
  or lower(email) = lower(auth.jwt() ->> 'email')
);

drop policy if exists perfiles_usuarios_admin_update on public.perfiles_usuarios;
create policy perfiles_usuarios_admin_update
on public.perfiles_usuarios
for update
to authenticated
using (public.es_admin_perfiles())
with check (public.es_admin_perfiles());
