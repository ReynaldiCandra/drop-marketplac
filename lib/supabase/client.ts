import { createBrowserClient } from '@supabase/ssr'

// Dipakai di Client Components. Aman untuk diekspos ke browser
// karena hanya pakai anon key + RLS yang mengatur akses sebenarnya.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
