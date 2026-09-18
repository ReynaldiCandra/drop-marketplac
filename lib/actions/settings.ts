'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Pengaturan tampilan — white-label untuk demo ke calon klien.
// Satu baris saja (id = 1), jadi selalu update, tidak pernah insert.
// ---------------------------------------------------------------------------
const settingsSchema = z.object({
  appName: z.string().trim().min(1, 'Nama aplikasi wajib diisi.').max(60),
  appTagline: z.string().trim().max(60),
  brandInitial: z.string().trim().min(1).max(2),
  // Divalidasi ketat: nilai ini disuntikkan sebagai CSS custom property di
  // layout, jadi string bebas tidak boleh lolos ke sana.
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus format hex, contoh #2f6d5b.'),
  showInput: z.boolean(),
  showPesanan: z.boolean(),
  showToko: z.boolean(),
  showBiaya: z.boolean(),
  showLive: z.boolean(),
  showProduk: z.boolean(),
})

export async function updateAppSettings(raw: z.infer<typeof settingsSchema>) {
  const parsed = settingsSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? 'Input tidak valid.' }
  }
  const s = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('app_settings')
    .update({
      app_name: s.appName,
      app_tagline: s.appTagline,
      brand_initial: s.brandInitial.toUpperCase(),
      brand_color: s.brandColor,
      show_input: s.showInput,
      show_pesanan: s.showPesanan,
      show_toko: s.showToko,
      show_biaya: s.showBiaya,
      show_live: s.showLive,
      show_produk: s.showProduk,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return { ok: false as const, error: error.message }

  // Sidebar dirender di layout, jadi seluruh route perlu di-refresh.
  revalidatePath('/', 'layout')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Mode pencatatan per toko. Ini pengaturan paling berdampak di aplikasi:
// menentukan toko muncul di Input Harian atau di Form Order (§ migration 0007).
// ---------------------------------------------------------------------------
const trackingModeSchema = z.object({
  storeId: z.string().uuid(),
  mode: z.enum(['rekap_harian', 'per_order']),
})

export async function updateStoreTrackingMode(raw: z.infer<typeof trackingModeSchema>) {
  const parsed = trackingModeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Input tidak valid.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('stores')
    .update({ tracking_mode: parsed.data.mode })
    .eq('id', parsed.data.storeId)

  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/pengaturan')
  revalidatePath('/dashboard')
  revalidatePath('/input')
  revalidatePath('/pesanan')
  return { ok: true as const }
}
