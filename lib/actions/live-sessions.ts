'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const liveSessionSchema = z.object({
  storeId: z.string().uuid(),
  variantId: z.string().uuid(),
  hostName: z.string().trim().min(1, 'Nama host wajib diisi'),
  sessionDate: z.string(), // YYYY-MM-DD
  durationMinutes: z.coerce.number().int().min(0).default(0),
  unitsSold: z.coerce.number().int().min(0).default(0),
  addToCartCount: z.coerce.number().int().min(0).default(0),
  viewersCount: z.coerce.number().int().min(0).default(0),
  // Fee yang dibayar ke host untuk sesi ini -- dipakai menghitung fee per unit
  // di panel performa host (§ migration 0007).
  hostFee: z.coerce.number().int().min(0).default(0),
})

export type LiveSessionInput = z.infer<typeof liveSessionSchema>

export async function createLiveSession(raw: LiveSessionInput) {
  const parsed = liveSessionSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('live_sessions').insert({
    store_id: input.storeId,
    variant_id: input.variantId,
    host_name: input.hostName,
    session_date: input.sessionDate,
    duration_minutes: input.durationMinutes,
    units_sold: input.unitsSold,
    add_to_cart_count: input.addToCartCount,
    viewers_count: input.viewersCount,
    host_fee: input.hostFee,
    created_by: user?.id ?? null,
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/live')
  return { ok: true as const }
}
