// Semua util di sini pakai zona Asia/Jakarta karena "hari bisnis" terikat
// kalender WIB, bukan momen UTC (MASTER_DASHBOARD.md §5).

export function todayJakarta(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Jakarta' }) // YYYY-MM-DD
}

export function yesterdayJakarta(): string {
  const now = new Date()
  const jakartaNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))
  jakartaNow.setDate(jakartaNow.getDate() - 1)
  return jakartaNow.toLocaleDateString('sv-SE')
}

export function firstOfMonthJakarta(): string {
  const today = todayJakarta()
  return `${today.slice(0, 7)}-01`
}

export function formatDateLong(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  })
}

// Rp 12,4jt / Rp 850rb — angka ringkas sesuai §12.3. Nilai penuh dikembalikan
// lewat title attribute oleh pemanggil kalau perlu.
export function formatRupiahRingkas(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${sign}Rp ${(abs / 1_000_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000_000) return `${sign}Rp ${(abs / 1_000_000).toFixed(1).replace('.', ',')}jt`
  if (abs >= 1_000) return `${sign}Rp ${(abs / 1_000).toFixed(0)}rb`
  return `${sign}Rp ${abs}`
}

export function formatRupiahPenuh(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(
    value,
  )
}
