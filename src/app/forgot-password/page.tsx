'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { translateSupabaseError } from '@/lib/supabase/errors'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (err) {
      setError(translateSupabaseError(err.message))
      setLoading(false)
      return
    }

    setSent(true)
    setLoading(false)
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">M$</div>
          <span className="auth-logo-text">Mr Cash</span>
        </div>

        {sent ? (
          <>
            <h1 className="auth-title">Revisa tu correo</h1>
            <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
              Enviamos un enlace de recuperación a <strong style={{ color: 'white' }}>{email}</strong>. 
              Revisa también la carpeta de spam.
            </p>
            <div className="alert alert-success">
              ✓ Enlace de recuperación enviado exitosamente.
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <Link href="/login" className="btn-link">
                ← Volver al inicio de sesión
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">Recuperar contraseña</h1>
            <p className="auth-subtitle">
              Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.
            </p>

            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleReset} noValidate>
              <div className="form-group">
                <label htmlFor="email" className="form-label">Correo electrónico</label>
                <input
                  id="email"
                  type="email"
                  className="form-input"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoCapitalize="none"
                />
              </div>

              <button
                id="btn-reset"
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading && <span className="spinner" />}
                {loading ? 'Enviando...' : 'Enviar enlace de recuperación'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <Link href="/login" className="btn-link">
                ← Volver al inicio de sesión
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
