'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { updateAppSettings, updateStoreTrackingMode } from '@/lib/actions/settings'
import { channelLabel } from '@/lib/store-labels'
import type { AppSettings, StoreSetting } from '@/lib/queries'

// ---------------------------------------------------------------------------
// Branding + modul yang tampil. Ini yang membuat dashboard bisa didemokan ke
// calon klien dengan nama & warna mereka sendiri, tanpa menyentuh kode.
// ---------------------------------------------------------------------------
export function BrandingForm({ settings }: { settings: AppSettings }) {
  const [appName, setAppName] = useState(settings.app_name)
  const [appTagline, setAppTagline] = useState(settings.app_tagline)
  const [brandInitial, setBrandInitial] = useState(settings.brand_initial)
  const [brandColor, setBrandColor] = useState(settings.brand_color)
  const [modules, setModules] = useState({
    showInput: settings.show_input,
    showPesanan: settings.show_pesanan,
    showToko: settings.show_toko,
    showBiaya: settings.show_biaya,
    showLive: settings.show_live,
    showProduk: settings.show_produk,
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggle(key: keyof typeof modules) {
    setModules((m) => ({ ...m, [key]: !m[key] }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await updateAppSettings({
        appName: appName.trim(),
        appTagline: appTagline.trim(),
        brandInitial: brandInitial.trim(),
        brandColor,
        ...modules,
      })
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1800)
      } else {
        setError(typeof result.error === 'string' ? result.error : 'Gagal menyimpan.')
      }
    })
  }

  const moduleList: { key: keyof typeof modules; label: string; note: string }[] = [
    { key: 'showInput', label: 'Input Harian', note: 'rekap omzet manual per toko' },
    { key: 'showPesanan', label: 'Pesanan', note: 'order per transaksi + status kirim' },
    { key: 'showToko', label: 'Toko & Produk', note: 'katalog, supplier, harga jual' },
    { key: 'showBiaya', label: 'Biaya & Iklan', note: 'campaign, ad spend, CPL/ROAS' },
    { key: 'showLive', label: 'Live Selling', note: 'sesi live & performa host' },
    { key: 'showProduk', label: 'Skor Produk', note: 'rekomendasi produksi besar' },
  ]

  return (
    <form className="order-form" onSubmit={handleSubmit}>
      <label>
        Nama aplikasi
        <input value={appName} onChange={(e) => setAppName(e.target.value)} maxLength={60} required />
      </label>

      <label>
        Tagline
        <input
          value={appTagline}
          onChange={(e) => setAppTagline(e.target.value)}
          maxLength={60}
          placeholder="mis. Operational OS"
        />
      </label>

      <label>
        Inisial logo
        <input
          value={brandInitial}
          onChange={(e) => setBrandInitial(e.target.value)}
          maxLength={2}
          placeholder="W"
          required
        />
      </label>

      <label>
        Warna brand
        <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
      </label>

      <div className="span-2">
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', margin: '6px 0 10px' }}>
          MODUL YANG TAMPIL DI SIDEBAR
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {moduleList.map(({ key, label, note }) => (
            <label
              key={key}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flexDirection: 'row', fontWeight: 400 }}
            >
              <input
                type="checkbox"
                checked={modules[key]}
                onChange={() => toggle(key)}
                style={{ width: 'auto', margin: 0 }}
              />
              <span>
                <strong style={{ fontSize: 12 }}>{label}</strong>
                <small style={{ display: 'block', color: 'var(--muted)', fontSize: 10 }}>{note}</small>
              </span>
            </label>
          ))}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 10 }}>
          Mematikan modul hanya menyembunyikannya dari sidebar — datanya tidak dihapus, dan halamannya
          tetap bisa dibuka lewat URL langsung.
        </p>
      </div>

      {error && <div className="order-preview span-2" style={{ color: 'var(--red)', background: '#fbe9e7' }}>{error}</div>}

      <div className="order-form-submit">
        <button type="submit" className="primary-button full" disabled={isPending}>
          {isPending ? <Loader2 size={14} className="spin" /> : saved ? <Check size={14} /> : null}
          {isPending ? 'Menyimpan…' : saved ? 'Tersimpan' : 'Simpan tampilan'}
        </button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Mode pencatatan per toko — pengaturan paling berdampak, jadi diberi
// penjelasan panjang di halamannya, bukan cuma dropdown telanjang.
// ---------------------------------------------------------------------------
export function StoreModeList({ stores }: { stores: StoreSetting[] }) {
  return (
    <div className="table-scroll" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <th>TOKO</th>
            <th>FEE MARKETPLACE</th>
            <th>MODE PENCATATAN</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => (
            <StoreModeRow key={store.id} store={store} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StoreModeRow({ store }: { store: StoreSetting }) {
  const [mode, setMode] = useState(store.tracking_mode)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleChange(next: 'rekap_harian' | 'per_order') {
    const previous = mode
    setMode(next)
    startTransition(async () => {
      const result = await updateStoreTrackingMode({ storeId: store.id, mode: next })
      if (result.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      } else {
        setMode(previous) // gagal simpan -> kembalikan tampilan ke nilai sebenarnya
      }
    })
  }

  const totalFee = Number(store.default_commission_pct) + Number(store.default_service_fee_pct)

  return (
    <tr>
      <td>
        <strong>{store.display_name}</strong>
        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9, marginTop: 3 }}>
          {channelLabel(store.channel)}
          {!store.is_active && ' · nonaktif'}
        </small>
      </td>
      <td className="number">{totalFee.toFixed(1)}%</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={mode}
            onChange={(e) => handleChange(e.target.value as 'rekap_harian' | 'per_order')}
            disabled={isPending}
            style={{ minWidth: 150 }}
          >
            <option value="rekap_harian">Rekap harian</option>
            <option value="per_order">Per order</option>
          </select>
          {isPending && <Loader2 size={13} className="spin" />}
          {saved && !isPending && <Check size={13} style={{ color: 'var(--green, #2f6d5b)' }} />}
        </div>
      </td>
    </tr>
  )
}
