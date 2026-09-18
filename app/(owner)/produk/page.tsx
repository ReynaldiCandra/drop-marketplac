import { getProductScores } from '@/lib/queries'
import { todayJakarta, firstOfMonthJakarta, formatRupiahRingkas, formatRupiahPenuh } from '@/lib/format'
import { unitLabel } from '@/lib/store-labels'
import { MobileMenuButton } from '@/components/layout/app-shell'

export const dynamic = 'force-dynamic'

const VERDICT_LABEL: Record<string, string> = {
  siap: 'Siap produksi',
  pantau: 'Pantau dulu',
  hentikan: 'Jangan dulu',
  data_kurang: 'Data kurang',
}

const VERDICT_TONE: Record<string, string> = {
  siap: 'done',
  pantau: 'partial',
  hentikan: 'partial',
  data_kurang: 'partial',
}

export default async function ProdukPage() {
  const today = todayJakarta()
  const monthStart = firstOfMonthJakarta()
  const scores = await getProductScores(monthStart, today)

  const siap = scores.filter((s) => s.verdict === 'siap')
  const totalUnits = scores.reduce((sum, s) => sum + s.units_sold, 0)
  const totalProfit = scores.reduce((sum, s) => sum + s.profit, 0)

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">KEPUTUSAN PRODUKSI</p>
            <h1>Skor produk</h1>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        <section className="metric-grid" aria-label="Ringkasan produk">
          <article className="metric-card">
            <div className="metric-top"><span>Unit terjual bulan ini</span></div>
            <div className="metric-value">{totalUnits}</div>
            <div className="metric-bottom"><span>semua produk & kanal</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Profit dari order</span></div>
            <div className="metric-value" title={formatRupiahPenuh(totalProfit)}>
              {formatRupiahRingkas(totalProfit)}
            </div>
            <div className="metric-bottom"><span>order terkirim saja</span></div>
          </article>
          <article className="metric-card">
            <div className="metric-top"><span>Kandidat produksi besar</span></div>
            <div className="metric-value">{siap.length} produk</div>
            <div className="metric-bottom"><span>lolos ambang laku & margin</span></div>
          </article>
        </section>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Peringkat produk — bulan berjalan</h3>
              <p>
                Gabungan penjualan marketplace, iklan, dan live. Urut dari paling laku. Kolom
                &quot;Verdict&quot; adalah saran otomatis, bukan keputusan final.
              </p>
            </div>
          </div>

          {scores.length === 0 ? (
            <div className="empty-state">
              Belum ada varian produk aktif. Tambahkan produk &amp; varian dulu di menu Toko &amp; Produk.
            </div>
          ) : (
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>PRODUK</th>
                    <th>TERJUAL</th>
                    <th>DARI LIVE</th>
                    <th>OMZET</th>
                    <th>PROFIT</th>
                    <th>MARGIN</th>
                    <th>RETUR</th>
                    <th>DARI IKLAN</th>
                    <th>VERDICT</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.map((s) => (
                    <tr key={s.variant_id}>
                      <td>
                        <strong>{s.product_name}</strong>
                        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9, marginTop: 3 }}>
                          {s.variant_name} · {s.sku} · HPP {formatRupiahRingkas(s.cost_price)}
                        </small>
                      </td>
                      <td className="number">
                        {s.units_sold} {unitLabel(s.unit)}
                      </td>
                      <td className="number">{s.units_from_live}</td>
                      <td className="number" title={formatRupiahPenuh(s.revenue)}>
                        {formatRupiahRingkas(s.revenue)}
                      </td>
                      <td className="number" title={formatRupiahPenuh(s.profit)}>
                        {formatRupiahRingkas(s.profit)}
                      </td>
                      <td className="number">
                        {s.margin_pct === null ? '—' : `${s.margin_pct.toFixed(0)}%`}
                      </td>
                      <td className="number">
                        {s.retur_rate === null ? '—' : `${s.retur_rate.toFixed(0)}%`}
                      </td>
                      <td className="number">
                        {s.from_ads_pct === null ? '—' : `${s.from_ads_pct.toFixed(0)}%`}
                      </td>
                      <td>
                        <b className={VERDICT_TONE[s.verdict]} title={s.verdict_reason}>
                          {VERDICT_LABEL[s.verdict]}
                        </b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {siap.length > 0 && (
          <div className="panel" style={{ marginTop: 16 }}>
            <div className="panel-heading">
              <div>
                <h3>Kenapa produk ini direkomendasikan</h3>
                <p>Alasan di balik verdict, supaya keputusannya bisa kamu timbang sendiri.</p>
              </div>
            </div>
            <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
              {siap.map((s) => (
                <div key={s.variant_id} className="order-preview" style={{ display: 'block' }}>
                  <strong>
                    {s.product_name} — {s.variant_name}
                  </strong>
                  <p style={{ margin: '6px 0 0', color: 'var(--muted)', fontSize: 12 }}>
                    {s.verdict_reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
