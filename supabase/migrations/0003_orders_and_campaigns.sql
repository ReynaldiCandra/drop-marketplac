-- ============================================================================
-- Fase 2 (lanjutan): Order per transaksi + Campaign Iklan
--
-- Keputusan yang berlaku di migration ini:
-- 1. `daily_sku_sales` (dari migration 0001) DIHAPUS -- belum pernah dipakai
--    di kode manapun, dan digantikan `orders` yang lebih tepat: metode
--    bayar (COD/Transfer) dan status kirim (proses/terkirim/cancel/retur)
--    adalah atribut per-order, bukan angka agregat harian -- COD baru
--    ketahuan hasilnya (terkirim/retur) beberapa hari setelah order masuk,
--    jadi statusnya perlu bisa DIUPDATE di baris yang sama, bukan dicatat
--    ulang sebagai entry baru (supaya tidak dobel hitung).
-- 2. Volume order rendah (<20/toko/hari) -> input manual per order wajar,
--    tidak perlu desain untuk bulk import dulu.
-- 3. Campaign iklan (khususnya Meta Ads) dilacak sebagai entitas sendiri,
--    supaya leads & closing bisa diatribusikan ke campaign yang tepat, dan
--    ROAS/ROI bisa dihitung baik per toko maupun per campaign.
-- ============================================================================

drop table if exists daily_sku_sales;

-- ---------------------------------------------------------------------------
-- 1. Campaign iklan -- satu campaign selalu milik satu toko (produk yang
--    dipromosikan spesifik ke toko itu), platform bisa macam-macam.
-- ---------------------------------------------------------------------------
create table ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete cascade,
  platform ad_platform not null,
  name text not null,
  campaign_type text, -- bebas isi: "leads", "konversi", "traffic", dst -- belum perlu dibakukan jadi enum
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index on ad_campaigns (store_id);

-- Ad spend harian sekarang bisa terikat ke campaign spesifik (leads_count
-- relevan di sini), atau tetap di level toko saja (campaign_id null) kalau
-- belum dipecah per campaign.
alter table ad_spend_daily
  add column campaign_id uuid references ad_campaigns on delete set null,
  add column leads_count int not null default 0;

create index on ad_spend_daily (campaign_id, biz_date desc);

-- ---------------------------------------------------------------------------
-- 2. Order -- unit transaksi. Satu baris = satu order/closing untuk satu
--    varian produk. campaign_id null berarti closing organik (bukan dari
--    iklan yang dilacak, misal reseller/DM langsung).
-- ---------------------------------------------------------------------------
create type payment_method as enum ('cod', 'transfer');
create type order_status as enum ('proses', 'terkirim', 'cancel', 'retur');

create table orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete restrict,
  variant_id uuid not null references variants on delete restrict,
  campaign_id uuid references ad_campaigns on delete set null,
  order_date date not null,
  qty int not null default 1 check (qty > 0),
  unit_price bigint not null, -- harga jual per pcs saat order ini terjadi
  cost_price_snapshot bigint not null, -- HPP per pcs saat order ini terjadi (HPP produk bisa berubah nanti, angka historis harus tetap)
  payment_method payment_method not null,
  status order_status not null default 'proses',
  buyer_name text,
  notes text,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on orders (store_id, order_date desc);
create index on orders (variant_id, order_date desc);
create index on orders (campaign_id) where campaign_id is not null;
create index on orders (status);

-- ---------------------------------------------------------------------------
-- 3. RLS -- pola sama seperti tabel lain: single-role, owner_all.
-- ---------------------------------------------------------------------------
alter table ad_campaigns enable row level security;
create policy owner_all on ad_campaigns for all using (is_owner()) with check (is_owner());

alter table orders enable row level security;
create policy owner_all on orders for all using (is_owner()) with check (is_owner());
