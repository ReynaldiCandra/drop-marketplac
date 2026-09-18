import { createClient } from '@/lib/supabase/server'
import type { DailyRecapRow } from '@/lib/store-labels'

export { channelLabel, channelDot } from '@/lib/store-labels'
export type { DailyRecapRow } from '@/lib/store-labels'

// ---------------------------------------------------------------------------
// ATURAN OMZET (berlaku di seluruh file ini, § migration 0007)
//
// Satu toko hanya punya SATU sumber angka, ditentukan `stores.tracking_mode`:
//   - 'rekap_harian' -> daily_store_recap. Omzet bersih = gross - cancelled
//     - returned. Profit TIDAK bisa dihitung (rekap tidak menyimpan HPP).
//   - 'per_order'    -> orders. Omzet bersih = sum(unit_price * qty) HANYA
//     yang berstatus 'terkirim'. Profit bisa dihitung, karena tiap order
//     menyimpan cost_price_snapshot.
//
// Dua sumber ini TIDAK PERNAH dijumlahkan untuk toko yang sama. Itulah yang
// mencegah dobel hitung.
//
// Kenapa hanya 'terkirim' yang dihitung omzet: order 'proses' belum tentu
// jadi uang (COD bisa retur). Angkanya tetap ditampilkan terpisah sebagai
// "pending", bukan dicampur ke omzet.
// ---------------------------------------------------------------------------

export type StoreWithRecap = {
  id: string
  display_name: string
  channel: string
  tracking_mode: 'rekap_harian' | 'per_order'
  net_revenue: number
  profit: number | null // null = toko mode rekap_harian, HPP tidak tersedia
  pending_revenue: number // order 'proses' yang belum diakui jadi omzet
  status: 'kosong' | 'sebagian' | 'lengkap'
}

export async function getStoresWithRecapForDate(bizDate: string): Promise<StoreWithRecap[]> {
  const supabase = await createClient()

  const [{ data: stores }, { data: recaps }, { data: orders }] = await Promise.all([
    supabase
      .from('stores')
      .select('id, display_name, channel, tracking_mode')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('daily_store_recap')
      .select('store_id, gross_revenue, cancelled_value, returned_value, status')
      .eq('biz_date', bizDate),
    supabase
      .from('orders')
      .select('store_id, qty, unit_price, cost_price_snapshot, status')
      .eq('order_date', bizDate),
  ])

  const recapByStore = new Map((recaps ?? []).map((r) => [r.store_id, r]))

  const orderAgg = new Map<string, { net: number; profit: number; pending: number; count: number }>()
  for (const o of (orders ?? []) as any[]) {
    const agg = orderAgg.get(o.store_id) ?? { net: 0, profit: 0, pending: 0, count: 0 }
    agg.count += 1
    if (o.status === 'terkirim') {
      agg.net += o.unit_price * o.qty
      agg.profit += (o.unit_price - o.cost_price_snapshot) * o.qty
    } else if (o.status === 'proses') {
      agg.pending += o.unit_price * o.qty
    }
    orderAgg.set(o.store_id, agg)
  }

  return (stores ?? []).map((store: any) => {
    if (store.tracking_mode === 'per_order') {
      const agg = orderAgg.get(store.id)
      return {
        id: store.id,
        display_name: store.display_name,
        channel: store.channel,
        tracking_mode: 'per_order' as const,
        net_revenue: agg?.net ?? 0,
        profit: agg?.profit ?? 0,
        pending_revenue: agg?.pending ?? 0,
        // Toko per-order tidak punya konsep "rekap lengkap" -- yang relevan
        // cuma: hari ini sudah ada order tercatat atau belum.
        status: (agg?.count ?? 0) > 0 ? ('lengkap' as const) : ('kosong' as const),
      }
    }

    const recap = recapByStore.get(store.id)
    return {
      id: store.id,
      display_name: store.display_name,
      channel: store.channel,
      tracking_mode: 'rekap_harian' as const,
      net_revenue: recap ? recap.gross_revenue - recap.cancelled_value - recap.returned_value : 0,
      profit: null,
      pending_revenue: 0,
      status: (recap?.status as StoreWithRecap['status']) ?? 'kosong',
    }
  })
}

