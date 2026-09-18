'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const recapSchema = z.object({
  storeId: z.string().uuid(),
  bizDate: z.string(), // format YYYY-MM-DD
  grossRevenue: z.coerce.number().int().min(0).default(0),
  ordersCount: z.coerce.number().int().min(0).default(0),
  unitsCount: z.coerce.number().int().min(0).default(0),
  cancelledCount: z.coerce.number().int().min(0).default(0),
  cancelledValue: z.coerce.number().int().min(0).default(0),
  returnedCount: z.coerce.number().int().min(0).default(0),
  returnedValue: z.coerce.number().int().min(0).default(0),
  shippingBorne: z.coerce.number().int().min(0).default(0),
  platformFee: z.coerce.number().int().min(0).default(0),
  voucherCost: z.coerce.number().int().min(0).default(0),
})

export type RecapInput = z.infer<typeof recapSchema>

// Tentukan status entry: 'kosong' kalau semua nol, 'lengkap' kalau omzet & order
// sudah diisi, selain itu 'sebagian'. Aturan ini sengaja sederhana dulu —
// bisa disesuaikan kalau ternyata tidak cocok dipakai.
function computeStatus(input: RecapInput): 'kosong' | 'sebagian' | 'lengkap' {
  const isEmpty = input.grossRevenue === 0 && input.ordersCount === 0
  if (isEmpty) return 'kosong'
  const hasCore = input.grossRevenue > 0 && input.ordersCount > 0 && input.unitsCount > 0
  return hasCore ? 'lengkap' : 'sebagian'
}

export async function saveDailyRecap(raw: RecapInput) {
  const parsed = recapSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const status = computeStatus(input)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('daily_store_recap').upsert(
    {
      store_id: input.storeId,
      biz_date: input.bizDate,
      gross_revenue: input.grossRevenue,
      orders_count: input.ordersCount,
      units_count: input.unitsCount,
      cancelled_count: input.cancelledCount,
      cancelled_value: input.cancelledValue,
      returned_count: input.returnedCount,
      returned_value: input.returnedValue,
      shipping_borne: input.shippingBorne,
      platform_fee: input.platformFee,
      voucher_cost: input.voucherCost,
      status,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'store_id,biz_date' },
  )

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/input')
  revalidatePath('/dashboard')
  return { ok: true as const, status }
}

// Dipakai tombol "Salin dari kemarin": ambil rekap toko itu di tanggal sebelumnya.
export async function getRecapForDate(storeId: string, bizDate: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_store_recap')
    .select('*')
    .eq('store_id', storeId)
    .eq('biz_date', bizDate)
    .maybeSingle()

  if (error) return null
  return data
}
