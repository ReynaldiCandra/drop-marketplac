// Kalkulator harga jual untuk model dropship: HPP + margin bersih yang
// diinginkan -> harga jual otomatis, dengan fee marketplace toko itu
// sudah diperhitungkan supaya margin bersih tercapai persis.
//
// fee marketplace = default_commission_pct + default_service_fee_pct (dari
// tabel stores), dinyatakan dalam persen (0-100).

export type MarginType = 'percent' | 'nominal'

export type PricingInput = {
  costPrice: number // HPP, rupiah, bulat
  marginType: MarginType
  marginValue: number // nominal: rupiah per pcs. percent: 0-100
  marketplaceFeePct: number // 0-100, gabungan commission + service fee toko
}

export type PricingResult = {
  sellingPrice: number
  feeAmount: number
  netMarginAmount: number // rupiah bersih per pcs setelah fee & HPP
  netMarginPct: number // % dari harga jual
}

/**
 * Nominal: P - P*fee% - HPP = margin_nominal  =>  P = (HPP + margin_nominal) / (1 - fee%)
 * Percent: P - P*fee% - HPP = P*margin%       =>  P = HPP / (1 - fee% - margin%)
 *
 * Melempar error kalau kombinasi fee% + margin% (mode percent) >= 100%,
 * karena itu berarti harga jual butuh tak terhingga (tidak mungkin dicapai).
 */
export function calculateSellingPrice(input: PricingInput): PricingResult {
  const fee = input.marketplaceFeePct / 100
  const cost = input.costPrice

  let sellingPrice: number

  if (input.marginType === 'nominal') {
    const denom = 1 - fee
    if (denom <= 0) {
      throw new Error('Fee marketplace >= 100%, tidak bisa hitung harga jual.')
    }
    sellingPrice = (cost + input.marginValue) / denom
  } else {
    const marginPct = input.marginValue / 100
    const denom = 1 - fee - marginPct
    if (denom <= 0) {
      throw new Error(
        'Fee marketplace + target margin >= 100%, harga jual tidak mungkin dicapai. Turunkan target margin.',
      )
    }
    sellingPrice = cost / denom
  }

  sellingPrice = Math.round(sellingPrice)
  const feeAmount = Math.round(sellingPrice * fee)
  const netMarginAmount = sellingPrice - feeAmount - cost
  const netMarginPct = sellingPrice > 0 ? (netMarginAmount / sellingPrice) * 100 : 0

  return { sellingPrice, feeAmount, netMarginAmount, netMarginPct }
}

/**
 * Kebalikannya: dari harga jual yang sudah ditentukan (misal harga existing
 * di marketplace), hitung margin bersih aktualnya -- dipakai untuk validasi
 * atau menampilkan "margin toko X saat ini berapa" tanpa ubah harga.
 */
export function calculateMarginFromPrice(
  sellingPrice: number,
  costPrice: number,
  marketplaceFeePct: number,
): { feeAmount: number; netMarginAmount: number; netMarginPct: number } {
  const feeAmount = Math.round(sellingPrice * (marketplaceFeePct / 100))
  const netMarginAmount = sellingPrice - feeAmount - costPrice
  const netMarginPct = sellingPrice > 0 ? (netMarginAmount / sellingPrice) * 100 : 0
  return { feeAmount, netMarginAmount, netMarginPct }
}