// Helper: id toko per mode, dipakai semua agregat rentang tanggal di bawah.
async function getStoreIdsByMode() {
  const supabase = await createClient()
  const { data } = await supabase.from('stores').select('id, tracking_mode').eq('is_active', true)
  const recapIds: string[] = []
  const orderIds: string[] = []
  for (const s of (data ?? []) as any[]) {
    ;(s.tracking_mode === 'per_order' ? orderIds : recapIds).push(s.id)
  }
  return { recapIds, orderIds }
}

// Total omzet bersih rentang tanggal — gabungan dua mode, tanpa tumpang tindih
// karena tiap toko hanya masuk salah satu daftar id.
export async function getNetRevenueTotal(startDate: string, endDate: string) {
  const supabase = await createClient()
  const { recapIds, orderIds } = await getStoreIdsByMode()

  let total = 0

  if (recapIds.length > 0) {
    const { data } = await supabase
      .from('daily_store_recap')
      .select('gross_revenue, cancelled_value, returned_value')
      .in('store_id', recapIds)
      .gte('biz_date', startDate)
      .lte('biz_date', endDate)
    total += (data ?? []).reduce(
      (sum, r) => sum + (r.gross_revenue - r.cancelled_value - r.returned_value),
      0,
    )
  }

  if (orderIds.length > 0) {
    const { data } = await supabase
      .from('orders')
      .select('qty, unit_price')
      .in('store_id', orderIds)
      .eq('status', 'terkirim')
      .gte('order_date', startDate)
      .lte('order_date', endDate)
    total += (data ?? []).reduce((sum, o) => sum + o.unit_price * o.qty, 0)
  }

  return total
}

// Tren omzet bersih harian gabungan semua toko, untuk grafik dashboard.
export async function getDailyNetRevenueTrend(startDate: string, endDate: string) {
  const supabase = await createClient()
  const { recapIds, orderIds } = await getStoreIdsByMode()
  const byDate = new Map<string, number>()

  if (recapIds.length > 0) {
    const { data } = await supabase
      .from('daily_store_recap')
      .select('biz_date, gross_revenue, cancelled_value, returned_value')
      .in('store_id', recapIds)
      .gte('biz_date', startDate)
      .lte('biz_date', endDate)
    for (const row of data ?? []) {
      const net = row.gross_revenue - row.cancelled_value - row.returned_value
      byDate.set(row.biz_date, (byDate.get(row.biz_date) ?? 0) + net)
    }
  }

  if (orderIds.length > 0) {
    const { data } = await supabase
      .from('orders')
      .select('order_date, qty, unit_price')
      .in('store_id', orderIds)
      .eq('status', 'terkirim')
      .gte('order_date', startDate)
      .lte('order_date', endDate)
    for (const row of (data ?? []) as any[]) {
      byDate.set(row.order_date, (byDate.get(row.order_date) ?? 0) + row.unit_price * row.qty)
    }
  }

  return byDate
}

export async function getRecapMapForDate(bizDate: string): Promise<Map<string, DailyRecapRow>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('daily_store_recap')
    .select(
      'store_id, gross_revenue, orders_count, units_count, cancelled_count, cancelled_value, returned_count, returned_value, shipping_borne, platform_fee, voucher_cost, status',
    )
    .eq('biz_date', bizDate)

  return new Map((data ?? []).map((row) => [row.store_id, row as DailyRecapRow]))
}

// HANYA toko mode 'rekap_harian'. Toko per-order sengaja tidak muncul di
// Input Harian supaya omzetnya tidak bisa dicatat dua kali (§ migration 0007).
export async function getActiveStoresForInput() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select('id, display_name, channel')
    .eq('is_active', true)
    .eq('tracking_mode', 'rekap_harian')
    .order('sort_order')
  return data ?? []
}

export type OrderFormListing = {
  variant_id: string
  sku: string
  variant_name: string
  product_name: string
  unit: string
  listing_price: number
  cost_price: number
}

export type OrderFormCampaign = {
  id: string
  name: string
  platform: string
}

export type OrderFormData = {
  stores: { id: string; display_name: string; channel: string }[]
  listingsByStore: Record<string, OrderFormListing[]>
  campaignsByStore: Record<string, OrderFormCampaign[]>
}

