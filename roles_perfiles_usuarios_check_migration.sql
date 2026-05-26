alter table public.perfiles_usuarios
drop constraint if exists perfiles_usuarios_rol_check;

alter table public.perfiles_usuarios
add constraint perfiles_usuarios_rol_check
check (
  lower(rol) in (
    'admin',
    'compras',
    'vendedor',
    'deposito',
    'comercial',
    'produccion',
    'consultor',
    'gerencia',
    'administracion',
    'contaduria',
    'logistica'
  )
);
