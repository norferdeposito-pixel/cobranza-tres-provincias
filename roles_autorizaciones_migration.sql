drop policy if exists "usuarios autorizados leen notas credito" on public.notas_credito;
create policy "usuarios autorizados leen notas credito"
on public.notas_credito for select
to authenticated
using (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in (
        'admin', 'compras', 'vendedor', 'comercial', 'produccion',
        'consultor', 'gerencia', 'administracion', 'contaduria'
      )
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
      and lower(p.rol) in (
        'admin', 'compras', 'vendedor', 'comercial', 'produccion',
        'consultor', 'gerencia', 'administracion', 'contaduria'
      )
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in (
        'admin', 'compras', 'vendedor', 'comercial', 'produccion',
        'consultor', 'gerencia', 'administracion', 'contaduria'
      )
  )
);

drop policy if exists "usuarios autenticados leen clientes nc" on public.clientes_nc;
create policy "usuarios autenticados leen clientes nc"
on public.clientes_nc for select
to authenticated
using (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in (
        'admin', 'compras', 'vendedor', 'comercial', 'produccion',
        'consultor', 'gerencia', 'administracion', 'contaduria'
      )
  )
);