// Semua data yang dibutuhkan Form Order dimuat sekali di server dan difilter
// per toko di sisi client (bukan round-trip tiap ganti toko) — sesuai P1,
// input harus cepat.
//
// `onlyPerOrder` dipakai Form Order (/pesanan): hanya toko bermode 'per_order'
// yang boleh menerima input order, supaya tidak bentrok dengan Input Harian
// (§ migration 0007). Live Selling memanggilnya TANPA filter, karena sesi live
// bisa dijalankan untuk toko mana saja -- live_sessions mencatat performa host,
// bukan omzet toko, jadi tidak ada risiko dobel hitung di sana.
export async function getOrderFormData(onlyPerOrder = false): Promise<OrderFormData> {
  const supabase = await createClient()

  const storeQuery = supabase
    .from('stores')
    .select('id, display_name, channel')
    .eq('is_active', true)
    .order('sort_order')
  if (onlyPerOrder) storeQuery.eq('tracking_mode', 'per_order')

  const [{ data: stores }, { data: listings }, { data: campaigns }] = await Promise.all([
    storeQuery,
    supabase
      .from('store_listings')
      .select(
        'store_id, listing_price, variant:variants!inner(id, sku, variant_name, cost_price, unit, is_active, product:products!inner(name, is_active))',
      )
      .eq('is_active', true),
    supabase
      .from('ad_campaigns')
      .select('id, store_id, name, platform')
      .eq('is_active', true)
      .order('name'),
  ])

  const listingsByStore: Record<string, OrderFormListing[]> = {}
  for (const row of (listings ?? []) as any[]) {
    const variant = row.variant
    if (!variant?.is_active || !variant.product?.is_active) continue
    const list = (listingsByStore[row.store_id] ??= [])
    list.push({
      variant_id: variant.id,
      sku: variant.sku,
      variant_name: variant.variant_name,
      product_name: variant.product.name,
      unit: variant.unit,
      listing_price: row.listing_price,
      cost_price: variant.cost_price,
    })
  }

  const campaignsByStore: Record<string, OrderFormCampaign[]> = {}
  for (const c of campaigns ?? []) {
    const list = (campaignsByStore[c.store_id] ??= [])
    list.push({ id: c.id, name: c.name, platform: c.platform })
  }

  return { stores: stores ?? [], listingsByStore, campaignsByStore }
}

export type ProcessingOrder = {
  id: string
  store_id: string
  store_name: string
  channel: string
  order_date: string
  sku: string
  variant_name: string
  product_name: string
  unit: string
  qty: number
  unit_price: number
  payment_method: string
  campaign_name: string | null
  buyer_name: string | null
  buyer_phone: string | null
  buyer_region: string | null
}

// Order dengan status 'proses', dikelompokkan per toko di sisi caller —
// ini yang dilihat & diupdate di halaman "update status" (§10, urutan kerja).
export async function getProcessingOrders(): Promise<ProcessingOrder[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select(
      'id, store_id, order_date, qty, unit_price, payment_method, buyer_name, buyer_phone, buyer_region, store:stores!inner(display_name, channel), variant:variants!inner(sku, variant_name, unit, product:products!inner(name)), campaign:ad_campaigns(name)',
    )
    .eq('status', 'proses')
    .order('order_date', { ascending: false })

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    store_id: row.store_id,
    store_name: row.store.display_name,
    channel: row.store.channel,
    order_date: row.order_date,
    sku: row.variant.sku,
    variant_name: row.variant.variant_name,
    product_name: row.variant.product.name,
    unit: row.variant.unit,
    qty: row.qty,
    unit_price: row.unit_price,
    payment_method: row.payment_method,
    campaign_name: row.campaign?.name ?? null,
    buyer_name: row.buyer_name,
    buyer_phone: row.buyer_phone,
    buyer_region: row.buyer_region,
  }))
}

// ---------------------------------------------------------------------------
// Katalog: produk, varian, supplier, listing per toko, fee toko — dipakai
// halaman /toko (CRUD) dan sumber listing yang dibaca Form Order & Live
// Selling lewat getOrderFormData() di atas.
// ---------------------------------------------------------------------------
export type CatalogVariant = {
  id: string
  sku: string
  variant_name: string
  cost_price: number
  unit: string
  is_active: boolean
}

export type CatalogProduct = {
  id: string
  name: string
  category: string | null
  notes: string | null
  is_active: boolean
  variants: CatalogVariant[]
}

export type CatalogSupplier = {
  id: string
  name: string
  phone: string
  city: string | null
}

