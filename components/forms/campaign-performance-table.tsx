import { adPlatformLabel } from '@/lib/store-labels'
import { formatRupiahPenuh } from '@/lib/format'
import type { BiayaCampaign, CampaignPerformance } from '@/lib/queries'

export function CampaignPerformanceTable({
  campaigns,
  performanceByCampaign,
}: {
  campaigns: BiayaCampaign[]
  performanceByCampaign: Record<string, CampaignPerformance>
}) {
  const rows = campaigns
    .map((c) => ({ campaign: c, perf: performanceByCampaign[c.id] }))
    .filter((r) => r.perf) // campaign tanpa spend/order di periode ini tidak perlu tampil

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        Belum ada spend atau order yang terhubung ke campaign di periode ini.
      </div>
    )
  }

  return (
    <div className="table-scroll" style={{ marginTop: 16 }}>
      <table>
        <thead>
          <tr>
            <th>CAMPAIGN</th>
            <th>TOKO</th>
            <th>SPEND</th>
            <th>LEADS</th>
            <th>CLOSING</th>
            <th>CPL</th>
            <th>CPO</th>
            <th>REVENUE</th>
            <th>ROAS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ campaign, perf }) => (
            <tr key={campaign.id}>
              <td>
                <strong>{campaign.name}</strong>
                <small style={{ display: 'block', color: 'var(--muted)', fontSize: 9, marginTop: 3 }}>
                  {adPlatformLabel(campaign.platform)}
                </small>
              </td>
              <td>{campaign.store_name}</td>
              <td className="number">{formatRupiahPenuh(perf.spend)}</td>
              <td className="number">{perf.leads}</td>
              <td className="number">{perf.closing_count}</td>
              <td className="number">{perf.cpl !== null ? formatRupiahPenuh(perf.cpl) : '—'}</td>
              <td className="number">{perf.cpo !== null ? formatRupiahPenuh(perf.cpo) : '—'}</td>
              <td className="number">{formatRupiahPenuh(perf.revenue)}</td>
              <td className="number">
                {perf.roas !== null ? (
                  <b className={perf.roas >= 1 ? 'done' : 'partial'}>{perf.roas.toFixed(2)}x</b>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
