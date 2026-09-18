import { getAppSettings, getStoreSettings } from '@/lib/queries'
import { MobileMenuButton } from '@/components/layout/app-shell'
import { BrandingForm, StoreModeList } from '@/components/forms/settings-form'

export const dynamic = 'force-dynamic'

export default async function PengaturanPage() {
  const [settings, stores] = await Promise.all([getAppSettings(), getStoreSettings()])

  return (
    <>
      <header className="topbar">
        <div className="topbar-left">
          <MobileMenuButton />
          <div>
            <p className="eyebrow">PENGATURAN</p>
            <h1>Tampilan &amp; pencatatan</h1>
          </div>
        </div>
      </header>

      <div className="content-wrap">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Identitas dashboard</h3>
              <p>
                Ganti nama, warna, dan modul yang tampil — dipakai saat mendemokan dashboard ini ke
                calon klien dengan brand mereka sendiri.
              </p>
            </div>
          </div>
          <div style={{ marginTop: 18 }}>
            <BrandingForm settings={settings} />
          </div>
        </div>

        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-heading">
            <div>
              <h3>Mode pencatatan per toko</h3>
              <p>Menentukan dari mana angka omzet toko itu diambil. Satu toko hanya punya satu sumber.</p>
            </div>
          </div>

          <div className="order-preview" style={{ display: 'block', marginTop: 14 }}>
            <p style={{ margin: 0, fontSize: 12 }}>
              <strong>Rekap harian</strong> — toko muncul di menu Input Harian. Kamu isi omzet sekali
              sehari dari laporan marketplace. Cocok untuk Shopee/Lazada/TikTok yang ordernya banyak.
              Profit tidak bisa dihitung di mode ini karena rekap tidak menyimpan HPP.
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12 }}>
              <strong>Per order</strong> — toko muncul di menu Pesanan. Tiap closing dicatat satu per
              satu lengkap dengan campaign asal, metode bayar, dan status kirim. Cocok untuk closing
              dari iklan Meta, DM, atau reseller. Profit dan ROAS bisa dihitung akurat di mode ini.
            </p>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>
              Mengubah mode tidak menghapus data lama. Tapi angka lama dari sumber yang tidak lagi
              dipakai akan berhenti ikut terhitung di Ringkasan.
            </p>
          </div>

          {stores.length === 0 ? (
            <div className="empty-state">Belum ada toko terdaftar.</div>
          ) : (
            <StoreModeList stores={stores} />
          )}
        </div>
      </div>
    </>
  )
}
