'use client'

import { useState, useTransition } from 'react'
import { Plus } from 'lucide-react'
import { setProductActive, setVariantActive } from '@/lib/actions/catalog'
import { unitLabel } from '@/lib/store-labels'
import { formatRupiahPenuh } from '@/lib/format'
import type { CatalogProduct } from '@/lib/queries'
import { AddVariantForm } from './product-form'

export function ProductCatalogList({ products }: { products: CatalogProduct[] }) {
  if (products.length === 0) {
    return <div className="empty-state">Belum ada produk. Tambahkan lewat form di atas.</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 16 }}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const [addingVariant, setAddingVariant] = useState(false)
  const [isPending, startTransition] = useTransition()

  function toggleProduct() {
    startTransition(async () => {
      await setProductActive({ productId: product.id, isActive: !product.is_active })
    })
  }

  function toggleVariant(variantId: string, current: boolean) {
    startTransition(async () => {
      await setVariantActive({ variantId, isActive: !current })
    })
  }

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div className="panel-heading">
        <div>
          <h3>
            {product.name}{' '}
            {!product.is_active && (
              <span className="badge badge-gray" style={{ marginLeft: 6 }}>
                Nonaktif
              </span>
            )}
          </h3>
          <p>{product.category || 'Tanpa kategori'}</p>
        </div>
        <button type="button" className="secondary-button" onClick={toggleProduct} disabled={isPending}>
          {product.is_active ? 'Nonaktifkan produk' : 'Aktifkan produk'}
        </button>
      </div>

      <div className="table-scroll" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>VARIAN</th>
              <th>HPP</th>
              <th>SATUAN</th>
              <th>STATUS</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((v) => (
              <tr key={v.id}>
                <td className="number">{v.sku}</td>
                <td>{v.variant_name}</td>
                <td className="number">{formatRupiahPenuh(v.cost_price)}</td>
                <td>{unitLabel(v.unit)}</td>
                <td>
                  {v.is_active ? (
                    <span className="badge badge-green">Aktif</span>
                  ) : (
                    <span className="badge badge-gray">Nonaktif</span>
                  )}
                </td>
                <td>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => toggleVariant(v.id, v.is_active)}
                    disabled={isPending}
                  >
                    {v.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addingVariant ? (
        <AddVariantForm productId={product.id} onDone={() => setAddingVariant(false)} />
      ) : (
        <button type="button" className="text-button" style={{ marginTop: 12 }} onClick={() => setAddingVariant(true)}>
          <Plus size={12} /> Tambah varian
        </button>
      )}
    </div>
  )
}
