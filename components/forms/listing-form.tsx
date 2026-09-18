'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Loader2, Pencil } from 'lucide-react'
import { upsertListing, setListingActive, updateStoreFee } from '@/lib/actions/catalog'
import { calculateSellingPrice, type MarginType } from '@/lib/calc/pricing'
import { channelLabel } from '@/lib/store-labels'
import { formatRupiahPenuh } from '@/lib/format'
import type { CatalogProduct, CatalogStore, StoreListingRow } from '@/lib/queries'

type FlatVariant = {
  variantId: string
  sku: string
  variantName: string
  productName: string
  unit: string
  costPrice: number
}

function flattenActiveVariants(products: CatalogProduct[]): FlatVariant[] {
  const rows: FlatVariant[] = []
  for (const p of products) {
    if (!p.is_active) continue
    for (const v of p.variants) {
      if (!v.is_active) continue
      rows.push({
        variantId: v.id,
        sku: v.sku,
        variantName: v.variant_name,
        productName: p.name,
        unit: v.unit,
        costPrice: v.cost_price,
      })
    }
  }
  return rows
}

// ---------------------------------------------------------------------------
// Fee marketplace per toko — dibutuhkan kalkulator harga jual di bawah.
// ---------------------------------------------------------------------------
export function StoreFeeEditor({ stores }: { stores: CatalogStore[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>TOKO</th>
            <th>KOMISI (%)</th>
            <th>BIAYA LAYANAN (%)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {stores.map((s) => (
            <StoreFeeRow key={s.id} store={s} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StoreFeeRow({ store }: { store: CatalogStore }) {
  const [commissionPct, setCommissionPct] = useState(store.default_commission_pct)
  const [servicePct, setServicePct] = useState(store.default_service_fee_pct)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    startTransition(async () => {
      const result = await updateStoreFee({ storeId: store.id, commissionPct, servicePct })
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1200)
      }
    })
  }

  return (
    <tr>
      <td>
        <div className="shop-name">
          <strong>{store.display_name}</strong>
        </div>
        <small>{channelLabel(store.channel)}</small>
      </td>
      <td>
        <input
          className="recap-input"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.1}
          value={commissionPct}
          onChange={(e) => setCommissionPct(Number(e.target.value))}
          style={{ width: 70 }}
        />
      </td>
      <td>
        <input
          className="recap-input"
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.1}
          value={servicePct}
          onChange={(e) => setServicePct(Number(e.target.value))}
          style={{ width: 70 }}
        />
      </td>
      <td>
        <button type="button" className="secondary-button" onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 size={13} className="spin" /> : saved ? <Check size={13} /> : null}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Simpan'}
        </button>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Listing: pilih toko, lalu tetapkan/ubah harga jual tiap varian di toko itu.
// Ini sumber data yang dibaca Form Order & Live Selling (store_listings).
// ---------------------------------------------------------------------------
export function ListingManager({
  products,
  stores,
  listings,
}: {
  products: CatalogProduct[]
  stores: CatalogStore[]
  listings: StoreListingRow[]
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const variants = useMemo(() => flattenActiveVariants(products), [products])
  const store = stores.find((s) => s.id === storeId)

  const listingByVariant = useMemo(() => {
    const map = new Map<string, StoreListingRow>()
    for (const l of listings) {
      if (l.store_id === storeId) map.set(l.variant_id, l)
    }
    return map
  }, [listings, storeId])

  if (!store) {
    return <div className="empty-state">Belum ada toko aktif.</div>
  }

  if (variants.length === 0) {
    return <div className="empty-state">Belum ada produk/varian aktif. Tambahkan produk dulu di panel atas.</div>
  }

  return (
    <div>
      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ display: 'block', color: '#344054', fontSize: 11, fontWeight: 700, marginBottom: 7 }}>
          Toko
        </span>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} style={{ maxWidth: 320 }}>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name} · {channelLabel(s.channel)}
            </option>
          ))}
        </select>
      </label>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>PRODUK</th>
              <th>HPP</th>
              <th>STATUS</th>
              <th>HARGA JUAL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <ListingRow key={v.variantId} storeId={storeId} store={store} variant={v} listing={listingByVariant.get(v.variantId)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ListingRow({
  storeId,
  store,
  variant,
  listing,
}: {
  storeId: string
  store: CatalogStore
  variant: FlatVariant
  listing?: StoreListingRow
}) {
  const [editing, setEditing] = useState(false)
  const feePct = store.default_commission_pct + store.default_service_fee_pct
  const [marginType, setMarginType] = useState<MarginType>(listing?.target_margin_type ?? 'percent')
  const [marginValue, setMarginValue] = useState<number>(listing?.target_margin_value ?? 20)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const suggested = useMemo(() => {
    try {
      return calculateSellingPrice({
        costPrice: variant.costPrice,
        marginType,
        marginValue,
        marketplaceFeePct: feePct,
      })
    } catch {
      return null
    }
  }, [variant.costPrice, marginType, marginValue, feePct])

  const [price, setPrice] = useState<number>(listing?.listing_price ?? suggested?.sellingPrice ?? 0)

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await upsertListing({
        storeId,
        variantId: variant.variantId,
        listingPrice: price,
        marginType,
        marginValue,
      })
      if (result.ok) {
        setEditing(false)
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Gagal menyimpan.')
      }
    })
  }

  function handleToggleActive() {
    if (!listing) return
    startTransition(async () => {
      await setListingActive({ storeId, variantId: variant.variantId, isActive: !listing.is_active })
    })
  }

  return (
    <tr>
      <td>
        <strong>{variant.productName}</strong>
        <br />
        <small style={{ color: 'var(--muted)' }}>
          {variant.variantName} · {variant.sku}
        </small>
      </td>
      <td className="number">{formatRupiahPenuh(variant.costPrice)}</td>
      <td>
        {!listing ? (
          <span className="badge badge-gray">Belum ada</span>
        ) : listing.is_active ? (
          <span className="badge badge-green">Aktif</span>
        ) : (
          <span className="badge badge-gray">Nonaktif</span>
        )}
      </td>
      <td className="number">
        {listing && !editing ? formatRupiahPenuh(listing.listing_price) : editing ? null : '—'}
      </td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <select
                value={marginType}
                onChange={(e) => setMarginType(e.target.value as MarginType)}
                style={{ fontSize: 11, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6 }}
              >
                <option value="percent">Margin %</option>
                <option value="nominal">Margin Rp</option>
              </select>
              <input
                className="recap-input"
                type="number"
                inputMode="decimal"
                value={marginValue}
                onChange={(e) => setMarginValue(Number(e.target.value))}
                style={{ width: 70 }}
              />
            </div>
            {suggested && (
              <button
                type="button"
                className="text-button"
                onClick={() => setPrice(suggested.sellingPrice)}
                title={`Fee marketplace ${feePct}% sudah diperhitungkan`}
              >
                Pakai saran: {formatRupiahPenuh(suggested.sellingPrice)}
              </button>
            )}
            <input
              className="recap-input"
              type="number"
              inputMode="numeric"
              min={1}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              style={{ width: 110, fontWeight: 700 }}
            />
            {error && <span style={{ color: 'var(--red)', fontSize: 10 }}>{error}</span>}
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className="primary-button" onClick={handleSave} disabled={isPending}>
                {isPending ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                {isPending ? 'Menyimpan…' : 'Simpan'}
              </button>
              <button type="button" className="secondary-button" onClick={() => setEditing(false)}>
                Batal
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button type="button" className="secondary-button" onClick={() => setEditing(true)}>
              <Pencil size={12} /> {listing ? 'Ubah' : 'Tetapkan'}
            </button>
            {listing && (
              <button type="button" className="secondary-button" onClick={handleToggleActive} disabled={isPending}>
                {listing.is_active ? 'Nonaktifkan' : 'Aktifkan'}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  )
}
