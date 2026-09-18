// Dipisah dari lib/queries.ts karena file itu mengimpor lib/supabase/server
// (pakai next/headers) — kalau Client Component ikut mengimpornya, build
// gagal karena next/headers tidak boleh masuk bundle browser.

const CHANNEL_LABEL: Record<string, string> = {
  shopee: 'Shopee',
  lazada: 'Lazada',
  tiktok: 'TikTok Shop',
  etsy: 'Etsy',
  lainnya: 'Lainnya',
}

const CHANNEL_DOT: Record<string, string> = {
  shopee: 'orange',
  lazada: 'blue',
  tiktok: 'pink',
  etsy: 'orange',
  lainnya: 'gray',
}

export function channelLabel(channel: string) {
  return CHANNEL_LABEL[channel] ?? channel
}

export function channelDot(channel: string) {
  return CHANNEL_DOT[channel] ?? 'gray'
}

const UNIT_LABEL: Record<string, string> = {
  pcs: 'pcs',
  m2: 'm²',
  btg: 'btg',
  lainnya: 'unit',
}

export function unitLabel(unit: string) {
  return UNIT_LABEL[unit] ?? unit
}

const AD_PLATFORM_LABEL: Record<string, string> = {
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  tiktok_ads: 'TikTok Ads',
  lainnya: 'Lainnya',
}

export function adPlatformLabel(platform: string) {
  return AD_PLATFORM_LABEL[platform] ?? platform
}

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cod: 'COD',
  transfer: 'Transfer',
}

export function paymentMethodLabel(method: string) {
  return PAYMENT_METHOD_LABEL[method] ?? method
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  proses: 'Proses',
  terkirim: 'Terkirim',
  cancel: 'Cancel',
  retur: 'Retur',
}

export function orderStatusLabel(status: string) {
  return ORDER_STATUS_LABEL[status] ?? status
}

// Dipakai buat kelas warna badge status order — lihat .order-status-* di globals.css.
export function orderStatusTone(status: string) {
  switch (status) {
    case 'terkirim':
      return 'green'
    case 'retur':
      return 'red'
    case 'cancel':
      return 'gray'
    default:
      return 'amber'
  }
}

export type DailyRecapRow = {
  store_id: string
  gross_revenue: number
  orders_count: number
  units_count: number
  cancelled_count: number
  cancelled_value: number
  returned_count: number
  returned_value: number
  shipping_borne: number
  platform_fee: number
  voucher_cost: number
  status: 'kosong' | 'sebagian' | 'lengkap'
}
