# Setup — Fase 0 & Fase 1

Status: skema + auth + Input Harian + Dashboard (omzet & status input) sudah jadi
dan **sudah dicoba `npm run build` sampai sukses**. Yang belum: RLS multi-role,
Toko/Produk/Supplier CRUD, Biaya & Iklan, Live Selling, Klien, Kanban, Laporan —
semua itu sengaja ditunda ke fase berikutnya (lihat bagian "Belum dikerjakan"
di bawah), sesuai kesepakatan supaya tidak membangun semuanya sekaligus untuk
kebutuhan satu orang.

## 1. Buat project Supabase

1. https://supabase.com/dashboard → **New project**.
2. Simpan **database password** yang kamu buat di sini (dibutuhkan lagi kalau
   nanti pakai Supabase CLI).
3. Tunggu sampai project selesai provisioning (~2 menit).
4. Buka **Project Settings → API**. Salin:
   - `Project URL` → jadi `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → jadi `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Jalankan migration & seed

1. Buka **SQL Editor** di dashboard Supabase.
2. Copy-paste seluruh isi `supabase/migrations/0001_fase1_init.sql`, klik **Run**.
3. Ulangi untuk `0002` sampai `0007` **berurutan** — jangan dilompat, beberapa
   migration mengubah kolom yang dibuat migration sebelumnya.
4. Copy-paste seluruh isi `supabase/seed.sql`, klik **Run**.
4. Cek di **Table Editor** — harus ada 5 baris di `brands` dan 7 baris di `stores`.
5. Cek di **Authentication → Policies** — semua tabel harus muncul badge
   "RLS enabled". Kalau ada yang belum, migration belum jalan sempurna —
   ulangi langkah 2.

## 3. Buat akun ownermu

1. **Authentication → Users → Add user** (bukan lewat halaman signup — proyek
   ini memang tidak punya halaman daftar sendiri, owner dibuat manual).
2. Isi email + password.
3. Cek di **Table Editor → profiles** — harus otomatis muncul 1 baris dengan
   `role = 'owner'` (dibuat oleh trigger `on_auth_user_created`). Kalau tidak
   muncul, cek Logs → Postgres Logs untuk error trigger.

## 4. Jalankan lokal

```bash
cp .env.local.example .env.local
# lalu isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY

npm install
npm run dev
```

Buka `http://localhost:3000` → otomatis redirect ke `/login` → masuk pakai
akun dari langkah 3 → harus landing di `/dashboard` dengan 7 toko kosong
(status "Belum diisi" semua, karena belum ada rekap).

Coba buka **Input Harian**, isi satu baris, klik di luar field (blur) —
harus muncul indikator centang hijau sebentar, dan status baris berubah.
Refresh halaman — angka harus tetap ada (berarti tersimpan ke Supabase,
bukan cuma state React).

## 5. Deploy ke Vercel

1. Push folder ini ke repo GitHub baru.
2. Import repo di Vercel.
3. Di **Environment Variables**, isi `NEXT_PUBLIC_SUPABASE_URL` dan
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` yang sama dengan `.env.local`.
4. Deploy.

Catatan: build sempat gagal di sandbox saya karena Google Fonts
(`fonts.googleapis.com`) diblokir jaringan sandbox — itu murni batasan
lingkungan saya, bukan bug kode. Vercel punya akses internet penuh saat
build jadi seharusnya jalan normal. Kalau ternyata tetap gagal di Vercel
karena font, kabari saya — ada opsi pindah ke `next/font/local`.

## Konsep penting: mode pencatatan per toko

Sejak migration `0007`, tiap toko punya `tracking_mode` yang menentukan dari
mana angka omzetnya diambil. **Satu toko hanya punya satu sumber** — ini yang
mencegah omzet terhitung dua kali:

| Mode | Diinput di | Profit? | Cocok untuk |
|---|---|---|---|
| `rekap_harian` (default) | Menu **Input Harian** | Tidak (rekap tidak simpan HPP) | Shopee/Lazada/TikTok volume tinggi |
| `per_order` | Menu **Pesanan** | Ya | Closing iklan Meta, DM, reseller |

Toko mode `rekap_harian` tidak akan muncul di Form Order, dan sebaliknya.
Ubah modenya di menu **Pengaturan**.

Live Selling tidak terpengaruh mode ini — `live_sessions` mencatat performa
host (penonton, unit terjual, fee), bukan omzet toko, jadi tidak ada risiko
dobel hitung di sana.

## Demo / white-label

Menu **Pengaturan** bisa mengubah nama aplikasi, tagline, inisial logo, warna
brand, dan modul mana yang tampil di sidebar — semuanya tanpa menyentuh kode.
Dipakai saat mendemokan dashboard ke calon klien dengan brand mereka sendiri.
Mematikan modul hanya menyembunyikan dari sidebar; datanya tidak dihapus dan
halamannya masih bisa dibuka lewat URL langsung (bukan fitur keamanan).

## Belum dikerjakan (sengaja, sesuai prioritas yang kita sepakati)

- **RLS multi-role (host/staff)** — semua tabel masih 1 policy `owner_all`.
  Baru ditulis saat host beneran mau onboard (target: sebelum Desember).
- **Klien Freelance, Rencana Kerja, Laporan** — nav item sudah ada di sidebar
  tapi ditandai "segera" (non-klik). Toko & Produk, Biaya & Iklan, Live
  Selling, Skor Produk, dan Pengaturan sudah jadi.
- **Ad spend belum bisa diatribusikan ke produk tertentu** — `ad_spend_daily`
  terikat ke toko/campaign, bukan ke varian. Jadi kolom "dari iklan" di Skor
  Produk menunjukkan *porsi order yang berasal dari campaign*, bukan biaya
  iklan per produk. Butuh itu? Campaign perlu dipersempit ke satu produk.
- **Profit di Ringkasan hanya dari toko mode per-order** — toko rekap harian
  tidak menyimpan HPP, jadi kolom profitnya tampil "—", bukan nol.
- **Kolom `cancelled_count` / `returned_count`** ada di skema tapi belum
  ada input-nya di grid (hanya nilai rupiahnya) — supaya grid tidak
  kepanjangan dulu. Gampang ditambah kalau ternyata dibutuhkan.
- **`platform_fee`** ada di skema (dipakai nanti di profit engine Fase 2)
  tapi belum ada di form Input Harian.
- Input Harian versi mobile "satu toko per layar, swipe" (§10.2) belum
  dibuat — untuk sekarang tabelnya bisa discroll horizontal di HP.

## Struktur file baru yang perlu kamu tahu

```
app/(auth)/login/page.tsx        halaman login
app/(owner)/layout.tsx           cek sesi + render AppShell
app/(owner)/dashboard/page.tsx   ringkasan (data asli)
app/(owner)/input/page.tsx       input harian (data asli)
lib/supabase/                    client & server Supabase helper
lib/actions/recap.ts             server action simpan rekap harian
lib/queries.ts                   query data untuk Server Components
lib/store-labels.ts              util label channel (aman dipakai di client)
lib/format.ts                    format rupiah & tanggal Asia/Jakarta
components/layout/app-shell.tsx  sidebar + topbar + dark mode toggle
components/forms/daily-recap-row.tsx  satu baris form input harian
components/charts/revenue-trend-chart.tsx
supabase/migrations/0001_fase1_init.sql
supabase/seed.sql
middleware.ts                    proteksi route (redirect ke /login)
```
