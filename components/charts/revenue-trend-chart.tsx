import { formatRupiahRingkas, formatRupiahPenuh } from '@/lib/format'

function eachDate(start: string, end: string): string[] {
  const dates: string[] = []
  const cursor = new Date(start)
  const last = new Date(end)
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function RevenueTrendChart({
  data,
  startDate,
  endDate,
}: {
  data: Map<string, number>
  startDate: string
  endDate: string
}) {
  const dates = eachDate(startDate, endDate)
  const values = dates.map((d) => data.get(d) ?? 0)
  const max = Math.max(...values, 1)

  const width = 600
  const height = 180
  const points = values.map((v, i) => {
    const x = dates.length > 1 ? (i / (dates.length - 1)) * width : 0
    const y = height - (v / max) * height
    return `${x},${y}`
  })

  const hasAnyData = values.some((v) => v > 0)

  if (!hasAnyData) {
    return (
      <div className="chart-empty">
        Belum ada omzet tercatat bulan ini. Grafik muncul otomatis setelah input harian pertama
        disimpan.
      </div>
    )
  }

  const linePath = `M${points.join(' L')}`
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`

  return (
    <div className="chart-wrap">
      <div className="chart">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Grafik omzet bulan berjalan">
          <defs>
            <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#5b3df5" stopOpacity=".18" />
              <stop offset="100%" stopColor="#5b3df5" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#chart-fill)" />
          <path d={linePath} fill="none" stroke="#5b3df5" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-dot purple" />
          Omzet bersih harian
        </span>
        <strong title={formatRupiahPenuh(Math.max(...values))}>
          {formatRupiahRingkas(Math.max(...values))} <small>puncak</small>
        </strong>
      </div>
    </div>
  )
}