export type CatalogStore = {
  id: string
  display_name: string
  channel: string
  default_commission_pct: number
  default_service_fee_pct: number
}

export type StoreListingRow = {
  store_id: string
  variant_id: string
  listing_price: number
  target_margin_type: 'percent' | 'nominal'
  target_margin_value: number
  is_active: boolean
}

export type CatalogData = {
  products: CatalogProduct[]
  suppliers: CatalogSupplier[]
  stores: CatalogStore[]
  listings: StoreListingRow[]
}

export async function getCatalogData(): Promise<CatalogData> {
  const supabase = await createClient()

  const [{ data: products }, { data: variants }, { data: suppliers }, { data: stores }, { data: listings }] =
    await Promise.all([
      supabase.from('products').select('id, name, category, notes, is_active').order('name'),
      supabase
        .from('variants')
        .select('id, product_id, sku, variant_name, cost_price, unit, is_active')
        .order('variant_name'),
      supabase.from('suppliers').select('id, name, phone, city').eq('is_active', true).order('name'),
      supabase
        .from('stores')
        .select('id, display_name, channel, default_commission_pct, default_service_fee_pct')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('store_listings')
        .select('store_id, variant_id, listing_price, target_margin_type, target_margin_value, is_active'),
    ])

  const variantsByProduct = new Map<string, CatalogVariant[]>()
  for (const v of (variants ?? []) as any[]) {
    const list = variantsByProduct.get(v.product_id) ?? []
    list.push({
      id: v.id,
      sku: v.sku,
      variant_name: v.variant_name,
      cost_price: v.cost_price,
      unit: v.unit,
      is_active: v.is_active,
    })
    variantsByProduct.set(v.product_id, list)
  }

  const productList: CatalogProduct[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    notes: p.notes,
    is_active: p.is_active,
    variants: variantsByProduct.get(p.id) ?? [],
  }))

  return {
    products: productList,
    suppliers: suppliers ?? [],
    stores: stores ?? [],
    listings: (listings ?? []) as StoreListingRow[],
  }
}

export type LiveSession = {
  id: string
  store_id: string
  store_name: string
  channel: string
  sku: string
  product_name: string
  variant_name: string
  host_name: string
  session_date: string
  duration_minutes: number
  units_sold: number
  add_to_cart_count: number
  viewers_count: number
  host_fee: number
}

