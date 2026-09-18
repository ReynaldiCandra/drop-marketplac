'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  variantId: z.string().uuid(),
  campaignId: z.string().uuid().optional().or(z.literal('')),
  orderDate: z.string(), // YYYY-MM-DD
  qty: z.coerce.number().int().min(1),
  paymentMethod: z.enum(['cod', 'transfer']),
  // Data pembeli -- semua opsional, tidak menghambat input cepat order Transfer.
  buyerName: z.string().trim().max(120).optional().or(z.literal('')),
  buyerPhone: z.string().trim().max(30).optional().or(z.literal('')),
  buyerRegion: z.string().trim().max(80).optional().or(z.literal('')),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>

// Harga jual & HPP TIDAK dikirim dari form — diambil ulang dari server
// (store_listings + variants) supaya tidak bisa dimanipulasi dari client,
// dan snapshot-nya (cost_price_snapshot) memang harus akurat per saat order
// terjadi (§7 migration 0003).
export async function createOrder(raw: CreateOrderInput) {
  const parsed = createOrderSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.flatten().fieldErrors }
  }
  const input = parsed.data
  const supabase = await createClient()

  const { data: listing, error: listingError } = await supabase
    .from('store_listings')
    .select('listing_price, variant:variants!inner(cost_price)')
    .eq('store_id', input.storeId)
    .eq('variant_id', input.variantId)
    .eq('is_active', true)
    .maybeSingle()

  if (listingError || !listing) {
    return { ok: false as const, error: 'SKU ini belum ada listing aktif di toko tersebut.' }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('orders').insert({
    store_id: input.storeId,
    variant_id: input.variantId,
    campaign_id: input.campaignId || null,
    order_date: input.orderDate,
    qty: input.qty,
    unit_price: listing.listing_price,
    cost_price_snapshot: (listing.variant as any).cost_price,
    payment_method: input.paymentMethod,
    status: 'proses',
    buyer_name: input.buyerName || null,
    buyer_phone: input.buyerPhone || null,
    buyer_region: input.buyerRegion || null,
    created_by: user?.id ?? null,
  })

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/pesanan')
  revalidatePath('/dashboard')
  return { ok: true as const }
}

const updateStatusSchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(['terkirim', 'cancel', 'retur']),
})

// Update status di baris yang sama (bukan input ulang) — order yang sudah
// dicatat "proses" hanya berubah status begitu hasilnya diketahui, supaya
// tidak dobel hitung (§ catatan migration 0003).
export async function updateOrderStatus(raw: z.infer<typeof updateStatusSchema>) {
  const parsed = updateStatusSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: 'Input tidak valid.' }
  }
  const { orderId, status } = parsed.data
  const supabase = await createClient()

  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'proses') // jaga-jaga: cuma order yang masih "proses" yang boleh diubah dari sini

  if (error) {
    return { ok: false as const, error: error.message }
  }

  revalidatePath('/pesanan')
  return { ok: true as const }
}
