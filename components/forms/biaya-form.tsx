'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import {
  createCampaign,
  setCampaignActive,
  createAdSpend,
  deleteAdSpend,
  createExpense,
  deleteExpense,
} from '@/lib/actions/biaya'
import { adPlatformLabel } from '@/lib/store-labels'
import { formatRupiahPenuh } from '@/lib/format'
import type { BiayaStore, BiayaCampaign, AdSpendLogRow, ExpenseLogRow } from '@/lib/queries'

const PLATFORMS = ['meta_ads', 'google_ads', 'tiktok_ads', 'lainnya'] as const

// ---------------------------------------------------------------------------
// Tambah campaign baru
// ---------------------------------------------------------------------------
export function CampaignForm({ stores }: { stores: BiayaStore[] }) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('meta_ads')
  const [name, setName] = useState('')
  const [campaignType, setCampaignType] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createCampaign({ storeId, platform, name, campaignType })
      if (result.ok) {
        setName('')
        setCampaignType('')
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
        Toko
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} required>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Platform
        <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {adPlatformLabel(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        Nama campaign
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Promo Akhir Bulan" required />
      </label>
      <label>
        Jenis <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opsional)</span>
        <input
          value={campaignType}
          onChange={(e) => setCampaignType(e.target.value)}
          placeholder="leads / konversi / traffic"
        />
      </label>
      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Plus size={14} />}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Tambah campaign'}
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

