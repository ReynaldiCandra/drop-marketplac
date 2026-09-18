import { getOrderFormData, getLiveSessions, getHostPerformance } from '@/lib/queries'
import { todayJakarta, firstOfMonthJakarta, formatRupiahRingkas, formatRupiahPenuh } from '@/lib/format'
import { channelLabel } from '@/lib/store-labels'
import { MobileMenuButton } from '@/components/layout/app-shell'
import { LiveSessionForm } from '@/components/forms/live-session-form'

export const dynamic = 'force-dynamic'

export default async function LiveSellingPage() {
  const [formData, sessions, hosts] = await Promise.all([
    getOrderFormData(),
    getLiveSessions(),
    getHostPerformance(firstOfMonthJakarta(), todayJakarta()),
  ])

  const hasListings = Object.values(formData.listingsByStore).some((list) => list.length > 0)

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">LIVE SELLING</p>
            <h1>Log sesi live</h1>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Catat sesi live</h3>
              <p>Input manual — host tidak login, semua dicatat owner di sini.</p>
            </div>
          </div>
          {hasListings ? (
            <div style={{ marginTop: 18 }}>
              <LiveSessionForm data={formData} defaultDate={todayJakarta()} />
            </div>
          ) : (
            <div className="empty-state">
              Belum ada listing aktif di toko manapun. Tambahkan produk, varian, dan listing toko dulu di
              menu Toko &amp; Produk.
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Performa host — bulan berjalan</h3>
              <p>
                Fee per unit adalah angka penentu: kalau lebih besar dari margin per unit produk,
                sesi live-nya rugi meski terlihat ramai.
              </p>
            </div>
          </div>

          {hosts.length === 0 ? (
            <div className="empty-state">Belum ada sesi live bulan ini.</div>
          ) : (
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>HOST</th>
                    <th>SESI</th>
                    <th>JAM</th>
                    <th>PENONTON</th>
                    <th>TERJUAL</th>
                    <th>CLOSE RATE</th>
                    <th>UNIT/JAM</th>
                    <th>TOTAL FEE</th>
                    <th>FEE/UNIT</th>
                  </tr>
                </thead>
                <tbody>
                  {hosts.map((h) => (
                    <tr key={h.host_name}>
                      <td><strong>{h.host_name}</strong></td>
                      <td className="number">{h.sessions}</td>
                      <td className="number">{(h.total_minutes / 60).toFixed(1)}</td>
                      <td className="number">{h.total_viewers}</td>
                      <td className="number">{h.total_units}</td>
                      <td className="number">
                        {h.close_rate === null ? '—' : `${h.close_rate.toFixed(1)}%`}
                      </td>
                      <td className="number">
                        {h.units_per_hour === null ? '—' : h.units_per_hour.toFixed(1)}
                      </td>
                      <td className="number" title={formatRupiahPenuh(h.total_fee)}>
                        {formatRupiahRingkas(h.total_fee)}
                      </td>
                      <td className="number" title={h.fee_per_unit === null ? undefined : formatRupiahPenuh(h.fee_per_unit)}>
                        {h.fee_per_unit === null ? '—' : formatRupiahRingkas(h.fee_per_unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Riwayat sesi</h3>
              <p>{sessions.length} sesi tercatat, terbaru duluan.</p>
            </div>
          </div>

          {sessions.length === 0 ? (
            <div className="empty-state">Belum ada sesi live yang dicatat.</div>
          ) : (
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>TGL</th>
                    <th>HOST</th>
                    <th>TOKO</th>
                    <th>PRODUK</th>
                    <th>DURASI</th>
                    <th>PENONTON</th>
                    <th>TERJUAL</th>
                    <th>KERANJANG</th>
                    <th>FEE HOST</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td className="number">{s.session_date.slice(5).split('-').reverse().join('/')}</td>
                      <td>
                        <strong style={{ fontSize: 11, fontWeight: 600 }}>{s.host_name}</strong>
                      </td>
                      <td>
                        {s.store_name}
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9, marginTop: 3 }}>
                          {channelLabel(s.channel)}
                        </small>
                      </td>
                      <td>
                        {s.product_name}
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9, marginTop: 3 }}>
                          {s.variant_name} · {s.sku}
                        </small>
                      </td>
                      <td className="number">{s.duration_minutes} mnt</td>
                      <td className="number">{s.viewers_count}</td>
                      <td className="number">{s.units_sold}</td>
                      <td className="number">{s.add_to_cart_count}</td>
                      <td className="number">{formatRupiahRingkas(s.host_fee ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
