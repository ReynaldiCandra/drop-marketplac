'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Campaign iklan — satu campaign selalu milik satu toko (§ migration 0003).
// ---------------------------------------------------------------------------
const createCampaignSchema = z.object({
  storeId: z.string().uuid(),
  platform: z.enum(['meta_ads', 'google_ads', 'tiktok_ads', 'lainnya']),
  name: z.string().trim().min(1, 'Nama campaign wajib diisi.').max(120),
  campaignType: z.string().trim().max(60).optional().or(z.literal('')),
})

export async function createCampaign(raw: z.infer<typeof createCampaignSchema>) {
  const parsed = createCampaignSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('ad_campaigns').insert({
    store_id: input.storeId,
    platform: input.platform,
    name: input.name,
    campaign_type: input.campaignType || null,
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/biaya')
  revalidatePath('/pesanan') // campaign baru harus langsung muncul di dropdown Form Order
  return { ok: true as const }
}

const toggleCampaignSchema = z.object({
  campaignId: z.string().uuid(),
  isActive: z.boolean(),
})

export async function setCampaignActive(raw: z.infer<typeof toggleCampaignSchema>) {
  const parsed = toggleCampaignSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: 'Input tidak valid.' }
  }
  const supabase = await createClient()
  const { error } = await supabase
    .from('ad_campaigns')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.campaignId)

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/biaya')
  revalidatePath('/pesanan')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Ad spend harian — TIDAK dipakai untuk hitung profit bersih toko (§ migration
// 0002), murni untuk performa campaign (CPL/CPO/ROAS) di panel ini. Tidak ada
// unique constraint di tabelnya, jadi ini catatan log (bisa lebih dari satu
// entry per toko/tanggal/platform), bukan upsert seperti rekap harian.
// ---------------------------------------------------------------------------
const createAdSpendSchema = z.object({
  storeId: z.string().uuid(),
  campaignId: z.string().uuid().optional().or(z.literal('')),
  platform: z.enum(['meta_ads', 'google_ads', 'tiktok_ads', 'lainnya']),
  bizDate: z.string(),
  amount: z.coerce.number().int().min(0),
  leadsCount: z.coerce.number().int().min(0).default(0),
  notes: z.string().trim().max(200).optional().or(z.literal('')),
})

export async function createAdSpend(raw: z.infer<typeof createAdSpendSchema>) {
  const parsed = createAdSpendSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('ad_spend_daily').insert({
    store_id: input.storeId,
    campaign_id: input.campaignId || null,
    platform: input.platform,
    biz_date: input.bizDate,
    amount: input.amount,
    leads_count: input.leadsCount,
    notes: input.notes || null,
    created_by: user?.id ?? null,
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/biaya')
  return { ok: true as const }
}

export async function deleteAdSpend(id: string) {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false as const, error: 'ID tidak valid.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('ad_spend_daily').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/biaya')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Biaya operasional — bukan HPP, bukan ad spend. store_id null = biaya
// bersama, tidak dibebankan ke toko tertentu (§ migration 0002).
// ---------------------------------------------------------------------------
const createExpenseSchema = z.object({
  storeId: z.string().uuid().optional().or(z.literal('')),
  bizDate: z.string(),
  category: z.string().trim().min(1, 'Kategori wajib diisi.').max(60),
  amount: z.coerce.number().int().min(0),
  notes: z.string().trim().max(200).optional().or(z.literal('')),
})

export async function createExpense(raw: z.infer<typeof createExpenseSchema>) {
  const parsed = createExpenseSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('expenses').insert({
    store_id: input.storeId || null,
    biz_date: input.bizDate,
    category: input.category,
    amount: input.amount,
    notes: input.notes || null,
    created_by: user?.id ?? null,
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/biaya')
  return { ok: true as const }
}

export async function deleteExpense(id: string) {
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false as const, error: 'ID tidak valid.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/biaya')
  return { ok: true as const }
}
