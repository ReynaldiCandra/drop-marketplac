-- ============================================================================
-- 0007: (1) Sumber angka omzet dibuat tunggal per toko, (2) dashboard bisa
--       di-white-label untuk demo/jual, (3) biaya host live dicatat.
--
-- Keputusan yang berlaku di migration ini:
--
-- 1. MASALAH DOBEL HITUNG. Sampai sebelum ini ada dua sumber omzet yang
--    jalan bersamaan: `daily_store_recap` (rekap manual harian per toko) dan
--    `orders` (per transaksi). Kalau owner mengisi dua-duanya untuk toko yang
--    sama, dashboard menjumlahkan keduanya -> omzet ganda.
--
--    Solusi: `stores.tracking_mode`. Satu toko hanya boleh punya SATU cara
--    pencatatan. Ini diselesaikan di level skema, bukan di level "hati-hati
--    jangan diisi dua-duanya", supaya tidak mungkin salah:
--      - 'rekap_harian' -> toko muncul di menu Input Harian, TIDAK muncul di
--        Form Order. Cocok untuk marketplace bervolume tinggi (Shopee/Lazada)
--        yang angkanya ditarik dari laporan platform sekali sehari.
--      - 'per_order'    -> toko muncul di Form Order, TIDAK muncul di Input
--        Harian. Cocok untuk closing dari iklan Meta / DM / reseller, di mana
--        tiap order perlu diketahui campaign asal, metode bayar, dan status
--        kirimnya satu per satu.
--
--    Default 'rekap_harian' -> semua toko lama perilakunya tidak berubah,
--    tidak ada data historis yang jadi salah hitung.
--
-- 2. WHITE-LABEL. `app_settings` satu baris (id selalu 1). Dipakai untuk demo
--    ke calon klien (owner konveksi) tanpa perlu ubah kode: nama aplikasi,
--    inisial logo, warna brand, dan modul mana yang tampil di sidebar.
--    Sengaja kolom terstruktur, bukan jsonb bebas -- jumlah modulnya sedikit
--    dan tetap, jadi jsonb cuma bikin query & validasi lebih ribet tanpa
--    manfaat (P3).
--
-- 3. BIAYA HOST LIVE. `live_sessions.host_fee` -- fee yang dibayar ke host
--    untuk sesi itu (flat/per jam sudah dihitung owner di luar). Tanpa ini,
--    profit dari live tidak bisa dihitung: unit terjual x margin belum
--    dikurangi ongkos host. Biaya beli SAMPEL ke supplier TIDAK ditaruh di
--    sini -- itu masuk `expenses` dengan kategori bebas (mis. "sampel"),
--    karena sampel dibeli sekali per produk, bukan per sesi live.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Mode pencatatan per toko
-- ---------------------------------------------------------------------------
create type tracking_mode as enum ('rekap_harian', 'per_order');

alter table stores
  add column tracking_mode tracking_mode not null default 'rekap_harian';

comment on column stores.tracking_mode is
  'Sumber angka omzet untuk toko ini. rekap_harian = dari daily_store_recap (menu Input Harian). per_order = dari orders (menu Pesanan). Tidak pernah dua-duanya -- ini yang mencegah dobel hitung di Dashboard.';

-- ---------------------------------------------------------------------------
-- 2. Pengaturan tampilan (white-label untuk demo/jual)
-- ---------------------------------------------------------------------------
create table app_settings (
  id int primary key default 1 check (id = 1), -- kunci: tabel ini selalu tepat 1 baris
  app_name text not null default 'Websensial',
  app_tagline text not null default 'Operational OS',
  brand_initial text not null default 'W',
  brand_color text not null default '#2f6d5b',
  -- Modul yang tampil di sidebar. Dashboard & Pengaturan selalu tampil,
  -- jadi tidak perlu toggle-nya.
  show_input boolean not null default true,
  show_pesanan boolean not null default true,
  show_toko boolean not null default true,
  show_biaya boolean not null default true,
  show_live boolean not null default true,
  show_produk boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into app_settings (id) values (1) on conflict (id) do nothing;

alter table app_settings enable row level security;
create policy owner_all on app_settings for all using (is_owner()) with check (is_owner());

-- ---------------------------------------------------------------------------
-- 3. Fee host per sesi live
-- ---------------------------------------------------------------------------
alter table live_sessions
  add column host_fee bigint not null default 0;

comment on column live_sessions.host_fee is
  'Rupiah yang dibayar ke host untuk sesi ini. Dipakai menghitung profit live (margin unit terjual - fee host). Biaya sampel supplier tidak di sini -- pakai expenses.';
