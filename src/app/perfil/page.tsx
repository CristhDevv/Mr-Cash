'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { User, LogOut, ChevronLeft, Save, BarChart2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/utils/format'
import Link from 'next/link'

interface Profile {
  nombre: string
  moneda_preferida: string
  ingreso_diario_esperado: number
}

export default function PerfilPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile>({
    nombre: '',
    moneda_preferida: 'COP',
    ingreso_diario_esperado: 0
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('nombre, moneda_preferida, ingreso_diario_esperado')
      .eq('id', user.id)
      .single()

    if (!error && data) {
      setProfile({
        nombre: data.nombre || '',
        moneda_preferida: data.moneda_preferida || 'COP',
        ingreso_diario_esperado: Number(data.ingreso_diario_esperado) || 0
      })
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('profiles')
      .update({
        nombre: profile.nombre,
        moneda_preferida: profile.moneda_preferida,
        ingreso_diario_esperado: profile.ingreso_diario_esperado
      })
      .eq('id', user.id)

    setSaving(false)
    if (!error) {
      setMessage({ text: 'Perfil actualizado exitosamente', type: 'success' })
    } else {
      setMessage({ text: 'Error al actualizar el perfil', type: 'error' })
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: '2rem', width: '40%', marginBottom: '2rem' }} />
        <div className="card skeleton" style={{ height: '14rem', marginBottom: '1.5rem' }} />
        <div className="skeleton" style={{ height: '3rem' }} />
      </div>
    )
  }

  return (
    <div className="page" style={{ paddingBottom: '5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => router.back()}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '0.25rem',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="page-title" style={{ margin: 0 }}>Perfil y Ajustes</h1>
      </div>

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {message && (
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              backgroundColor: message.type === 'success' ? 'rgba(0,196,140,0.1)' : 'rgba(255,92,92,0.1)',
              color: message.type === 'success' ? 'var(--accent)' : 'var(--error)',
              border: `1px solid ${message.type === 'success' ? 'rgba(0,196,140,0.2)' : 'rgba(255,92,92,0.2)'}`
            }}
          >
            {message.text}
          </div>
        )}

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', margin: '0.5rem 0 1rem 0' }}>
            <div
              style={{
                width: '4.5rem',
                height: '4.5rem',
                borderRadius: '50%',
                background: 'var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
                border: '2px solid rgba(0,196,140,0.3)'
              }}
            >
              <User size={36} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Nombre Completo</label>
            <input
              type="text"
              className="form-input"
              value={profile.nombre}
              onChange={e => setProfile({ ...profile, nombre: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ingreso Diario Esperado (COP)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={profile.ingreso_diario_esperado || ''}
              onChange={e => setProfile({ ...profile, ingreso_diario_esperado: parseFloat(e.target.value) || 0 })}
              required
            />
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Utilizado para contrastar tu saldo de ahorro con la reserva diaria recomendada. Valor actual: {formatCOP(profile.ingreso_diario_esperado)}
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">Moneda Preferida</label>
            <select
              className="form-input"
              value={profile.moneda_preferida}
              onChange={e => setProfile({ ...profile, moneda_preferida: e.target.value })}
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="COP">COP ($ - Peso Colombiano)</option>
              <option value="USD">USD ($ - Dólar Estadounidense)</option>
              <option value="EUR">EUR (€ - Euro)</option>
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary"
          disabled={saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          <Save size={18} />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>

        <Link
          href="/reportes"
          style={{
            marginTop: '1.5rem',
            width: '100%',
            background: 'var(--accent-dim)',
            color: 'var(--accent)',
            border: '1px solid rgba(0,196,140,0.3)',
            borderRadius: '0.625rem',
            padding: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            boxSizing: 'border-box'
          }}
        >
          <BarChart2 size={16} />
          Ver Reportes y Estadísticas
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          style={{
            marginTop: '1.5rem',
            width: '100%',
            background: 'rgba(255,92,92,0.1)',
            color: 'var(--error)',
            border: '1px solid rgba(255,92,92,0.3)',
            borderRadius: '0.625rem',
            padding: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem'
          }}
        >
          <LogOut size={16} />
          Cerrar Sesión
        </button>
      </form>
    </div>
  )
}
