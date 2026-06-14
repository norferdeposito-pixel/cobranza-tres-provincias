create extension if not exists pgcrypto;

create table if not exists public.dependencies (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collectors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  phone text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  policy_number text not null,
  full_name text not null,
  plan text not null,
  value numeric(12, 2) not null default 0,
  phone text not null default '',
  address text not null default '',
  dependency_code text not null references public.dependencies(code),
  collector_name text not null references public.collectors(name),
  request text not null default '',
  latest_news text not null default '',
  selected_for_monthly boolean not null default true,
  source_tickets integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(policy_number, plan)
);

create table if not exists public.monthly_items (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  tickets integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(month, affiliate_id)
);

create table if not exists public.ticket_collections (
  id uuid primary key default gen_random_uuid(),
  month text not null,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  tickets_charged integer not null default 0,
  payment_method text not null check (payment_method in ('E', 'T')),
  transfer_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.receipt_collections (
  id uuid primary key default gen_random_uuid(),
  collection_month text not null,
  receipt_number text not null,
  full_name text not null,
  policy_number text not null default '',
  plan text not null,
  paid_month text not null,
  month_count integer not null default 1,
  monthly_amount numeric(12, 2) not null default 0,
  payment_method text not null check (payment_method in ('E', 'T')),
  transfer_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.affiliate_notes (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  month text not null,
  note_date date not null default current_date,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.renditions (
  id uuid primary key default gen_random_uuid(),
  month text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rendition_cash (
  id uuid primary key default gen_random_uuid(),
  rendition_id uuid not null references public.renditions(id) on delete cascade,
  render_date date not null default current_date,
  amount numeric(12, 2) not null default 0,
  detail text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.rendition_transfers (
  id uuid primary key default gen_random_uuid(),
  rendition_id uuid not null references public.renditions(id) on delete cascade,
  render_date date not null default current_date,
  amount numeric(12, 2) not null default 0,
  proof text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_affiliates_policy on public.affiliates(policy_number);
create index if not exists idx_affiliates_dependency on public.affiliates(dependency_code);
create index if not exists idx_affiliates_collector on public.affiliates(collector_name);
create index if not exists idx_monthly_items_month on public.monthly_items(month);
create index if not exists idx_ticket_collections_month on public.ticket_collections(month);
create index if not exists idx_receipts_month on public.receipt_collections(collection_month);

insert into public.collectors (name, phone)
values ('OFICINA', '')
on conflict (name) do nothing;

alter table public.dependencies enable row level security;
alter table public.collectors enable row level security;
alter table public.affiliates enable row level security;
alter table public.monthly_items enable row level security;
alter table public.ticket_collections enable row level security;
alter table public.receipt_collections enable row level security;
alter table public.affiliate_notes enable row level security;
alter table public.renditions enable row level security;
alter table public.rendition_cash enable row level security;
alter table public.rendition_transfers enable row level security;

create policy "authenticated users can manage dependencies"
  on public.dependencies for all to authenticated using (true) with check (true);

create policy "authenticated users can manage collectors"
  on public.collectors for all to authenticated using (true) with check (true);

create policy "authenticated users can manage affiliates"
  on public.affiliates for all to authenticated using (true) with check (true);

create policy "authenticated users can manage monthly items"
  on public.monthly_items for all to authenticated using (true) with check (true);

create policy "authenticated users can manage ticket collections"
  on public.ticket_collections for all to authenticated using (true) with check (true);

create policy "authenticated users can manage receipt collections"
  on public.receipt_collections for all to authenticated using (true) with check (true);

create policy "authenticated users can manage affiliate notes"
  on public.affiliate_notes for all to authenticated using (true) with check (true);

create policy "authenticated users can manage renditions"
  on public.renditions for all to authenticated using (true) with check (true);

create policy "authenticated users can manage rendition cash"
  on public.rendition_cash for all to authenticated using (true) with check (true);

create policy "authenticated users can manage rendition transfers"
  on public.rendition_transfers for all to authenticated using (true) with check (true);
