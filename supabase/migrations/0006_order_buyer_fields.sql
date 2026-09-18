-- ============================================================================
-- Tambahan: data pembeli di orders (buyer_phone, buyer_region)
--
-- Keputusan (sesuai P3 — field baru bukan tabel baru):
-- 1. Ditambah langsung ke `orders`, bukan tabel `customers` terpisah.
--    Di dropship, satu pembeli jarang order berulang lewat sistem yang
--    sama (beda dari toko retail langganan) -- tabel master customer
--    dengan dedup logic cuma nambah kompleksitas tanpa manfaat nyata saat
--    ini. Kalau nanti ternyata banyak repeat buyer dan butuh riwayat per
--    orang, itu baru layak dipisah (bisa migrasi dari kolom ini).
-- 2. Semua nullable -- buyer_name sendiri sudah nullable sejak awal, dan
--    order Transfer/organik seringkali tidak butuh nomor WA dicatat
--    manual. Field ini pelengkap, bukan wajib, supaya tidak menghambat
--    kecepatan input per order.
-- ============================================================================

alter table orders
  add column buyer_phone text,
  add column buyer_region text;

comment on column orders.buyer_phone is 'Nomor WA pembeli, bebas format -- dipakai untuk follow-up COD, bukan validasi.';
comment on column orders.buyer_region is 'Kota/wilayah pembeli, teks bebas -- dipakai untuk lihat sebaran pasar, bukan alamat lengkap.';