// ---------------------------------------------------------------------------
// Daftar campaign — aktif/nonaktifkan tanpa hapus (data histori tetap perlu
// tersambung ke orders lama).
// ---------------------------------------------------------------------------
export function CampaignList({ campaigns }: { campaigns: BiayaCampaign[] }) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function handleToggle(campaignId: string, next: boolean) {
    setPendingId(campaignId)
    startTransition(async () => {
      await setCampaignActive({ campaignId, isActive: next })
      setPendingId(null)
    })
  }

  if (campaigns.length === 0) {
    return <div className="empty-state">Belum ada campaign. Tambahkan lewat form di atas.</div>
  }

  return (
    <div className="table-scroll" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <th>TOKO</th>
            <th>PLATFORM</th>
            <th>CAMPAIGN</th>
            <th>JENIS</th>
            <th>STATUS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>{c.store_name}</td>
              <td>{adPlatformLabel(c.platform)}</td>
              <td>
                <strong>{c.name}</strong>
              </td>
              <td>{c.campaign_type ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
              <td>{c.is_active ? <b className="done">Aktif</b> : <b className="partial">Nonaktif</b>}</td>
              <td>
                <button
                  type="button"
                  className="text-button"
                  disabled={isPending && pendingId === c.id}
                  onClick={() => handleToggle(c.id, !c.is_active)}
                >
                  {isPending && pendingId === c.id ? (
                    <Loader2 size={13} className="spin" />
                  ) : c.is_active ? (
                    'Nonaktifkan'
                  ) : (
                    'Aktifkan'
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Input ad spend harian — campaign opsional (bisa level toko saja).
// ---------------------------------------------------------------------------
export function AdSpendForm({
  stores,
  campaignsByStore,
  defaultDate,
}: {
  stores: BiayaStore[]
  campaignsByStore: Record<string, BiayaCampaign[]>
  defaultDate: string
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? '')
  const [campaignId, setCampaignId] = useState('')
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>('meta_ads')
  const [bizDate, setBizDate] = useState(defaultDate)
  const [amount, setAmount] = useState(0)
  const [leadsCount, setLeadsCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const campaigns = (campaignsByStore[storeId] ?? []).filter((c) => c.is_active)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createAdSpend({
        storeId,
        campaignId,
        platform,
        bizDate,
        amount,
        leadsCount,
      })
      if (result.ok) {
        setAmount(0)
        setLeadsCount(0)
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
        <input type="date" value={bizDate} onChange={(e) => setBizDate(e.target.value)} required />
      </label>
      <label>
        Toko
        <select
          value={storeId}
          onChange={(e) => {
            setStoreId(e.target.value)
            setCampaignId('')
          }}
          required
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Platform
        <select value={platform} onChange={(e) => setPlatform(e.target.value as typeof platform)}>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {adPlatformLabel(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="span-2">
        Campaign <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opsional)</span>
        <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} disabled={campaigns.length === 0}>
          <option value="">Level toko saja (tidak dipecah per campaign)</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Spend (Rp)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          required
        />
      </label>
      <label>
        Leads
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={leadsCount}
          onChange={(e) => setLeadsCount(Math.max(0, Number(e.target.value) || 0))}
        />
      </label>
      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Plus size={14} />}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Catat spend'}
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

// ---------------------------------------------------------------------------
// Input biaya operasional — store opsional (kosong = biaya bersama).
// ---------------------------------------------------------------------------
export function ExpenseForm({ stores, defaultDate }: { stores: BiayaStore[]; defaultDate: string }) {
  const [storeId, setStoreId] = useState('')
  const [bizDate, setBizDate] = useState(defaultDate)
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState(0)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await createExpense({ storeId, bizDate, category, amount, notes })
      if (result.ok) {
        setCategory('')
        setAmount(0)
        setNotes('')
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
        <input type="date" value={bizDate} onChange={(e) => setBizDate(e.target.value)} required />
      </label>
      <label>
        Toko <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(kosong = biaya bersama)</span>
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)}>
          <option value="">Biaya bersama</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kategori
        <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Kemasan, admin, dll" required />
      </label>
      <label>
        Jumlah (Rp)
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          required
        />
      </label>
      <label className="span-2">
        Catatan <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(opsional)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsional" />
      </label>
      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : <Plus size={14} />}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Catat biaya'}
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

// ---------------------------------------------------------------------------
// Log ad spend & expenses -- baris terakhir, dengan tombol hapus untuk
// koreksi (bukan upsert, karena bisa lebih dari satu entry per hari).
// ---------------------------------------------------------------------------
export function AdSpendLog({ rows }: { rows: AdSpendLogRow[] }) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function handleDelete(id: string) {
    setPendingId(id)
    startTransition(async () => {
      await deleteAdSpend(id)
      setPendingId(null)
    })
  }

  if (rows.length === 0) return <div className="empty-state">Belum ada catatan spend di periode ini.</div>

  return (
    <div className="table-scroll" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <th>TGL</th>
            <th>TOKO</th>
            <th>PLATFORM</th>
            <th>CAMPAIGN</th>
            <th>SPEND</th>
            <th>LEADS</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="number">{row.biz_date.slice(5).split('-').reverse().join('/')}</td>
              <td>{row.store_name}</td>
              <td>{adPlatformLabel(row.platform)}</td>
              <td>{row.campaign_name ?? <span style={{ color: 'var(--muted)' }}>Level toko</span>}</td>
              <td className="number">{formatRupiahPenuh(row.amount)}</td>
              <td className="number">{row.leads_count}</td>
              <td>
                <button
                  type="button"
                  className="text-button"
                  disabled={isPending && pendingId === row.id}
                  onClick={() => handleDelete(row.id)}
                  title="Hapus"
                >
                  {isPending && pendingId === row.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ExpenseLog({ rows }: { rows: ExpenseLogRow[] }) {
  const [isPending, startTransition] = useTransition()
  const [pendingId, setPendingId] = useState<string | null>(null)

  function handleDelete(id: string) {
    setPendingId(id)
    startTransition(async () => {
      await deleteExpense(id)
      setPendingId(null)
    })
  }

  if (rows.length === 0) return <div className="empty-state">Belum ada biaya tercatat di periode ini.</div>

  return (
    <div className="table-scroll" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <th>TGL</th>
            <th>TOKO</th>
            <th>KATEGORI</th>
            <th>JUMLAH</th>
            <th>CATATAN</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="number">{row.biz_date.slice(5).split('-').reverse().join('/')}</td>
              <td>{row.store_name ?? <span style={{ color: 'var(--muted)' }}>Biaya bersama</span>}</td>
              <td>{row.category}</td>
              <td className="number">{formatRupiahPenuh(row.amount)}</td>
              <td>{row.notes ?? <span style={{ color: 'var(--muted)' }}>—</span>}</td>
              <td>
                <button
                  type="button"
                  className="text-button"
                  disabled={isPending && pendingId === row.id}
                  onClick={() => handleDelete(row.id)}
                  title="Hapus"
                >
                  {isPending && pendingId === row.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
