-- ============================================================================
-- Fase 2: Profit Engine (revisi kesepakatan)
--
-- Keputusan yang berlaku di migration ini:
-- 1. Profit bersih per toko = omset - HPP saja. Ad spend TIDAK dipakai
--    sebagai acuan profit -- dipisah total ke menu Iklan (ad_spend_daily).
-- 2. HPP diinput manual per varian (dropship, harga dari supplier).
-- 3. Harga jual dihitung otomatis dari HPP + margin bersih yang diinginkan
--    + fee marketplace toko itu (lihat lib/calc/pricing.ts).
-- 4. Margin berbeda-beda per produk (bukan rata per toko) -> profit harian
--    akurat butuh data per order (lihat migration 0003, tabel `orders`),
--    bukan cuma qty per SKU per hari.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Target margin per listing (beda toko = beda fee, jadi target margin
--    disimpan di store_listings, bukan di variants -- harga jual bisa beda
--    per toko walau HPP produknya sama).
-- ---------------------------------------------------------------------------
create type margin_type as enum ('percent', 'nominal');

alter table store_listings
  add column target_margin_type margin_type not null default 'nominal',
  add column target_margin_value bigint not null default 0;

comment on column store_listings.target_margin_value is
  'Kalau target_margin_type = nominal: rupiah bersih per pcs yang diinginkan setelah dipotong fee marketplace dan HPP. Kalau percent: persen dari harga jual (0-100).';

-- ---------------------------------------------------------------------------
-- 2. Ad spend harian -- menu Iklan terpisah, TIDAK dipakai untuk hitung
--    profit bersih. Bisa difilter per toko. Full CRUD manual dari UI.
-- ---------------------------------------------------------------------------
create type ad_platform as enum ('meta_ads', 'google_ads', 'tiktok_ads', 'lainnya');

create table ad_spend_daily (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  biz_date date not null,
  platform ad_platform not null,
  amount bigint not null default 0,
  notes text,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on ad_spend_daily (store_id, biz_date desc);
create index on ad_spend_daily (biz_date desc);

-- ---------------------------------------------------------------------------
-- 3. Biaya operasional (bukan HPP, bukan ad spend) -- gaji admin, kemasan,
--    langganan tools, dll. Boleh terikat ke satu toko atau umum (store_id
--    null = biaya bersama, tidak dibebankan ke toko tertentu).
-- ---------------------------------------------------------------------------
create table expenses (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references stores on delete set null, -- null = biaya umum
  biz_date date not null,
  category text not null,
  amount bigint not null default 0,
  notes text,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on expenses (biz_date desc);
create index on expenses (store_id, biz_date desc);

-- ---------------------------------------------------------------------------
-- 4. RLS -- ikut pola Fase 1: single-role, owner_all, aktif di semua tabel
--    baru tanpa kecuali (prinsip §8 MD tetap berlaku).
-- ---------------------------------------------------------------------------
alter table ad_spend_daily enable row level security;
create policy owner_all on ad_spend_daily for all using (is_owner()) with check (is_owner());

alter table expenses enable row level security;
create policy owner_all on expenses for all using (is_owner()) with check (is_owner());
