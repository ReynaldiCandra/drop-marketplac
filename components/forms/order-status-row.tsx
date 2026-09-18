'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { updateOrderStatus } from '@/lib/actions/orders'
import { paymentMethodLabel, unitLabel } from '@/lib/store-labels'
import { formatRupiahPenuh } from '@/lib/format'
import type { ProcessingOrder } from '@/lib/queries'

export function OrderStatusRow({ order }: { order: ProcessingOrder }) {
  const [isPending, startTransition] = useTransition()

  function handleUpdate(status: 'terkirim' | 'cancel' | 'retur') {
    startTransition(async () => {
      await updateOrderStatus({ orderId: order.id, status })
    })
  }

  return (
    <tr>
      <td className="number">{order.order_date.slice(5).split('-').reverse().join('/')}</td>
      <td>
        <strong style={{ fontSize: 11, fontWeight: 600 }}>{order.store_name}</strong>
      </td>
      <td>
        <span>{order.product_name}</span>
        <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9, marginTop: 3 }}>
          {order.variant_name} · {order.sku}
        </small>
        {order.payment_method === 'cod' && (order.buyer_phone || order.buyer_region) && (
          <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9, marginTop: 1 }}>
            {order.buyer_phone}
            {order.buyer_phone && order.buyer_region ? ' · ' : ''}
            {order.buyer_region}
          </small>
        )}
      </td>
      <td className="number">
        {order.qty} {unitLabel(order.unit)}
      </td>
      <td className="number">{formatRupiahPenuh(order.unit_price * order.qty)}</td>
      <td>{paymentMethodLabel(order.payment_method)}</td>
      <td>{order.campaign_name ?? <span style={{ color: 'var(--muted)' }}>Organik</span>}</td>
      <td>
        {isPending ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <div className="order-status-actions">
            <button
              type="button"
              className="status-action-btn terkirim"
              onClick={() => handleUpdate('terkirim')}
              disabled={isPending}
            >
              Terkirim
            </button>
            <button
              type="button"
              className="status-action-btn retur"
              onClick={() => handleUpdate('retur')}
              disabled={isPending}
            >
              Retur
            </button>
            <button
              type="button"
              className="status-action-btn cancel"
              onClick={() => handleUpdate('cancel')}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}
