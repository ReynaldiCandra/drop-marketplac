'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'
import { createSupplier } from '@/lib/actions/catalog'

export function SupplierQuickForm() {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createSupplier({ name, phone, city, notes: '' })
      if (result.ok) {
        setName('')
        setPhone('')
        setCity('')
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Input tidak valid.')
      }
    })
  }

  return (
    <form className="order-form" style={{ gridTemplateColumns: 'repeat(4,1fr)' }} onSubmit={handleSubmit}>
      <label>
        Nama supplier
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Konveksi Rekan" required />
      </label>
      <label>
        No. WhatsApp
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="62812xxxxxxx"
          inputMode="numeric"
          required
        />
      </label>
      <label>
        Kota <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opsional)</span>
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Bandung" />
      </label>
      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Plus size={14} />}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Tambah supplier'}
        </button>
      </div>
      {error && (
        <div className="order-preview" style={{ gridColumn: '1 / -1', color: 'var(--red)', background: '#fbe9e7' }}>
          {error}
        </div>
      )}
    </form>
  )
}
