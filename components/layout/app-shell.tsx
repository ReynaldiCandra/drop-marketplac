'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ListTodo,
  Menu,
  Moon,
  PackageSearch,
  Radio,
  ReceiptText,
  Settings,
  Store,
  Sun,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { AppSettings } from '@/lib/queries'

// Tiap item punya `flag`: nama field di app_settings yang menentukan apakah
// item ini tampil. Item tanpa flag (Ringkasan, Pengaturan) selalu tampil --
// mematikan keduanya akan membuat dashboard tidak bisa dipakai sama sekali.
const nav: {
  href: string
  label: string
  icon: typeof BarChart3
  flag?: keyof AppSettings
  comingSoon?: boolean
}[] = [
  { href: '/dashboard', label: 'Ringkasan', icon: BarChart3 },
  { href: '/input', label: 'Input Harian', icon: CalendarDays, flag: 'show_input' },
  { href: '/pesanan', label: 'Pesanan', icon: ReceiptText, flag: 'show_pesanan' },
  { href: '/toko', label: 'Toko & Produk', icon: Store, flag: 'show_toko' },
  { href: '/produk', label: 'Skor Produk', icon: PackageSearch, flag: 'show_produk' },
  { href: '/biaya', label: 'Biaya & Iklan', icon: WalletCards, flag: 'show_biaya' },
  { href: '/live', label: 'Live Selling', icon: Radio, flag: 'show_live' },
  { href: '/klien', label: 'Klien Freelance', icon: Users, comingSoon: true },
  { href: '/rencana', label: 'Rencana Kerja', icon: ListTodo, comingSoon: true },
  { href: '/laporan', label: 'Laporan', icon: BarChart3, comingSoon: true },
]

const MobileMenuContext = createContext<() => void>(() => {})

// Dipakai tiap halaman untuk tombol "buka menu" di topbar masing-masing,
// karena tiap halaman punya judul/topbar sendiri tapi sidebarnya dari AppShell.
export function useOpenMobileMenu() {
  return useContext(MobileMenuContext)
}

export function AppShell({
  children,
  userEmail,
  settings,
}: {
  children: React.ReactNode
  userEmail: string
  settings: AppSettings
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme')
    if (current === 'dark' || current === 'light') setTheme(current)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = userEmail.slice(0, 2).toUpperCase()

  return (
    <MobileMenuContext.Provider value={() => setMobileOpen(true)}>
    <div className="app-shell" style={{ ['--brand' as any]: settings.brand_color }}>
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-row">
          <div className="brand-mark" style={{ background: settings.brand_color }}>
            {settings.brand_initial}
          </div>
          <div>
            <strong>{settings.app_name}</strong>
            <span>{settings.app_tagline}</span>
          </div>
          <button className="close-mobile" onClick={() => setMobileOpen(false)} aria-label="Tutup menu">
            <X size={18} />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-dot" /> Owner workspace
        </div>
        <nav className="main-nav" aria-label="Navigasi utama">
          <p className="nav-label">WORKSPACE</p>
          {nav.map(({ href, label, icon: Icon, comingSoon, flag }) => {
            // Modul yang dimatikan owner di Pengaturan tidak dirender.
            if (flag && !settings[flag]) return null
            const active = pathname?.startsWith(href)
            return (
              <Link
                key={href}
                href={comingSoon ? '#' : href}
                className={`nav-item ${active ? 'active' : ''} ${comingSoon ? 'nav-item-disabled' : ''}`}
                onClick={(e) => {
                  setMobileOpen(false)
                  if (comingSoon) e.preventDefault()
                }}
                aria-disabled={comingSoon}
                title={comingSoon ? 'Belum dibangun — menyusul di fase berikutnya' : undefined}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
                {comingSoon && <em>segera</em>}
              </Link>
            )
          })}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item" onClick={toggleTheme}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            <span>{theme === 'dark' ? 'Mode terang' : 'Mode gelap'}</span>
          </button>
          <Link
            className={`nav-item ${pathname?.startsWith('/pengaturan') ? 'active' : ''}`}
            href="/pengaturan"
            onClick={() => setMobileOpen(false)}
          >
            <Settings size={18} />
            <span>Pengaturan</span>
          </Link>
          <button className="profile" onClick={handleLogout} title="Keluar">
            <div className="avatar">{initials}</div>
            <div>
              <strong>{userEmail}</strong>
              <span>Owner · Keluar</span>
            </div>
            <ChevronDown size={15} />
          </button>
        </div>
      </aside>
      {mobileOpen && (
        <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Tutup menu" />
      )}

      <main className="main-content">{children}</main>
    </div>
    </MobileMenuContext.Provider>
  )
}

// Tombol menu mobile yang dipakai di dalam topbar tiap halaman.
export function MobileMenuButton() {
  const open = useOpenMobileMenu()
  return (
    <button className="menu-button" onClick={open} aria-label="Buka menu">
      <Menu size={21} />
    </button>
  )
}
