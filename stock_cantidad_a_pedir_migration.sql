alter table public.stock_articulos
add column if not exists cantidad_a_pedir numeric not null default 0;
