'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { translateSupabaseError } from '@/lib/supabase/errors'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    const supabase = createClient()

    const { error: err } = await supabase.auth.updateUser({
      password: password
    })

    if (err) {
      setError(translateSupabaseError(err.message))
      setLoading(false)
      return
    }

    setSuccess(true)
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

        {success ? (
          <>
            <h1 className="auth-title">¡Contraseña actualizada!</h1>
            <p className="auth-subtitle" style={{ marginBottom: '1.5rem' }}>
              Tu contraseña ha sido cambiada exitosamente.
            </p>
            <div className="alert alert-success">
              ✓ Ya puedes iniciar sesión con tu nueva contraseña.
            </div>
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <Link href="/login" className="btn-link">
                Ir a iniciar sesión
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="auth-title">Nueva contraseña</h1>
            <p className="auth-subtitle">
              Ingresa tu nueva contraseña para tu cuenta.
            </p>

            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleReset} noValidate>
              <div className="form-group">
                <label htmlFor="password" className="form-label">Nueva Contraseña</label>
                <input
                  id="password"
                  type="password"
                  className="form-input"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-password" className="form-label">Confirmar Contraseña</label>
                <input
                  id="confirm-password"
                  type="password"
                  className={`form-input${error === 'Las contraseñas no coinciden.' ? ' error' : ''}`}
                  placeholder="Repite tu contraseña"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                id="btn-update-password"
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading && <span className="spinner" />}
                {loading ? 'Actualizando...' : 'Actualizar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