// Dipakai buat halaman Live Selling: form input pakai getOrderFormData()
// (sudah ada stores + listingsByStore, dipakai ulang supaya SKU picker-nya
// konsisten dengan Form Order), fungsi ini yang ambil daftar sesi tercatat.
export async function getLiveSessions(limit = 50): Promise<LiveSession[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('live_sessions')
    .select(
      'id, store_id, host_name, session_date, duration_minutes, units_sold, add_to_cart_count, viewers_count, host_fee, store:stores!inner(display_name, channel), variant:variants!inner(sku, variant_name, product:products!inner(name))',
    )
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  return ((data ?? []) as any[]).map((row) => ({
    id: row.id,
    store_id: row.store_id,
    store_name: row.store.display_name,
    channel: row.store.channel,
    sku: row.variant.sku,
    product_name: row.variant.product.name,
    variant_name: row.variant.variant_name,
    host_name: row.host_name,
    session_date: row.session_date,
    duration_minutes: row.duration_minutes,
    units_sold: row.units_sold,
    add_to_cart_count: row.add_to_cart_count,
    viewers_count: row.viewers_count,
    host_fee: row.host_fee ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Biaya & Iklan — performa campaign (CPL/CPO/ROAS), log ad spend, dan biaya
// operasional. Ad spend & expenses TIDAK dipakai untuk profit bersih toko di
// Dashboard (itu cuma omset - HPP, § migration 0002) -- panel ini murni untuk
// menilai efisiensi iklan per campaign, terpisah dari profit toko.
//
// Definisi metrik (biar konsisten di seluruh kode):
// - CPL (cost per lead)  = total spend / total leads
// - CPO (cost per order) = total spend / jumlah order yang lahir dari
//   campaign itu, TIDAK termasuk yang berstatus 'cancel' (order dibatalkan
//   sebelum kirim berarti tidak benar-benar "closing", tapi 'retur' tetap
//   dihitung closing karena barang sempat terkirim & iklan sudah bekerja)
// - ROAS (return on ad spend) = revenue realisasi / total spend, revenue
//   dihitung HANYA dari order berstatus 'terkirim' (bukan 'proses', supaya
//   ROAS tidak menghitung uang yang belum tentu cair)
// ---------------------------------------------------------------------------
export type BiayaStore = { id: string; display_name: string }

export type BiayaCampaign = {
  id: string
  store_id: string
  store_name: string
  platform: string
  name: string
  campaign_type: string | null
  is_active: boolean
}

export type CampaignPerformance = {
  campaign_id: string
  spend: number
  leads: number
  closing_count: number
  revenue: number
  cpl: number | null // null kalau leads = 0, bukan dibagi 0
  cpo: number | null // null kalau closing_count = 0
  roas: number | null // null kalau spend = 0
}

export type AdSpendLogRow = {
  id: string
  store_id: string
  store_name: string
  campaign_id: string | null
  campaign_name: string | null
  platform: string
  biz_date: string
  amount: number
  leads_count: number
  notes: string | null
}

export type ExpenseLogRow = {
  id: string
  store_id: string | null
  store_name: string | null // null = biaya bersama
  biz_date: string
  category: string
  amount: number
  notes: string | null
}

export type BiayaPageData = {
  stores: BiayaStore[]
  campaigns: BiayaCampaign[]
  performanceByCampaign: Record<string, CampaignPerformance>
  adSpendLog: AdSpendLogRow[]
  expenseLog: ExpenseLogRow[]
  totalSpend: number
  totalExpenses: number
}

export async function getBiayaPageData(startDate: string, endDate: string): Promise<BiayaPageData> {
  const supabase = await createClient()

  const [{ data: stores }, { data: campaignsRaw }, { data: adSpendRaw }, { data: expensesRaw }, { data: ordersRaw }] =
    await Promise.all([
      supabase.from('stores').select('id, display_name').eq('is_active', true).order('sort_order'),
      supabase
        .from('ad_campaigns')
        .select('id, store_id, platform, name, campaign_type, is_active, store:stores!inner(display_name)')
        .order('created_at', { ascending: false }),
      supabase
        .from('ad_spend_daily')
        .select('id, store_id, campaign_id, platform, biz_date, amount, leads_count, notes, store:stores!inner(display_name), campaign:ad_campaigns(name)')
        .gte('biz_date', startDate)
        .lte('biz_date', endDate)
        .order('biz_date', { ascending: false }),
      supabase
        .from('expenses')
        .select('id, store_id, biz_date, category, amount, notes, store:stores(display_name)')
        .gte('biz_date', startDate)
        .lte('biz_date', endDate)
        .order('biz_date', { ascending: false }),
      // Cuma butuh campaign_id, status, unit_price, qty -- untuk hitung closing_count & revenue per campaign.
      supabase
        .from('orders')
        .select('campaign_id, status, unit_price, qty')
        .not('campaign_id', 'is', null)
        .gte('order_date', startDate)
        .lte('order_date', endDate),
    ])

  const campaigns: BiayaCampaign[] = ((campaignsRaw ?? []) as any[]).map((c) => ({
    id: c.id,
    store_id: c.store_id,
    store_name: c.store.display_name,
    platform: c.platform,
    name: c.name,
    campaign_type: c.campaign_type,
    is_active: c.is_active,
  }))

  const performanceByCampaign: Record<string, CampaignPerformance> = {}
  function ensurePerf(campaignId: string): CampaignPerformance {
    return (performanceByCampaign[campaignId] ??= {
      campaign_id: campaignId,
      spend: 0,
      leads: 0,
      closing_count: 0,
      revenue: 0,
      cpl: null,
      cpo: null,
      roas: null,
    })
  }

  let totalSpend = 0
  for (const row of (adSpendRaw ?? []) as any[]) {
    totalSpend += row.amount
    if (row.campaign_id) {
      const perf = ensurePerf(row.campaign_id)
      perf.spend += row.amount
      perf.leads += row.leads_count
    }
  }

  for (const row of (ordersRaw ?? []) as any[]) {
    const perf = ensurePerf(row.campaign_id)
    if (row.status !== 'cancel') perf.closing_count += 1
    if (row.status === 'terkirim') perf.revenue += row.unit_price * row.qty
  }

  for (const perf of Object.values(performanceByCampaign)) {
    perf.cpl = perf.leads > 0 ? Math.round(perf.spend / perf.leads) : null
    perf.cpo = perf.closing_count > 0 ? Math.round(perf.spend / perf.closing_count) : null
    perf.roas = perf.spend > 0 ? perf.revenue / perf.spend : null
  }

  const adSpendLog: AdSpendLogRow[] = ((adSpendRaw ?? []) as any[]).map((row) => ({
    id: row.id,
    store_id: row.store_id,
    store_name: row.store.display_name,
    campaign_id: row.campaign_id,
    campaign_name: row.campaign?.name ?? null,
    platform: row.platform,
    biz_date: row.biz_date,
    amount: row.amount,
    leads_count: row.leads_count,
    notes: row.notes,
  }))

  const expenseLog: ExpenseLogRow[] = ((expensesRaw ?? []) as any[]).map((row) => ({
    id: row.id,
    store_id: row.store_id,
    store_name: row.store?.display_name ?? null,
    biz_date: row.biz_date,
    category: row.category,
    amount: row.amount,
    notes: row.notes,
  }))

  const totalExpenses = expenseLog.reduce((sum, e) => sum + e.amount, 0)

  return {
    stores: stores ?? [],
    campaigns,
    performanceByCampaign,
    adSpendLog,
    expenseLog,
    totalSpend,
    totalExpenses,
  }
}

// ---------------------------------------------------------------------------
// SKOR PRODUK — untuk memutuskan produk mana yang layak diproduksi besar.
//
// Ini menjawab pertanyaan yang tidak bisa dijawab halaman manapun sebelumnya:
// "dari semua produk yang saya dropship, mana yang terbukti laku DAN sehat
// marginnya DAN tidak banyak retur?" -- karena bukti itu tersebar di tiga
// tempat: orders (penjualan marketplace/iklan), live_sessions (penjualan live),
// dan variants (HPP).
//
// Definisi kolom (konsisten dengan aturan omzet di atas):
// - units_sold     = qty order 'terkirim' + units_sold dari sesi live
// - revenue/profit = HANYA dari order 'terkirim' (live tidak menyimpan harga
//                    transaksi, cuma jumlah unit -- jadi tidak diuangkan)
// - retur_rate     = order 'retur' / (terkirim + retur), 0-100
// - cancel_rate    = order 'cancel' / semua order, 0-100
// - from_ads_pct   = order yang punya campaign_id / semua order, 0-100.
//                    Tinggi = produk ini hidup dari iklan. Rendah = ada
//                    permintaan organik -> risiko produksi besar lebih kecil.
// ---------------------------------------------------------------------------
export type ProductScore = {
  variant_id: string
  sku: string
  product_name: string
  variant_name: string
  unit: string
  cost_price: number
  units_sold: number
  units_from_live: number
  revenue: number
  profit: number
  margin_pct: number | null
  orders_count: number
  retur_rate: number | null
  cancel_rate: number | null
  from_ads_pct: number | null
  verdict: 'siap' | 'pantau' | 'hentikan' | 'data_kurang'
  verdict_reason: string
}

// Ambang keputusan. Sengaja dijadikan konstanta bernama, bukan angka ajaib
// yang tercecer di tengah logika -- supaya gampang disetel kalau ternyata
// terlalu ketat/longgar di lapangan.
const MIN_UNITS_FOR_DECISION = 10 // di bawah ini sampelnya terlalu kecil untuk disimpulkan
const HEALTHY_MARGIN_PCT = 15 // margin bersih minimum yang dianggap sehat
const MAX_RETUR_PCT = 10 // di atas ini produksi besar berisiko

export async function getProductScores(startDate: string, endDate: string): Promise<ProductScore[]> {
  const supabase = await createClient()

  const [{ data: variants }, { data: orders }, { data: lives }] = await Promise.all([
    supabase
      .from('variants')
      .select('id, sku, variant_name, cost_price, unit, is_active, product:products!inner(name)')
      .eq('is_active', true),
    supabase
      .from('orders')
      .select('variant_id, qty, unit_price, cost_price_snapshot, status, campaign_id')
      .gte('order_date', startDate)
      .lte('order_date', endDate),
    supabase
      .from('live_sessions')
      .select('variant_id, units_sold')
      .gte('session_date', startDate)
      .lte('session_date', endDate),
  ])

  type Acc = {
    units: number
    revenue: number
    profit: number
    orders: number
    terkirim: number
    retur: number
    cancel: number
    fromAds: number
    liveUnits: number
  }
  const acc = new Map<string, Acc>()
  const blank = (): Acc => ({
    units: 0, revenue: 0, profit: 0, orders: 0,
    terkirim: 0, retur: 0, cancel: 0, fromAds: 0, liveUnits: 0,
  })

  for (const o of (orders ?? []) as any[]) {
    const a = acc.get(o.variant_id) ?? blank()
    a.orders += 1
    if (o.campaign_id) a.fromAds += 1
    if (o.status === 'terkirim') {
      a.terkirim += 1
      a.units += o.qty
      a.revenue += o.unit_price * o.qty
      a.profit += (o.unit_price - o.cost_price_snapshot) * o.qty
    } else if (o.status === 'retur') {
      a.retur += 1
    } else if (o.status === 'cancel') {
      a.cancel += 1
    }
    acc.set(o.variant_id, a)
  }

  for (const l of (lives ?? []) as any[]) {
    const a = acc.get(l.variant_id) ?? blank()
    a.liveUnits += l.units_sold
    a.units += l.units_sold
    acc.set(l.variant_id, a)
  }

  const rows: ProductScore[] = ((variants ?? []) as any[]).map((v) => {
    const a = acc.get(v.id) ?? blank()
    const settled = a.terkirim + a.retur
    const marginPct = a.revenue > 0 ? (a.profit / a.revenue) * 100 : null
    const returRate = settled > 0 ? (a.retur / settled) * 100 : null
    const cancelRate = a.orders > 0 ? (a.cancel / a.orders) * 100 : null
    const fromAdsPct = a.orders > 0 ? (a.fromAds / a.orders) * 100 : null

    let verdict: ProductScore['verdict']
    let reason: string
    if (a.units < MIN_UNITS_FOR_DECISION) {
      verdict = 'data_kurang'
      reason = `Baru ${a.units} unit terjual — minimal ${MIN_UNITS_FOR_DECISION} unit sebelum bisa disimpulkan.`
    } else if (returRate !== null && returRate > MAX_RETUR_PCT) {
      verdict = 'hentikan'
      reason = `Retur ${returRate.toFixed(0)}% — di atas batas ${MAX_RETUR_PCT}%. Produksi besar berisiko rugi di ongkos balik.`
    } else if (marginPct !== null && marginPct < HEALTHY_MARGIN_PCT) {
      verdict = 'pantau'
      reason = `Laku, tapi margin cuma ${marginPct.toFixed(0)}% — di bawah ${HEALTHY_MARGIN_PCT}%. Produksi sendiri baru masuk akal kalau HPP bisa ditekan.`
    } else if (marginPct === null) {
      verdict = 'pantau'
      reason = 'Unit terjual cukup, tapi semuanya dari live — belum ada order bernilai rupiah untuk mengukur margin.'
    } else {
      verdict = 'siap'
      reason = `${a.units} unit terjual, margin ${marginPct.toFixed(0)}%, retur ${(returRate ?? 0).toFixed(0)}% — layak dipertimbangkan produksi besar.`
    }

    return {
      variant_id: v.id,
      sku: v.sku,
      product_name: v.product.name,
      variant_name: v.variant_name,
      unit: v.unit,
      cost_price: v.cost_price,
      units_sold: a.units,
      units_from_live: a.liveUnits,
      revenue: a.revenue,
      profit: a.profit,
      margin_pct: marginPct,
      orders_count: a.orders,
      retur_rate: returRate,
      cancel_rate: cancelRate,
      from_ads_pct: fromAdsPct,
      verdict,
      verdict_reason: reason,
    }
  })

  // Yang paling laku di atas — itu yang paling relevan untuk keputusan produksi.
  return rows.sort((a, b) => b.units_sold - a.units_sold)
}

// ---------------------------------------------------------------------------
// PERFORMA HOST LIVE — dipakai memutuskan host mana yang dipertahankan.
//
// host_name adalah teks bebas (§ migration 0005), jadi agregasi dilakukan
// dengan GROUP BY di sisi aplikasi. Metrik dipilih yang benar-benar bisa
// ditindaklanjuti:
// - close_rate    = unit terjual / penonton (0-100). Seberapa efektif host
//                   mengubah penonton jadi pembeli.
// - cart_rate     = masuk keranjang / penonton. Kalau cart tinggi tapi close
//                   rendah, masalahnya di harga/checkout, bukan di host.
// - units_per_jam = unit terjual / durasi. Produktivitas per jam siaran.
// - fee_per_unit  = total fee host / unit terjual. Ini angka paling penting:
//                   bandingkan dengan margin per unit produk. Kalau fee per
//                   unit > margin per unit, sesi live itu rugi.
// ---------------------------------------------------------------------------
export type HostPerformance = {
  host_name: string
  sessions: number
  total_minutes: number
  total_viewers: number
  total_units: number
  total_cart: number
  total_fee: number
  close_rate: number | null
  cart_rate: number | null
  units_per_hour: number | null
  fee_per_unit: number | null
}

export async function getHostPerformance(startDate: string, endDate: string): Promise<HostPerformance[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('live_sessions')
    .select('host_name, duration_minutes, viewers_count, units_sold, add_to_cart_count, host_fee')
    .gte('session_date', startDate)
    .lte('session_date', endDate)

  const byHost = new Map<string, HostPerformance>()
  for (const s of (data ?? []) as any[]) {
    const h = byHost.get(s.host_name) ?? {
      host_name: s.host_name,
      sessions: 0, total_minutes: 0, total_viewers: 0, total_units: 0,
      total_cart: 0, total_fee: 0,
      close_rate: null, cart_rate: null, units_per_hour: null, fee_per_unit: null,
    }
    h.sessions += 1
    h.total_minutes += s.duration_minutes
    h.total_viewers += s.viewers_count
    h.total_units += s.units_sold
    h.total_cart += s.add_to_cart_count
    h.total_fee += s.host_fee ?? 0
    byHost.set(s.host_name, h)
  }

  for (const h of byHost.values()) {
    h.close_rate = h.total_viewers > 0 ? (h.total_units / h.total_viewers) * 100 : null
    h.cart_rate = h.total_viewers > 0 ? (h.total_cart / h.total_viewers) * 100 : null
    h.units_per_hour = h.total_minutes > 0 ? h.total_units / (h.total_minutes / 60) : null
    h.fee_per_unit = h.total_units > 0 ? Math.round(h.total_fee / h.total_units) : null
  }

  return [...byHost.values()].sort((a, b) => b.total_units - a.total_units)
}

// ---------------------------------------------------------------------------
// PENGATURAN TAMPILAN (white-label). Selalu tepat satu baris, id = 1.
// ---------------------------------------------------------------------------
export type AppSettings = {
  app_name: string
  app_tagline: string
  brand_initial: string
  brand_color: string
  show_input: boolean
  show_pesanan: boolean
  show_toko: boolean
  show_biaya: boolean
  show_live: boolean
  show_produk: boolean
}

export const DEFAULT_SETTINGS: AppSettings = {
  app_name: 'Websensial',
  app_tagline: 'Operational OS',
  brand_initial: 'W',
  brand_color: '#2f6d5b',
  show_input: true,
  show_pesanan: true,
  show_toko: true,
  show_biaya: true,
  show_live: true,
  show_produk: true,
}

// Kalau migration 0007 belum dijalankan, tabelnya belum ada -> jangan sampai
// seluruh aplikasi gagal render. Jatuh ke default, aplikasi tetap jalan.
export async function getAppSettings(): Promise<AppSettings> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('app_name, app_tagline, brand_initial, brand_color, show_input, show_pesanan, show_toko, show_biaya, show_live, show_produk')
    .eq('id', 1)
    .maybeSingle()

  if (error || !data) return DEFAULT_SETTINGS
  return data as AppSettings
}

// Daftar toko untuk halaman Pengaturan — termasuk mode & fee marketplace.
export type StoreSetting = {
  id: string
  display_name: string
  channel: string
  tracking_mode: 'rekap_harian' | 'per_order'
  default_commission_pct: number
  default_service_fee_pct: number
  is_active: boolean
}

export async function getStoreSettings(): Promise<StoreSetting[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('stores')
    .select('id, display_name, channel, tracking_mode, default_commission_pct, default_service_fee_pct, is_active')
    .order('sort_order')
  return (data ?? []) as StoreSetting[]
}
