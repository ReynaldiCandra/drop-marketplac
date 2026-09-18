import Link from 'next/link'
import { ArrowUpRight, CalendarDays, Clock3, ShoppingBag, Store as StoreIcon } from 'lucide-react'
import {
  getStoresWithRecapForDate,
  getNetRevenueTotal,
  getDailyNetRevenueTrend,
  channelLabel,
  channelDot,
} from '@/lib/queries'
import { todayJakarta, firstOfMonthJakarta, formatDateLong, formatRupiahRingkas, formatRupiahPenuh } from '@/lib/format'
import { MobileMenuButton } from '@/components/layout/app-shell'
import { RevenueTrendChart } from '@/components/charts/revenue-trend-chart'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const today = todayJakarta()
  const monthStart = firstOfMonthJakarta()

  const [stores, monthNet, trend] = await Promise.all([
    getStoresWithRecapForDate(today),
    getNetRevenueTotal(monthStart, today),
    getDailyNetRevenueTrend(monthStart, today),
  ])

  const todayNet = stores.reduce((sum, s) => sum + s.net_revenue, 0)
  const todayPending = stores.reduce((sum, s) => sum + s.pending_revenue, 0)
  // Profit hanya tersedia dari toko mode per-order (rekap harian tidak
  // menyimpan HPP) -- ditandai jelas di UI supaya tidak disangka profit total.
  const perOrderStores = stores.filter((s) => s.tracking_mode === 'per_order')
  const todayProfit = perOrderStores.reduce((sum, s) => sum + (s.profit ?? 0), 0)
  const doneCount = stores.filter((s) => s.status === 'lengkap').length
  const notStartedCount = stores.filter((s) => s.status === 'kosong').length

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">{formatDateLong(today).toUpperCase()}</p>
            <h1>Ringkasan operasional</h1>
          </div>
        </div>
        <div className="topbar-actions">
          <Link className="primary-button" href="/input">
            <CalendarDays size={17} /> Input harian
          </Link>
        </div>
      </header>

      <div className="content-wrap">
        {stores.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <section className="metric-grid" aria-label="Metrik utama">
              <MetricCard
                label="Omzet bersih hari ini"
                value={formatRupiahRingkas(todayNet)}
                title={formatRupiahPenuh(todayNet)}
                note={`dari ${stores.length} toko`}
                icon={ShoppingBag}
              />
              <MetricCard
                label="Omzet bersih bulan ini"
                value={formatRupiahRingkas(monthNet)}
                title={formatRupiahPenuh(monthNet)}
                note="sejak tanggal 1"
                icon={StoreIcon}
              />
              <MetricCard
                label="Profit hari ini"
                value={formatRupiahRingkas(todayProfit)}
                title={formatRupiahPenuh(todayProfit)}
                note={
                  perOrderStores.length > 0
                    ? `dari ${perOrderStores.length} toko mode per-order`
                    : 'belum ada toko mode per-order'
                }
                icon={ShoppingBag}
              />
              <MetricCard
                label="Menunggu status"
                value={formatRupiahRingkas(todayPending)}
                title={formatRupiahPenuh(todayPending)}
                note="order proses, belum jadi omzet"
                icon={Clock3}
              />
              <MetricCard
                label="Belum diinput"
                value={`${notStartedCount} toko`}
                note={`${doneCount} dari ${stores.length} sudah terisi`}
                icon={CalendarDays}
                warning={notStartedCount > 0}
              />
            </section>

            <section className="dashboard-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel revenue-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Omzet bersih harian</h3>
                    <p>Gabungan semua toko, bulan berjalan</p>
                  </div>
                </div>
                <RevenueTrendChart data={trend} startDate={monthStart} endDate={today} />
              </div>
            </section>

            <section className="dashboard-grid lower-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="panel shops-panel">
                <div className="panel-heading">
                  <div>
                    <h3>Performa toko hari ini</h3>
                    <p>
                      Tiap toko dihitung dari satu sumber saja sesuai modenya — tidak ada angka
                      yang terhitung dua kali.
                    </p>
                  </div>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>TOKO</th>
                        <th>MODE</th>
                        <th>OMZET BERSIH</th>
                        <th>PROFIT</th>
                        <th>STATUS</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((store) => (
                        <tr key={store.id}>
                          <td>
                            <div className="shop-name">
                              <span className={`channel-dot ${channelDot(store.channel)}`} />
                              <span>
                                <strong>{store.display_name}</strong>
                                <small>{channelLabel(store.channel)}</small>
                              </span>
                            </div>
                          </td>
                          <td>
                            <small style={{ color: 'var(--muted)', fontSize: 10 }}>
                              {store.tracking_mode === 'per_order' ? 'Per order' : 'Rekap harian'}
                            </small>
                          </td>
                          <td className="number" title={formatRupiahPenuh(store.net_revenue)}>
                            {formatRupiahRingkas(store.net_revenue)}
                          </td>
                          <td className="number" title={store.profit === null ? undefined : formatRupiahPenuh(store.profit)}>
                            {store.profit === null ? (
                              <span style={{ color: 'var(--muted)' }} title="Mode rekap harian tidak menyimpan HPP">
                                —
                              </span>
                            ) : (
                              formatRupiahRingkas(store.profit)
                            )}
                          </td>
                          <td>
                            <StatusBadge status={store.status} />
                          </td>
                          <td>
                            <Link
                              className="text-button"
                              href={store.tracking_mode === 'per_order' ? '/pesanan' : '/input'}
                            >
                              Input <ArrowUpRight size={14} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}

function StatusBadge({ status }: { status: 'kosong' | 'sebagian' | 'lengkap' }) {
  if (status === 'lengkap') return <b className="done">Lengkap</b>
  if (status === 'sebagian') return <b className="partial">Sebagian</b>
  return <b className="partial" style={{ color: 'var(--muted)' }}>Belum diisi</b>
}

function MetricCard({
  label,
  value,
  note,
  icon: Icon,
  warning = false,
  title,
}: {
  label: string
  value: string
  note: string
  icon: typeof ShoppingBag
  warning?: boolean
  title?: string
}) {
  return (
    <article className={`metric-card ${warning ? 'warning-card' : ''}`} title={title}>
      <div className="metric-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={17} />
        </span>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-bottom">
        <span>{note}</span>
      </div>
    </article>
  )
}

function EmptyState() {
  return (
    <div className="panel" style={{ padding: 48, textAlign: 'center' }}>
      <h3 style={{ marginBottom: 8 }}>Belum ada toko terdaftar</h3>
      <p className="modal-copy" style={{ margin: '0 auto 20px', maxWidth: 380 }}>
        Jalankan <code>supabase/seed.sql</code> untuk mengisi 7 toko awal, atau tambahkan toko
        lewat halaman Toko & Produk.
      </p>
    </div>
  )
}
