-- ============================================================================
-- Fase 1: Ledger & Input — skema inti sesuai MASTER_DASHBOARD.md §7
-- Tabel live selling, klien freelance, kanban, settlement SENGAJA belum
-- dibuat di sini — itu masuk migration terpisah saat Fase 3/4/5 mulai
-- dikerjakan (lihat catatan "kerja sekarang" yang kita sepakati: jangan
-- bangun semua tabel sekaligus di depan).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 7.1 Identitas & Peran
-- ---------------------------------------------------------------------------
create type user_role as enum ('owner', 'host', 'staff');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  phone text,
  role user_role not null default 'owner', -- default owner: single-user dulu, RLS bertingkat baru Fase 3
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Auto-buat baris profiles saat ada user baru daftar lewat Supabase Auth.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'owner');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 7.2 Brand, Channel, Toko
-- ---------------------------------------------------------------------------
create type channel_code as enum ('shopee', 'lazada', 'tiktok', 'etsy', 'lainnya');

create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table stores (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references brands on delete restrict,
  channel channel_code not null,
  display_name text not null,
  store_url text,
  default_commission_pct numeric(5,2) not null default 0,
  default_service_fee_pct numeric(5,2) not null default 0,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (brand_id, channel, display_name)
);

-- ---------------------------------------------------------------------------
-- 7.3 Supplier & Produk
-- ---------------------------------------------------------------------------
create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  contact_person text,
  city text,
  platform text,
  payment_terms text,
  rating smallint check (rating between 1 and 5),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products on delete cascade,
  sku text not null unique,
  variant_name text not null,
  cost_price bigint not null default 0,
  weight_gram int,
  is_active boolean not null default true
);

create table product_suppliers (
  product_id uuid not null references products on delete cascade,
  supplier_id uuid not null references suppliers on delete restrict,
  cost_price bigint not null,
  is_primary boolean not null default false,
  last_order_date date,
  notes text,
  primary key (product_id, supplier_id)
);

create table store_listings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  variant_id uuid not null references variants on delete cascade,
  channel_sku text,
  listing_price bigint not null default 0,
  is_active boolean not null default true,
  unique (store_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- 7.4 Rekap Penjualan Harian — inti sistem (layar "Input Harian")
-- ---------------------------------------------------------------------------
create type entry_status as enum ('kosong', 'sebagian', 'lengkap');

create table daily_store_recap (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  biz_date date not null,
  gross_revenue bigint not null default 0,
  orders_count int not null default 0,
  units_count int not null default 0,
  cancelled_count int not null default 0,
  cancelled_value bigint not null default 0,
  returned_count int not null default 0,
  returned_value bigint not null default 0,
  shipping_borne bigint not null default 0,
  platform_fee bigint not null default 0,
  voucher_cost bigint not null default 0,
  status entry_status not null default 'kosong',
  notes text,
  created_by uuid references profiles,
  updated_at timestamptz not null default now(),
  unique (store_id, biz_date)
);

create table daily_sku_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  variant_id uuid not null references variants on delete restrict,
  biz_date date not null,
  qty int not null default 0,
  gross_revenue bigint not null default 0,
  cost_price_snapshot bigint not null,
  unique (store_id, variant_id, biz_date)
);

-- ---------------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------------
create index on daily_store_recap (biz_date desc, store_id);
create index on daily_sku_sales (biz_date desc, store_id);
create index on daily_sku_sales (variant_id, biz_date desc);

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
--
-- CATATAN PENTING (sesuai kesepakatan kita): ini RLS single-role.
-- Semua tabel aktif RLS (wajib, tidak ada pengecualian — prinsip §8 MD),
-- tapi policy-nya baru "authenticated user = owner, akses penuh".
-- Policy untuk peran host/staff BELUM dibuat di sini — itu ditambahkan
-- nanti pas Fase 3 (Live Selling) benar-benar mulai, supaya kita tidak
-- membangun & menguji security boundary untuk user yang belum ada.
-- ---------------------------------------------------------------------------

create or replace function auth_role() returns user_role
language sql stable security definer as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function is_owner() returns boolean
language sql stable security definer as $$
  select coalesce(auth_role() = 'owner', false)
$$;

alter table profiles enable row level security;
create policy owner_all on profiles for all using (is_owner()) with check (is_owner());
-- Semua orang boleh baca profilnya sendiri (dibutuhkan buat tampilkan nama di topbar)
create policy read_own_profile on profiles for select using (id = auth.uid());

alter table brands enable row level security;
create policy owner_all on brands for all using (is_owner()) with check (is_owner());

alter table stores enable row level security;
create policy owner_all on stores for all using (is_owner()) with check (is_owner());

alter table suppliers enable row level security;
create policy owner_all on suppliers for all using (is_owner()) with check (is_owner());

alter table products enable row level security;
create policy owner_all on products for all using (is_owner()) with check (is_owner());

alter table variants enable row level security;
create policy owner_all on variants for all using (is_owner()) with check (is_owner());

alter table product_suppliers enable row level security;
create policy owner_all on product_suppliers for all using (is_owner()) with check (is_owner());

alter table store_listings enable row level security;
create policy owner_all on store_listings for all using (is_owner()) with check (is_owner());

alter table daily_store_recap enable row level security;
create policy owner_all on daily_store_recap for all using (is_owner()) with check (is_owner());

alter table daily_sku_sales enable row level security;
create policy owner_all on daily_sku_sales for all using (is_owner()) with check (is_owner());
