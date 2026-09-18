'use client'

import { useState, useTransition } from 'react'
import { Check, Copy, Loader2 } from 'lucide-react'
import { saveDailyRecap, getRecapForDate } from '@/lib/actions/recap'
import { channelLabel, channelDot, type DailyRecapRow } from '@/lib/store-labels'

type FieldKey =
  | 'grossRevenue'
  | 'ordersCount'
  | 'unitsCount'
  | 'cancelledCount'
  | 'cancelledValue'
  | 'returnedCount'
  | 'returnedValue'
  | 'shippingBorne'
  | 'platformFee'
  | 'voucherCost'

const FIELDS: { key: FieldKey; label: string; short: string }[] = [
  { key: 'grossRevenue', label: 'Omzet kotor', short: 'Omzet' },
  { key: 'ordersCount', label: 'Jumlah order', short: 'Order' },
  { key: 'unitsCount', label: 'Jumlah unit', short: 'Unit' },
  { key: 'cancelledValue', label: 'Nilai batal', short: 'Batal' },
  { key: 'returnedValue', label: 'Nilai retur', short: 'Retur' },
  { key: 'shippingBorne', label: 'Ongkir ditanggung', short: 'Ongkir' },
  { key: 'voucherCost', label: 'Voucher seller', short: 'Voucher' },
]

function toFormState(row: DailyRecapRow | undefined) {
  return {
    grossRevenue: row?.gross_revenue ?? 0,
    ordersCount: row?.orders_count ?? 0,
    unitsCount: row?.units_count ?? 0,
    cancelledCount: row?.cancelled_count ?? 0,
    cancelledValue: row?.cancelled_value ?? 0,
    returnedCount: row?.returned_count ?? 0,
    returnedValue: row?.returned_value ?? 0,
    shippingBorne: row?.shipping_borne ?? 0,
    platformFee: row?.platform_fee ?? 0,
    voucherCost: row?.voucher_cost ?? 0,
  }
}

export function DailyRecapRowForm({
  storeId,
  displayName,
  channel,
  bizDate,
  initial,
}: {
  storeId: string
  displayName: string
  channel: string
  bizDate: string
  initial: DailyRecapRow | undefined
}) {
  const [values, setValues] = useState(toFormState(initial))
  const [status, setStatus] = useState<'kosong' | 'sebagian' | 'lengkap'>(initial?.status ?? 'kosong')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function persist(next: typeof values) {
    startTransition(async () => {
      const result = await saveDailyRecap({ storeId, bizDate, ...next })
      if (result.ok) {
        setStatus(result.status)
        setSaved(true)
        setTimeout(() => setSaved(false), 1500)
      }
    })
  }

  function handleBlur() {
    persist(values)
  }

  function handleChange(key: FieldKey, raw: string) {
    const num = raw === '' ? 0 : Number(raw.replace(/[^0-9]/g, ''))
    setValues((prev) => ({ ...prev, [key]: num }))
  }

  async function handleCopyYesterday() {
    const y = new Date(bizDate)
    y.setDate(y.getDate() - 1)
    const yesterday = y.toISOString().slice(0, 10)
    const prevRow = await getRecapForDate(storeId, yesterday)
    if (!prevRow) return
    const next = toFormState({
      store_id: storeId,
      gross_revenue: prevRow.gross_revenue,
      orders_count: prevRow.orders_count,
      units_count: prevRow.units_count,
      cancelled_count: prevRow.cancelled_count,
      cancelled_value: prevRow.cancelled_value,
      returned_count: prevRow.returned_count,
      returned_value: prevRow.returned_value,
      shipping_borne: prevRow.shipping_borne,
      platform_fee: prevRow.platform_fee,
      voucher_cost: prevRow.voucher_cost,
      status: prevRow.status,
    })
    setValues(next)
    persist(next)
  }

  return (
    <tr className={`recap-row status-${status}`}>
      <td>
        <div className="shop-name">
          <span className={`channel-dot ${channelDot(channel)}`} />
          <span>
            <strong>{displayName}</strong>
            <small>{channelLabel(channel)}</small>
          </span>
        </div>
      </td>
      {FIELDS.map((field) => (
        <td key={field.key}>
          <input
            className="recap-input"
            inputMode="numeric"
            value={values[field.key] === 0 ? '' : values[field.key]}
            placeholder="0"
            aria-label={`${field.label} — ${displayName}`}
            onChange={(e) => handleChange(field.key, e.target.value)}
            onBlur={handleBlur}
          />
        </td>
      ))}
      <td>
        <div className="recap-row-actions">
          <button type="button" className="icon-button small" title="Salin dari kemarin" onClick={handleCopyYesterday}>
            <Copy size={14} />
          </button>
          <span className="recap-save-indicator">
            {isPending ? (
              <Loader2 size={14} className="spin" />
            ) : saved ? (
              <Check size={14} color="var(--green)" />
            ) : null}
          </span>
        </div>
      </td>
    </tr>
  )
}
