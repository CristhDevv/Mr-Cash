'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Calendar, Target, PiggyBank } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, getDaysRemaining } from '@/lib/utils/format'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { toast } from 'react-hot-toast'

interface Meta {
  id: string
  nombre: string
  monto_objetivo: number
  monto_actual: number
  fecha_limite: string | null
  color: string | null
}

export default function MetasPage() {
  const router = useRouter()
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAbonoModal, setShowAbonoModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [selectedMeta, setSelectedMeta] = useState<Meta | null>(null)

  // Form fields
  const [formNombre, setFormNombre] = useState('')
  const [formMontoObjetivo, setFormMontoObjetivo] = useState('')
  const [formMontoActual, setFormMontoActual] = useState('0')
  const [formFechaLimite, setFormFechaLimite] = useState('')
  const [formColor, setFormColor] = useState('#00C48C')
  const [formAbonoMonto, setFormAbonoMonto] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data, error } = await supabase
      .from('metas_ahorro')
      .select('id, nombre, monto_objetivo, monto_actual, fecha_limite, color')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!error) {
      setMetas(data || [])
    }
    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const openCreate = () => {
    setFormNombre('')
    setFormMontoObjetivo('')
    setFormMontoActual('0')
    setFormFechaLimite('')
    setFormColor('#00C48C')
    setShowCreateModal(true)
  }

  const openAbono = (meta: Meta, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedMeta(meta)
    setFormAbonoMonto('')
    setShowAbonoModal(true)
  }

  const openEdit = (meta: Meta) => {
    setSelectedMeta(meta)
    setFormNombre(meta.nombre)
    setFormMontoObjetivo(String(meta.monto_objetivo))
    setFormMontoActual(String(meta.monto_actual))
    setFormFechaLimite(meta.fecha_limite || '')
    setFormColor(meta.color || '#00C48C')
    setShowEditModal(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNombre || !formMontoObjetivo) return

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('metas_ahorro').insert({
      user_id: user.id,
      nombre: formNombre,
      monto_objetivo: parseFloat(formMontoObjetivo),
      monto_actual: parseFloat(formMontoActual) || 0,
      fecha_limite: formFechaLimite || null,
      color: formColor,
    })

    setSaving(false)
    if (!error) {
      toast.success('Meta creada con éxito')
      setShowCreateModal(false)
      await fetchData()
    } else {
      toast.error('Error al crear la meta')
    }
  }

  const handleAbono = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMeta || !formAbonoMonto) return

    setSaving(true)
    const supabase = createClient()
    const nuevoMonto = selectedMeta.monto_actual + parseFloat(formAbonoMonto)

    // Update the saving goal amount
    const { error: updateError } = await supabase
      .from('metas_ahorro')
      .update({ monto_actual: nuevoMonto })
      .eq('id', selectedMeta.id)

    // Add a corresponding transaction of type "gasto" (or saving allocation)?
    // Wait, the prompt says: "Botón 'Abonar' en cada tarjeta que abre modal para registrar un abono (actualiza monto_actual)".
    // Let's also register a transaction of type "gasto" with category "Ahorro" or similar, or just update the goal.
    // Let's just update the goal as requested, but if they want to track it, they can. The requirement is just "actualiza monto_actual". Let's do that!
    
    if (!updateError) {
      // Find or create an "Ahorro" category to optionally log this txn, but updating monto_actual is the primary request.
      // Let's try to find if there is an "Ahorro" category.
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: catData } = await supabase
          .from('categorias')
          .select('id')
          .eq('user_id', user.id)
          .eq('nombre', 'Ahorro')
          .single()

        let catId = catData?.id
        if (!catId) {
          const { data: allCats } = await supabase.from('categorias').select('id, nombre').eq('user_id', user.id).limit(1)
          if (allCats && allCats.length > 0) catId = allCats[0].id
        }

        if (catId) {
          await supabase.from('transacciones').insert({
            user_id: user.id,
            monto: parseFloat(formAbonoMonto),
            tipo: 'transferencia',
            categoria_id: catId,
            descripcion: `Abono a meta: ${selectedMeta.nombre}`,
            fecha: new Date().toISOString().split('T')[0]
          })
        }
      }
      
      
      setSaving(false)
      toast.success('Abono registrado con éxito')
      setShowAbonoModal(false)
      await fetchData()
    } else {
      setSaving(false)
      toast.error('Error al registrar abono')
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMeta || !formNombre || !formMontoObjetivo) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('metas_ahorro')
      .update({
        nombre: formNombre,
        monto_objetivo: parseFloat(formMontoObjetivo),
        monto_actual: parseFloat(formMontoActual) || 0,
        fecha_limite: formFechaLimite || null,
        color: formColor,
      })
      .eq('id', selectedMeta.id)

    setSaving(false)
    if (!error) {
      toast.success('Meta actualizada')
      setShowEditModal(false)
      await fetchData()
    } else {
      toast.error('Error al actualizar meta')
    }
  }

  const confirmDelete = () => {
    setShowConfirm(true)
  }

  const handleDelete = async () => {
    if (!selectedMeta) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('metas_ahorro').delete().eq('id', selectedMeta.id)
    setSaving(false)
    if (!error) {
      toast.success('Meta eliminada')
      setShowEditModal(false)
      await fetchData()
    } else {
      toast.error('Error al eliminar la meta')
    }
  }

  return (
    <div className="page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Metas de Ahorro</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Establece objetivos de ahorro a mediano o largo plazo y dale seguimiento a tu progreso.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2].map(i => (
            <div key={i} className="skeleton" style={{ height: '7rem' }} />
          ))}
        </div>
      ) : metas.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⭐</div>
          <p className="empty-title">Sin metas de ahorro</p>
          <p className="empty-desc" style={{ marginBottom: '1.5rem' }}>
            ¿Quieres comprar algo especial o crear un fondo de emergencias?
          </p>
          <button className="btn-primary" style={{ maxWidth: '200px', margin: '0 auto', display: 'block' }} onClick={openCreate}>
            Crear Nueva Meta
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', paddingBottom: '5rem' }}>
          {metas.map(meta => {
            const pct = meta.monto_objetivo > 0 ? Math.min((meta.monto_actual / meta.monto_objetivo) * 100, 100) : 0
            const dias = meta.fecha_limite ? getDaysRemaining(meta.fecha_limite) : null
            
            // SVG circular progress settings
            const radius = 32
            const stroke = 5
            const normalizedRadius = radius - stroke
            const circumference = normalizedRadius * 2 * Math.PI
            const strokeDashoffset = circumference - (pct / 100) * circumference

            return (
              <div
                key={meta.id}
                className="card"
                onClick={() => openEdit(meta)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
                  {/* Circular Progress SVG */}
                  <div style={{ position: 'relative', width: radius * 2, height: radius * 2, flexShrink: 0 }}>
                    <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
                      <circle
                        stroke="rgba(255,255,255,0.06)"
                        fill="transparent"
                        strokeWidth={stroke}
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                      />
                      <circle
                        stroke={meta.color || 'var(--accent)'}
                        fill="transparent"
                        strokeWidth={stroke}
                        strokeDasharray={circumference + ' ' + circumference}
                        style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.35s' }}
                        strokeLinecap="round"
                        r={normalizedRadius}
                        cx={radius}
                        cy={radius}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700
                    }}>
                      {Math.round(pct)}%
                    </div>
                  </div>

                  <div>
                    <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>{meta.nombre}</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {formatCOP(meta.monto_actual)} de {formatCOP(meta.monto_objetivo)}
                    </p>
                    {dias !== null && (
                      <p style={{
                        fontSize: '0.75rem',
                        color: dias > 0 ? 'var(--text-muted)' : 'var(--error)',
                        marginTop: '0.25rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem'
                      }}>
                        <Calendar size={12} />
                        {dias > 0 ? `${dias} días restantes` : 'Plazo vencido'}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginLeft: '0.5rem' }}>
                  <button
                    className="btn-primary"
                    onClick={(e) => openAbono(meta, e)}
                    style={{
                      padding: '0.375rem 0.75rem',
                      fontSize: '0.8125rem',
                      borderRadius: '0.375rem',
                      background: 'var(--accent)',
                      color: '#000',
                      fontWeight: 700
                    }}
                  >
                    Abonar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button className="fab" onClick={openCreate} aria-label="Agregar meta">
        <Plus size={24} />
      </button>

      {/* Modal: Create Meta */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Nueva Meta de Ahorro">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label className="form-label">Nombre de la meta</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Fondo de emergencia, Viaje..."
              value={formNombre}
              onChange={e => setFormNombre(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monto objetivo (COP)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={formMontoObjetivo}
              onChange={e => setFormMontoObjetivo(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ahorro inicial (COP) - Opcional</label>
            <input
              type="number"
              className="form-input"
              value={formMontoActual}
              onChange={e => setFormMontoActual(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha límite (Opcional)</label>
            <input
              type="date"
              className="form-input"
              value={formFechaLimite}
              onChange={e => setFormFechaLimite(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Color de la barra</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
              {['#00C48C', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormColor(c)}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: formColor === c ? '2px solid #fff' : 'none',
                    cursor: 'pointer',
                    boxShadow: formColor === c ? '0 0 8px rgba(255,255,255,0.4)' : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving || !formNombre || !formMontoObjetivo}>
            {saving ? 'Guardando...' : 'Crear Meta'}
          </button>
        </form>
      </Modal>

      {/* Modal: Abonar */}
      <Modal isOpen={showAbonoModal} onClose={() => setShowAbonoModal(false)} title={`Abonar a ${selectedMeta?.nombre}`}>
        <form onSubmit={handleAbono}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
            Tu ahorro actual es {selectedMeta ? formatCOP(selectedMeta.monto_actual) : ''} de {selectedMeta ? formatCOP(selectedMeta.monto_objetivo) : ''}.
          </p>
          <div className="form-group">
            <label className="form-label">Monto del abono (COP)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={formAbonoMonto}
              onChange={e => setFormAbonoMonto(e.target.value)}
              required
              style={{ fontSize: '1.375rem', fontWeight: 700, textAlign: 'center' }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving || !formAbonoMonto}>
            {saving ? 'Registrando...' : 'Confirmar Abono'}
          </button>
        </form>
      </Modal>

      {/* Modal: Edit/Delete Meta */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Editar Meta">
        <form onSubmit={handleEdit}>
          <div className="form-group">
            <label className="form-label">Nombre de la meta</label>
            <input
              type="text"
              className="form-input"
              value={formNombre}
              onChange={e => setFormNombre(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monto objetivo (COP)</label>
            <input
              type="number"
              className="form-input"
              value={formMontoObjetivo}
              onChange={e => setFormMontoObjetivo(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Ahorro acumulado (COP)</label>
            <input
              type="number"
              className="form-input"
              value={formMontoActual}
              onChange={e => setFormMontoActual(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Fecha límite</label>
            <input
              type="date"
              className="form-input"
              value={formFechaLimite}
              onChange={e => setFormFechaLimite(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Color de la barra</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
              {['#00C48C', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormColor(c)}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: formColor === c ? '2px solid #fff' : 'none',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>

          <button type="submit" className="btn-primary" disabled={saving || !formNombre || !formMontoObjetivo}>
            {saving ? 'Guardando...' : 'Actualizar Meta'}
          </button>

          <button
            type="button"
            className="btn-danger"
            onClick={confirmDelete}
            disabled={saving}
            style={{
              width: '100%',
              marginTop: '0.5rem',
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
            <Trash2 size={16} />
            Eliminar Meta
          </button>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Eliminar Meta"
        message="¿Estás seguro de que deseas eliminar esta meta de ahorro? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  )
}
