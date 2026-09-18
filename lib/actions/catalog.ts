'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Supplier
// ---------------------------------------------------------------------------
const createSupplierSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  city: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
})

export async function createSupplier(raw: z.infer<typeof createSupplierSchema>) {
  const parsed = createSupplierSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: 'Nama dan nomor WA supplier wajib diisi.' }
  }
  const input = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('suppliers').insert({
    name: input.name,
    phone: input.phone,
    city: input.city || null,
    notes: input.notes || null,
  })

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/toko')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Produk + varian pertama (produk tanpa varian tidak bisa dijual, jadi
// selalu dibuat sekaligus — bukan dua langkah terpisah).
// ---------------------------------------------------------------------------
const createProductSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
  sku: z.string().min(1),
  variantName: z.string().min(1),
  costPrice: z.coerce.number().int().min(0),
  unit: z.enum(['pcs', 'm2', 'btg', 'lainnya']),
  supplierId: z.string().uuid().optional().or(z.literal('')),
})

export async function createProductWithVariant(raw: z.infer<typeof createProductSchema>) {
  const parsed = createProductSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: 'Lengkapi nama produk, SKU, nama varian, dan HPP.' }
  }
  const input = parsed.data
  const supabase = await createClient()

  const { data: product, error: productError } = await supabase
    .from('products')
    .insert({ name: input.name, category: input.category || null, notes: input.notes || null })
    .select('id')
    .single()

  if (productError || !product) {
    return { ok: false as const, error: productError?.message ?? 'Gagal menyimpan produk.' }
  }

  const { error: variantError } = await supabase.from('variants').insert({
    product_id: product.id,
    sku: input.sku,
    variant_name: input.variantName,
    cost_price: input.costPrice,
    unit: input.unit,
  })

  if (variantError) {
    // SKU biasanya yang bentrok (unique) — pesan lebih jelas dari error mentah Postgres.
    const message = variantError.message.includes('duplicate')
      ? `SKU "${input.sku}" sudah dipakai varian lain. Pakai SKU berbeda.`
      : variantError.message
    return { ok: false as const, error: message }
  }

  if (input.supplierId) {
    await supabase.from('product_suppliers').insert({
      product_id: product.id,
      supplier_id: input.supplierId,
      cost_price: input.costPrice,
      is_primary: true,
    })
  }

  revalidatePath('/toko')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Tambah varian ke produk yang sudah ada
// ---------------------------------------------------------------------------
const addVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1),
  variantName: z.string().min(1),
  costPrice: z.coerce.number().int().min(0),
  unit: z.enum(['pcs', 'm2', 'btg', 'lainnya']),
})

export async function addVariant(raw: z.infer<typeof addVariantSchema>) {
  const parsed = addVariantSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: 'Lengkapi SKU, nama varian, dan HPP.' }
  }
  const input = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('variants').insert({
    product_id: input.productId,
    sku: input.sku,
    variant_name: input.variantName,
    cost_price: input.costPrice,
    unit: input.unit,
  })

  if (error) {
    const message = error.message.includes('duplicate')
      ? `SKU "${input.sku}" sudah dipakai varian lain. Pakai SKU berbeda.`
      : error.message
    return { ok: false as const, error: message }
  }

  revalidatePath('/toko')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Aktif/nonaktifkan produk & varian (soft — tidak pernah hard delete, karena
// varian sudah bisa jadi rujukan order/live_sessions historis).
// ---------------------------------------------------------------------------
const toggleProductSchema = z.object({ productId: z.string().uuid(), isActive: z.boolean() })

export async function setProductActive(raw: z.infer<typeof toggleProductSchema>) {
  const parsed = toggleProductSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Input tidak valid.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('products')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.productId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/toko')
  return { ok: true as const }
}

const toggleVariantSchema = z.object({ variantId: z.string().uuid(), isActive: z.boolean() })

export async function setVariantActive(raw: z.infer<typeof toggleVariantSchema>) {
  const parsed = toggleVariantSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Input tidak valid.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('variants')
    .update({ is_active: parsed.data.isActive })
    .eq('id', parsed.data.variantId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/toko')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Listing toko: harga jual & target margin per (toko, varian). Ini yang
// dibaca Form Order & Live Selling lewat getOrderFormData().
// ---------------------------------------------------------------------------
const upsertListingSchema = z.object({
  storeId: z.string().uuid(),
  variantId: z.string().uuid(),
  listingPrice: z.coerce.number().int().min(1),
  marginType: z.enum(['percent', 'nominal']),
  marginValue: z.coerce.number().min(0),
})

export async function upsertListing(raw: z.infer<typeof upsertListingSchema>) {
  const parsed = upsertListingSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: 'Harga jual harus lebih dari 0.' }
  }
  const input = parsed.data
  const supabase = await createClient()

  const { error } = await supabase.from('store_listings').upsert(
    {
      store_id: input.storeId,
      variant_id: input.variantId,
      listing_price: input.listingPrice,
      target_margin_type: input.marginType,
      target_margin_value: input.marginValue,
      is_active: true,
    },
    { onConflict: 'store_id,variant_id' },
  )

  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/toko')
  revalidatePath('/pesanan')
  revalidatePath('/live')
  return { ok: true as const }
}

const setListingActiveSchema = z.object({
  storeId: z.string().uuid(),
  variantId: z.string().uuid(),
  isActive: z.boolean(),
})

export async function setListingActive(raw: z.infer<typeof setListingActiveSchema>) {
  const parsed = setListingActiveSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Input tidak valid.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('store_listings')
    .update({ is_active: parsed.data.isActive })
    .eq('store_id', parsed.data.storeId)
    .eq('variant_id', parsed.data.variantId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/toko')
  revalidatePath('/pesanan')
  revalidatePath('/live')
  return { ok: true as const }
}

// ---------------------------------------------------------------------------
// Fee marketplace per toko — dipakai kalkulator harga jual (lib/calc/pricing).
// ---------------------------------------------------------------------------
const updateStoreFeeSchema = z.object({
  storeId: z.string().uuid(),
  commissionPct: z.coerce.number().min(0).max(100),
  servicePct: z.coerce.number().min(0).max(100),
})

export async function updateStoreFee(raw: z.infer<typeof updateStoreFeeSchema>) {
  const parsed = updateStoreFeeSchema.safeParse(raw)
  if (!parsed.success) return { ok: false as const, error: 'Persen fee harus 0–100.' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('stores')
    .update({
      default_commission_pct: parsed.data.commissionPct,
      default_service_fee_pct: parsed.data.servicePct,
    })
    .eq('id', parsed.data.storeId)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath('/toko')
  return { ok: true as const }
}
