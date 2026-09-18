import { getOrderFormData, getProcessingOrders } from '@/lib/queries'
import { todayJakarta } from '@/lib/format'
import { MobileMenuButton } from '@/components/layout/app-shell'
import { OrderForm } from '@/components/forms/order-form'
import { OrderStatusRow } from '@/components/forms/order-status-row'

export const dynamic = 'force-dynamic'

export default async function PesananPage() {
  const [formData, processingOrders] = await Promise.all([getOrderFormData(true), getProcessingOrders()])

  const hasListings = Object.values(formData.listingsByStore).some((list) => list.length > 0)

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">PESANAN</p>
            <h1>Form Order &amp; Status</h1>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Catat order baru</h3>
              <p>Harga jual &amp; HPP kebawa otomatis dari listing toko. Status awal selalu &quot;Proses&quot;.</p>
            </div>
          </div>
          {hasListings ? (
            <div style={{ marginTop: 18 }}>
              <OrderForm data={formData} defaultDate={todayJakarta()} />
            </div>
          ) : (
            <div className="empty-state">
              Belum ada toko bermode &quot;Per order&quot; yang punya listing aktif. Atur mode toko di
              menu Pengaturan, lalu tambahkan produk &amp; listing di menu Toko &amp; Produk.
            </div>
          )}
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Order &quot;Proses&quot; — semua toko</h3>
              <p>{processingOrders.length} order menunggu status akhir. Klik status untuk mengubah, tanpa input ulang.</p>
            </div>
          </div>

          {processingOrders.length === 0 ? (
            <div className="empty-state">Tidak ada order berstatus &quot;Proses&quot; saat ini.</div>
          ) : (
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>TGL</th>
                    <th>TOKO</th>
                    <th>PRODUK</th>
                    <th>QTY</th>
                    <th>TOTAL</th>
                    <th>BAYAR</th>
                    <th>CAMPAIGN</th>
                    <th>STATUS</th>
                  </tr>
                </thead>
                <tbody>
                  {processingOrders.map((order) => (
                    <OrderStatusRow key={order.id} order={order} />
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
