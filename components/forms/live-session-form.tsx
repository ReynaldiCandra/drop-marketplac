'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { createLiveSession } from '@/lib/actions/live-sessions'
import { channelLabel } from '@/lib/store-labels'
import { formatRupiahPenuh } from '@/lib/format'
import type { OrderFormData } from '@/lib/queries'

export function LiveSessionForm({ data, defaultDate }: { data: OrderFormData; defaultDate: string }) {
  const { stores, listingsByStore } = data

  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [variantId, setVariantId] = useState('')
  const [hostName, setHostName] = useState('')
  const [sessionDate, setSessionDate] = useState(defaultDate)
  const [durationMinutes, setDurationMinutes] = useState(0)
  const [unitsSold, setUnitsSold] = useState(0)
  const [addToCartCount, setAddToCartCount] = useState(0)
  const [viewersCount, setViewersCount] = useState(0)
  const [hostFee, setHostFee] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const listings = listingsByStore[storeId] ?? []

  function handleStoreChange(nextStoreId: string) {
    setStoreId(nextStoreId)
    setVariantId('')
  }

  function resetCounters() {
    setVariantId('')
    setHostName('')
    setDurationMinutes(0)
    setUnitsSold(0)
    setAddToCartCount(0)
    setViewersCount(0)
    setHostFee(0)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!storeId || !variantId || !hostName.trim()) {
      setError('Pilih toko, produk, dan isi nama host dulu.')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createLiveSession({
        storeId,
        variantId,
        hostName: hostName.trim(),
        sessionDate,
        durationMinutes,
        unitsSold,
        addToCartCount,
        viewersCount,
        hostFee,
      })
      if (result.ok) {
        resetCounters()
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
        <input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} required />
      </label>

      <label>
        Nama host
        <input
          type="text"
          placeholder="mis. Dinda"
          value={hostName}
          onChange={(e) => setHostName(e.target.value)}
          required
        />
      </label>

      <label>
        Dari toko marketplace
        <select value={storeId} onChange={(e) => handleStoreChange(e.target.value)} required>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name} · {channelLabel(s.channel)}
            </option>
          ))}
        </select>
      </label>

      <label className="span-2">
        Nama produk
        <select value={variantId} onChange={(e) => setVariantId(e.target.value)} required>
          <option value="">— pilih produk —</option>
          {listings.map((l) => (
            <option key={l.variant_id} value={l.variant_id}>
              {l.product_name} — {l.variant_name} ({l.sku})
            </option>
          ))}
        </select>
      </label>

      <label>
        Lama jam live (menit)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      <label>
        Jumlah penonton
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={viewersCount}
          onChange={(e) => setViewersCount(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      <label>
        Produk terjual
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={unitsSold}
          onChange={(e) => setUnitsSold(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      <label>
        Ditambah keranjang
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={addToCartCount}
          onChange={(e) => setAddToCartCount(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      <label>
        Fee host (Rp)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          step={1000}
          value={hostFee}
          onChange={(e) => setHostFee(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>

      {unitsSold > 0 && hostFee > 0 && (
        <div className="order-preview span-2">
          <span>
            Fee per unit terjual:{' '}
            <strong>{formatRupiahPenuh(Math.round(hostFee / unitsSold))}</strong>
          </span>
          <span style={{ color: 'var(--muted)' }}>
            Bandingkan dengan margin per unit produk ini — kalau lebih besar, sesi ini rugi.
          </span>
        </div>
      )}

      {error && <div className="order-preview" style={{ color: 'var(--red)', background: '#fbe9e7' }}>{error}</div>}

      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : null}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Catat sesi'}
        </button>
      </div>
    </form>
  )
}
