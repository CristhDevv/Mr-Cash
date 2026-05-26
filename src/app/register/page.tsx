'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { translateSupabaseError } from '@/lib/supabase/errors'

export default function RegisterPage() {
  const router = useRouter()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister(e: React.FormEvent) {
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

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { nombre },
      },
    })

    if (err) {
      setError(translateSupabaseError(err.message))
      setLoading(false)
      return
    }

    // Supabase trigger creates profile + categories automatically
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon">M$</div>
          <span className="auth-logo-text">Mr Cash</span>
        </div>

        <h1 className="auth-title">Crea tu cuenta</h1>
        <p className="auth-subtitle">Empieza a controlar tus finanzas hoy</p>

        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} noValidate>
          <div className="form-group">
            <label htmlFor="nombre" className="form-label">Nombre completo</label>
            <input
              id="nombre"
              type="text"
              className="form-input"
              placeholder="Juan Pérez"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              autoComplete="name"
              autoCapitalize="words"
            />
          </div>

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

          <div className="form-group">
            <label htmlFor="password" className="form-label">Contraseña</label>
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
            <label htmlFor="confirm-password" className="form-label">Confirmar contraseña</label>
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
            id="btn-register"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading && <span className="spinner" />}
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <div className="auth-divider">¿Ya tienes cuenta?</div>

        <div style={{ textAlign: 'center' }}>
          <Link href="/login" className="btn-link">
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  )
}
