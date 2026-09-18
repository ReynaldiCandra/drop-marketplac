-- ============================================================================
-- Live Selling — input manual (bukan modul host terpisah)
--
-- Keputusan yang berlaku di migration ini (revisi dari rencana Fase 3 di MD):
-- 1. Host TIDAK login ke sistem. Owner input datanya sendiri secara manual,
--    jadi tidak perlu role `host`, tidak perlu layout/route group terpisah,
--    tidak perlu RLS bertingkat untuk tabel ini -- policy-nya sama seperti
--    tabel lain (owner_all).
-- 2. Nama host cukup teks bebas -- tidak ada tabel `hosts` tersendiri, tidak
--    ada validasi terhadap daftar host baku. Kalau nanti butuh rekap
--    performa per host, itu tinggal GROUP BY host_name.
-- 3. Produk yang dipromosikan WAJIB merujuk ke variant yang sudah ada di
--    katalog (bukan teks bebas) -- ini supaya HPP & harga jual saat itu bisa
--    dilihat balik lewat variant_id, dan konsisten dengan pola order/listing
--    yang sudah ada.
-- ============================================================================

create table live_sessions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores on delete restrict, -- dari toko marketplace mana
  variant_id uuid not null references variants on delete restrict, -- nama produk yang dipromosikan
  host_name text not null,
  session_date date not null,
  duration_minutes int not null default 0, -- lama jam live
  units_sold int not null default 0, -- jumlah produk terjual
  add_to_cart_count int not null default 0, -- produk ditambah keranjang
  viewers_count int not null default 0, -- jumlah penonton
  notes text,
  created_by uuid references profiles,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on live_sessions (session_date desc);
create index on live_sessions (store_id, session_date desc);
create index on live_sessions (host_name);

alter table live_sessions enable row level security;
create policy owner_all on live_sessions for all using (is_owner()) with check (is_owner());
