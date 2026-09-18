'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { createProductWithVariant, addVariant } from '@/lib/actions/catalog'
import { unitLabel } from '@/lib/store-labels'
import type { CatalogSupplier } from '@/lib/queries'

const UNITS = ['pcs', 'm2', 'btg', 'lainnya'] as const

// Produk baru selalu dibuat sekaligus dengan varian pertamanya — produk
// tanpa varian tidak bisa dijual, jadi dua langkah terpisah cuma nambah
// friksi input tanpa manfaat (P1 & P3, MASTER_DASHBOARD.md).
export function AddProductForm({ suppliers }: { suppliers: CatalogSupplier[] }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [sku, setSku] = useState('')
  const [variantName, setVariantName] = useState('')
  const [costPrice, setCostPrice] = useState<number | ''>('')
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('pcs')
  const [supplierId, setSupplierId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setName('')
    setCategory('')
    setSku('')
    setVariantName('')
    setCostPrice('')
    setSupplierId('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createProductWithVariant({
        name,
        category,
        notes: '',
        sku,
        variantName,
        costPrice: costPrice === '' ? 0 : costPrice,
        unit,
        supplierId,
      })
      if (result.ok) {
        reset()
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Input tidak valid.')
      }
    })
  }

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <label className="span-2">
        Nama produk
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gamis Diamond Series" required />
      </label>
      <label>
        Kategori <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opsional)</span>
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Gamis" />
      </label>
      <label>
        SKU varian pertama
        <input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="GMS-DMD-01" required />
      </label>
      <label>
        Nama varian
        <input
          value={variantName}
          onChange={(e) => setVariantName(e.target.value)}
          placeholder="Hitam / Jumbo"
          required
        />
      </label>
      <label>
        HPP (Rp)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
          required
        />
      </label>
      <label>
        Satuan
        <select value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel(u)}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        Supplier <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opsional)</span>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} disabled={suppliers.length === 0}>
          <option value="">— belum ditentukan —</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="order-preview" style={{ color: 'var(--red)', background: '#fbe9e7' }}>
          {error}
        </div>
      )}

      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Plus size={14} />}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Tambah produk'}
        </button>
      </div>
    </form>
  )
}

// Ditaruh di dalam kartu tiap produk, toggle buka/tutup lewat parent —
// dipakai untuk menambah varian kedua dst. ke produk yang sudah ada.
export function AddVariantForm({ productId, onDone }: { productId: string; onDone: () => void }) {
  const [sku, setSku] = useState('')
  const [variantName, setVariantName] = useState('')
  const [costPrice, setCostPrice] = useState<number | ''>('')
  const [unit, setUnit] = useState<(typeof UNITS)[number]>('pcs')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await addVariant({
        productId,
        sku,
        variantName,
        costPrice: costPrice === '' ? 0 : costPrice,
        unit,
      })
      if (result.ok) {
        onDone()
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Input tidak valid.')
      }
    })
  }

  return (
    <form className="order-form" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: 10 }} onSubmit={handleSubmit}>
      <label>
        SKU
        <input value={sku} onChange={(e) => setSku(e.target.value)} required autoFocus />
      </label>
      <label>
        Nama varian
        <input value={variantName} onChange={(e) => setVariantName(e.target.value)} required />
      </label>
      <label>
        HPP (Rp)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
          required
        />
      </label>
      <label>
        Satuan
        <select value={unit} onChange={(e) => setUnit(e.target.value as (typeof UNITS)[number])}>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {unitLabel(u)}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="order-preview" style={{ gridColumn: '1 / -1', color: 'var(--red)', background: '#fbe9e7' }}>
          {error}
        </div>
      )}

      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : <Plus size={14} />}
          {isPending ? 'Menyimpan…' : 'Tambah varian'}
        </button>
        <button type="button" className="secondary-button" onClick={onDone}>
          Batal
        </button>
      </div>
    </form>
  )
}
