'use client'

import { useMemo, useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { createOrder } from '@/lib/actions/orders'
import { channelLabel, unitLabel } from '@/lib/store-labels'
import { formatRupiahPenuh } from '@/lib/format'
import type { OrderFormData } from '@/lib/queries'

export function OrderForm({ data, defaultDate }: { data: OrderFormData; defaultDate: string }) {
  const { stores, listingsByStore, campaignsByStore } = data

  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [variantId, setVariantId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [orderDate, setOrderDate] = useState(defaultDate)
  const [qty, setQty] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'transfer'>('transfer')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerRegion, setBuyerRegion] = useState('')
  const [showBuyerFields, setShowBuyerFields] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  // COD butuh follow-up kalau pengiriman gagal -- buka field pembeli otomatis
  // supaya tidak lupa dicatat, tanpa memaksa field ini untuk order Transfer.
  function handlePaymentMethodChange(next: 'cod' | 'transfer') {
    setPaymentMethod(next)
    if (next === 'cod') setShowBuyerFields(true)
  }

  const listings = listingsByStore[storeId] ?? []
  const campaigns = campaignsByStore[storeId] ?? []
  const selectedListing = useMemo(
    () => listings.find((l) => l.variant_id === variantId),
    [listings, variantId],
  )

  function handleStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId)
    setVariantId('')
    setCampaignId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId || !variantId) {
      setError('Pilih toko dan SKU dulu.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createOrder({
        storeId,
        variantId,
        campaignId,
        orderDate,
        qty,
        paymentMethod,
        buyerName,
        buyerPhone,
        buyerRegion,
      })
      if (result.ok) {
        setVariantId('')
        setQty(1)
        setCampaignId('')
        setBuyerName('')
        setBuyerPhone('')
        setBuyerRegion('')
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Input tidak valid.')
      }
    })
  }

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <label>
        Tanggal
        <input
          type="date"
          value={orderDate}
          onChange={(e) => setOrderDate(e.target.value)}
          required
        />
      </label>

      <label>
        Toko
        <select value={storeId} onChange={(e) => handleStoreChange(e.target.value)} required>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name} · {channelLabel(s.channel)}
            </option>
          ))}
        </select>
      </label>

      <label className="span-2">
        SKU
        <select value={variantId} onChange={(e) => setVariantId(e.target.value)} required>
          <option value="">— pilih SKU —</option>
          {listings.map((l) => (
            <option key={l.variant_id} value={l.variant_id}>
              {l.product_name} — {l.variant_name} ({l.sku})
            </option>
          ))}
        </select>
      </label>

      <label>
        Qty
        <input
          type="number"
          inputMode="numeric"
          min={1}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          required
        />
      </label>

      <label>
        Metode bayar
        <select value={paymentMethod} onChange={(e) => handlePaymentMethodChange(e.target.value as 'cod' | 'transfer')}>
          <option value="transfer">Transfer</option>
          <option value="cod">COD</option>
        </select>
      </label>

      <label className="span-2">
        Campaign asal <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opsional)</span>
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={campaigns.length === 0}>
          <option value="">Organik / tidak dilacak</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      {selectedListing && (
        <div className="order-preview">
          <span>
            Harga jual: <strong>{formatRupiahPenuh(selectedListing.listing_price)}</strong> / {unitLabel(selectedListing.unit)}
          </span>
          <span>
            HPP: <strong>{formatRupiahPenuh(selectedListing.cost_price)}</strong>
          </span>
          <span>
            Total: <strong>{formatRupiahPenuh(selectedListing.listing_price * qty)}</strong>
          </span>
        </div>
      )}

      <div className="span-2">
        <button
          type="button"
          className="text-button"
          onClick={() => setShowBuyerFields((v) => !v)}
          style={{ marginBottom: showBuyerFields ? 8 : 0 }}
        >
          {showBuyerFields ? 'Sembunyikan' : 'Tambah'} data pembeli
          <span style={{ fontWeight: 400, color: 'var(--muted)' }}>
            {' '}
            (opsional{paymentMethod === 'cod' ? ' — disarankan untuk COD' : ''})
          </span>
        </button>
      </div>

      {showBuyerFields && (
        <>
          <label>
            Nama pembeli
            <input
              type="text"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Opsional"
              maxLength={120}
            />
          </label>
          <label>
            No. WA pembeli
            <input
              type="tel"
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              maxLength={30}
            />
          </label>
          <label>
            Kota/wilayah
            <input
              type="text"
              value={buyerRegion}
              onChange={(e) => setBuyerRegion(e.target.value)}
              placeholder="Opsional"
              maxLength={80}
            />
          </label>
        </>
      )}

      {error && <div className="order-preview" style={{ color: 'var(--red)', background: '#fbe9e7' }}>{error}</div>}

      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : null}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Catat order'}
        </button>
      </div>
    </form>
  )
}
