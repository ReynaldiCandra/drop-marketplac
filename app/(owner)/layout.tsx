import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/layout/app-shell'
import { getAppSettings } from '@/lib/queries'

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Sebenarnya middleware sudah menjaga ini, tapi Server Component tetap
  // cek ulang — jangan pernah mengandalkan filter di satu lapisan saja.
  if (!user) redirect('/login')

  // Branding & modul yang tampil dibaca sekali di layout, dipakai sidebar.
  const settings = await getAppSettings()

  return (
    <AppShell userEmail={user.email ?? 'Owner'} settings={settings}>
      {children}
    </AppShell>
  )
}
