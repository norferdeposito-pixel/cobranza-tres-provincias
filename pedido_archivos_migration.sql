create table if not exists public.pedido_archivos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  nombre_archivo text not null,
  storage_path text not null unique,
  tipo_archivo text,
  tamano_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists pedido_archivos_pedido_id_idx on public.pedido_archivos (pedido_id);
create index if not exists pedido_archivos_created_at_idx on public.pedido_archivos (created_at);

alter table public.pedido_archivos enable row level security;

drop policy if exists "pedido_archivos acceso autorizado" on public.pedido_archivos;

create policy "pedido_archivos acceso autorizado"
on public.pedido_archivos
for all
to authenticated
using (
  exists (
    select 1
    from public.perfiles_usuarios p
    where lower(p.email) = lower(auth.jwt() ->> 'email')
      and coalesce(p.activo, true) = true
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
      and coalesce(p.activo, true) = true
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

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pedido-archivos',
  'pedido-archivos',
  false,
  15728640,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png'
  ]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "pedido_archivos_storage_select" on storage.objects;
drop policy if exists "pedido_archivos_storage_insert" on storage.objects;
drop policy if exists "pedido_archivos_storage_update" on storage.objects;
drop policy if exists "pedido_archivos_storage_delete" on storage.objects;

create policy "pedido_archivos_storage_select"
on storage.objects
for select
to authenticated
using (bucket_id = 'pedido-archivos');

create policy "pedido_archivos_storage_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'pedido-archivos');

create policy "pedido_archivos_storage_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'pedido-archivos')
with check (bucket_id = 'pedido-archivos');

create policy "pedido_archivos_storage_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'pedido-archivos');
