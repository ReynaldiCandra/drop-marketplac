-- ============================================================================
-- Fase 2 (lanjutan): kolom unit di variants, notes di products
--
-- Keputusan yang berlaku di migration ini:
-- 1. Tidak semua produk dijual per pcs (kain/vinyl per m2, produk pipa/besi
--    per btg) -- `unit` dipakai buat label di Form Order dan CRUD Produk &
--    Varian, bukan buat konversi harga apa pun.
-- 2. `notes` di products dipakai buat spesifikasi bebas (ukuran, bahan, dll)
--    yang tidak butuh kolom terstruktur sendiri -- sesuai P3, field
--    terstruktur tambahan hanya kalau memang ada keputusan yang berubah
--    karenanya.
-- 3. Tidak ada data katalog yang ikut di-seed lewat migration ini -- hanya
--    perubahan kolom.
-- ============================================================================

create type product_unit as enum ('pcs', 'm2', 'btg', 'lainnya');

alter table variants
  add column unit product_unit not null default 'pcs';

alter table products
  add column notes text;
