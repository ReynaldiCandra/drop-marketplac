'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    setLoading(false)
    if (error) {
      setError('Email atau kata sandi salah. Coba lagi.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark login-mark">W</div>
        <h1>Masuk ke Websensial</h1>
        <p className="modal-copy">Dashboard operasional multi-toko.</p>

        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="kamu@email.com"
            autoComplete="email"
          />
        </label>
        <label>
          Kata sandi
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button className="primary-button full" type="submit" disabled={loading}>
          {loading ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}
