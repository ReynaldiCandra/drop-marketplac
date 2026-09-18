import { getBiayaPageData } from '@/lib/queries'
import { todayJakarta, firstOfMonthJakarta, formatRupiahPenuh } from '@/lib/format'
import { MobileMenuButton } from '@/components/layout/app-shell'
import { CampaignForm, CampaignList, AdSpendForm, ExpenseForm, AdSpendLog, ExpenseLog } from '@/components/forms/biaya-form'
import { CampaignPerformanceTable } from '@/components/forms/campaign-performance-table'

export const dynamic = 'force-dynamic'

export default async function BiayaPage() {
  const today = todayJakarta()
  const monthStart = firstOfMonthJakarta()
  const data = await getBiayaPageData(monthStart, today)

  const campaignsByStore: Record<string, typeof data.campaigns> = {}
  for (const c of data.campaigns) {
    ;(campaignsByStore[c.store_id] ??= []).push(c)
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">IKLAN & BIAYA</p>
            <h1>Biaya & Iklan</h1>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        {/* Ringkasan bulan berjalan */}
        <section className="metric-grid" aria-label="Ringkasan biaya bulan ini">
          <article className="metric-card">
            <div className="metric-top">
              <span>Total ad spend bulan ini</span>
            </div>
            <div className="metric-value">{formatRupiahPenuh(data.totalSpend)}</div>
            <div className="metric-bottom">
              <span>sejak tanggal 1</span>
            </div>
          </article>
          <article className="metric-card">
            <div className="metric-top">
              <span>Total biaya operasional</span>
            </div>
            <div className="metric-value">{formatRupiahPenuh(data.totalExpenses)}</div>
            <div className="metric-bottom">
              <span>sejak tanggal 1</span>
            </div>
          </article>
        </section>

        {/* Performa campaign */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Performa campaign — bulan berjalan</h3>
              <p>CPL &amp; CPO dari spend + leads. ROAS dihitung dari order yang sudah &quot;Terkirim&quot; saja.</p>
            </div>
          </div>
          <CampaignPerformanceTable campaigns={data.campaigns} performanceByCampaign={data.performanceByCampaign} />
        </div>

        {/* Tambah campaign */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Tambah campaign</h3>
              <p>Satu campaign selalu milik satu toko.</p>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <CampaignForm stores={data.stores} />
          </div>
          <CampaignList campaigns={data.campaigns} />
        </div>

        {/* Ad spend harian */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Catat ad spend harian</h3>
              <p>Bisa diikat ke campaign spesifik, atau level toko saja kalau belum dipecah.</p>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <AdSpendForm stores={data.stores} campaignsByStore={campaignsByStore} defaultDate={today} />
          </div>
          <AdSpendLog rows={data.adSpendLog} />
        </div>

        {/* Biaya operasional */}
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Biaya operasional</h3>
              <p>Gaji admin, kemasan, langganan tools, dll — bukan HPP, bukan ad spend.</p>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <ExpenseForm stores={data.stores} defaultDate={today} />
          </div>
          <ExpenseLog rows={data.expenseLog} />
        </div>
      </div>
    </>
  )
}
