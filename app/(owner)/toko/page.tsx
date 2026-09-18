import { getCatalogData } from '@/lib/queries'
import { MobileMenuButton } from '@/components/layout/app-shell'
import { AddProductForm } from '@/components/forms/product-form'
import { ProductCatalogList } from '@/components/forms/product-catalog-list'
import { SupplierQuickForm } from '@/components/forms/supplier-form'
import { StoreFeeEditor, ListingManager } from '@/components/forms/listing-form'

export const dynamic = 'force-dynamic'

export default async function TokoPage() {
  const catalog = await getCatalogData()

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">KATALOG</p>
            <h1>Toko &amp; Produk</h1>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        {/* Fee toko — dasar kalkulator harga jual di panel Listing */}
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Fee marketplace per toko</h3>
              <p>Dipakai kalkulator harga jual supaya margin bersih tercapai persis setelah dipotong fee.</p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <StoreFeeEditor stores={catalog.stores} />
          </div>
        </div>

        {/* Tambah produk baru */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Tambah produk</h3>
              <p>Produk baru dibuat sekaligus dengan varian pertamanya.</p>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <AddProductForm suppliers={catalog.suppliers} />
          </div>
        </div>

        {/* Katalog produk & varian */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Katalog produk ({catalog.products.length})</h3>
              <p>Tambah varian baru atau nonaktifkan produk/varian yang sudah tidak dijual.</p>
            </div>
          </div>
          <ProductCatalogList products={catalog.products} />
        </div>

        {/* Supplier */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Supplier ({catalog.suppliers.length})</h3>
              <p>Tersimpan dengan nomor WA supaya bisa dihubungi langsung.</p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <SupplierQuickForm />
          </div>
          {catalog.suppliers.length > 0 && (
            <div className="table-scroll" style={{ marginTop: 18 }}>
              <table>
                <thead>
                  <tr>
                    <th>NAMA</th>
                    <th>WHATSAPP</th>
                    <th>KOTA</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.suppliers.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.name}</strong>
                      </td>
                      <td className="number">{s.phone}</td>
                      <td>{s.city || '—'}</td>
                      <td>
                        <a
                          className="text-button"
                          href={`https://wa.me/${s.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Chat WA
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Listing harga per toko — ini yang membuka Form Order & Live Selling */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Listing harga per toko</h3>
              <p>
                Varian yang belum punya listing aktif di sini tidak akan muncul sebagai pilihan SKU di Form Order
                maupun Live Selling.
              </p>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <ListingManager products={catalog.products} stores={catalog.stores} listings={catalog.listings} />
          </div>
        </div>
      </div>
    </>
  )
}
