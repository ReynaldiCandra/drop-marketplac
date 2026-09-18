import Link from 'next/link'
import { CalendarDays } from 'lucide-react'
import { getActiveStoresForInput, getRecapMapForDate } from '@/lib/queries'
import { yesterdayJakarta, formatDateLong } from '@/lib/format'
import { MobileMenuButton } from '@/components/layout/app-shell'
import { DailyRecapRowForm } from '@/components/forms/daily-recap-row'

export const dynamic = 'force-dynamic'

const FIELD_HEADERS = ['Omzet kotor', 'Order', 'Unit', 'Batal (Rp)', 'Retur (Rp)', 'Ongkir', 'Voucher']

export default async function InputHarianPage({
  searchParams,
}: {
  searchParams: Promise<{ tanggal?: string }>
}) {
  const params = await searchParams
  // Default kemarin — sesuai P1/§10.2, karena rekap biasanya diinput pagi untuk hari sebelumnya.
  const bizDate = params.tanggal ?? yesterdayJakarta()

  const [stores, recapMap] = await Promise.all([
    getActiveStoresForInput(),
    getRecapMapForDate(bizDate),
  ])

  const doneCount = [...recapMap.values()].filter((r) => r.status === 'lengkap').length

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">INPUT HARIAN</p>
            <h1>Rekap penjualan — {formatDateLong(bizDate)}</h1>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        <div className="input-toolbar">
          <form className="period-select" method="get">
            <CalendarDays size={16} />
            <input
              type="date"
              name="tanggal"
              defaultValue={bizDate}
              aria-label="Pilih tanggal"
              style={{ border: 0, background: 'transparent', fontSize: 12, color: 'inherit' }}
            />
            <button type="submit" className="text-button" style={{ fontSize: 11 }}>
              Terapkan
            </button>
          </form>
        </div>

        {stores.length === 0 ? (
          <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
            <h3>Belum ada toko terdaftar</h3>
            <p className="modal-copy">Jalankan <code>supabase/seed.sql</code> dulu.</p>
          </div>
        ) : (
          <div className="panel">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>TOKO</th>
                    {FIELD_HEADERS.map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store) => (
                    <DailyRecapRowForm
                      key={store.id}
                      storeId={store.id}
                      displayName={store.display_name}
                      channel={store.channel}
                      bizDate={bizDate}
                      initial={recapMap.get(store.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {stores.length > 0 && (
          <div className="input-summary-banner">
            <span>
              <strong>{doneCount} dari {stores.length}</strong> toko sudah lengkap untuk tanggal ini
            </span>
            <Link className="text-button" href="/dashboard">
              Lihat ringkasan →
            </Link>
          </div>
        )}
      </div>
    </>
  )
}
