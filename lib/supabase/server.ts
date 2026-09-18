import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Dipakai di Server Components, Server Actions, dan Route Handlers.
// Jangan pernah import file ini dari Client Component.
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Dipanggil dari Server Component (bukan Server Action/Route Handler).
            // Middleware yang akan menyegarkan sesi, jadi aman diabaikan di sini.
          }
        },
      },
    },
  )
}
