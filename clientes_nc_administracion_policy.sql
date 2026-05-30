drop policy if exists "admin gestiona clientes nc" on public.clientes_nc;
drop policy if exists "admin administracion gestiona clientes nc" on public.clientes_nc;

create policy "admin administracion gestiona clientes nc"
on public.clientes_nc for all
to authenticated
using (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'administracion')
  )
)
with check (
  exists (
    select 1 from public.perfiles_usuarios p
    where p.email = auth.jwt() ->> 'email'
      and lower(p.rol) in ('admin', 'compras', 'administracion')
  )
);
