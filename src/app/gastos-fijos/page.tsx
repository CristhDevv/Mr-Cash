'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP } from '@/lib/utils/format'
import { calcularReservaDiaria } from '@/lib/utils/reserva'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { toast } from 'react-hot-toast'

interface GastoFijo {
  id: string
  nombre: string
  monto: number
  dia_del_mes: number
  activo: boolean
  categoria_id: string | null
  categorias: { nombre: string; color: string | null; icono: string | null } | null
}

interface Categoria {
  id: string
  nombre: string
  tipo: string
  color: string | null;
  icono: string | null;
}

export default function GastosFijosPage() {
  const router = useRouter()
  const [gastos, setGastos] = useState<GastoFijo[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  
  // Form fields
  const [formNombre, setFormNombre] = useState('')
  const [formMonto, setFormMonto] = useState('')
  const [formDia, setFormDia] = useState('1')
  const [formCatId, setFormCatId] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const [gastosRes, catRes] = await Promise.all([
      supabase
        .from('gastos_fijos')
        .select('id, nombre, monto, dia_del_mes, activo, categoria_id, categorias(nombre, color, icono)')
        .eq('user_id', user.id)
        .order('dia_del_mes', { ascending: true }),
      supabase
        .from('categorias')
        .select('id, nombre, tipo, color, icono')
        .eq('user_id', user.id)
        .eq('tipo', 'gasto')
        .order('nombre', { ascending: true })
    ])

    setGastos((gastosRes.data || []) as unknown as GastoFijo[])
    setCategorias((catRes.data || []) as unknown as Categoria[])
    setLoading(false)
  }, [router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleToggle = async (id: string, currentStatus: boolean) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('gastos_fijos')
      .update({ activo: !currentStatus })
      .eq('id', id)

    if (!error) {
      setGastos(prev =>
        prev.map(g => (g.id === id ? { ...g, activo: !currentStatus } : g))
      )
    }
  }

  const openAdd = () => {
    setEditId(null)
    setFormNombre('')
    setFormMonto('')
    setFormDia('1')
    setFormCatId('')
    setShowModal(true)
  }

  const openEdit = (g: GastoFijo) => {
    setEditId(g.id)
    setFormNombre(g.nombre)
    setFormMonto(String(g.monto))
    setFormDia(String(g.dia_del_mes))
    setFormCatId(g.categoria_id || '')
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formNombre || !formMonto || !formDia) return

    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      nombre: formNombre,
      monto: parseFloat(formMonto),
      dia_del_mes: parseInt(formDia, 10),
      categoria_id: formCatId || null,
    }

    if (editId) {
      const { error } = await supabase.from('gastos_fijos').update(payload).eq('id', editId)
      if (!error) toast.success('Gasto fijo actualizado')
      else toast.error('Error al actualizar')
    } else {
      const { error } = await supabase.from('gastos_fijos').insert({
        ...payload,
        user_id: user.id,
        activo: true
      })
      if (!error) toast.success('Gasto fijo creado')
      else toast.error('Error al crear')
    }

    setSaving(false)
    setShowModal(false)
    await fetchData()
  }

  const confirmDelete = () => {
    setShowConfirm(true)
  }

  const handleDelete = async () => {
    if (!editId) return

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('gastos_fijos').delete().eq('id', editId)
    setSaving(false)
    if (!error) {
      toast.success('Gasto fijo eliminado')
      setShowModal(false)
      await fetchData()
    } else {
      toast.error('Error al eliminar')
    }
  }

  // Calculate cuota diaria for active expenses
  const { items: reservaItems } = calcularReservaDiaria(
    gastos.map(g => ({
      id: g.id,
      nombre: g.nombre,
      monto: g.monto,
      dia_del_mes: g.dia_del_mes,
      activo: g.activo
    }))
  )

  // Mapping cuotas to original list
  const gastosConCuota = gastos.map(g => {
    const itemConCuota = reservaItems.find(item => item.id === g.id)
    return {
      ...g,
      cuotaDiaria: itemConCuota ? itemConCuota.cuotaDiaria : g.monto / 30, // Fallback if inactive
      diasRestantes: itemConCuota ? itemConCuota.diasRestantes : null
    }
  })

  return (
    <div className="page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Gastos Fijos</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Tus compromisos mensuales recurrentes y su cuota de ahorro diaria recomendada.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="skeleton" style={{ height: '4.5rem' }} />
          ))}
        </div>
      ) : gastos.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <p className="empty-title">Sin gastos fijos</p>
          <p className="empty-desc" style={{ marginBottom: '1.5rem' }}>
            Registra tus facturas, suscripciones o arriendos para calcular tu reserva diaria.
          </p>
          <button className="btn-primary" style={{ maxWidth: '200px', margin: '0 auto', display: 'block' }} onClick={openAdd}>
            Agregar Gasto Fijo
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingBottom: '5rem' }}>
          {gastosConCuota.map(g => (
            <div
              key={g.id}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                opacity: g.activo ? 1 : 0.6,
                transition: 'opacity 0.2s ease',
                padding: '0.875rem'
              }}
            >
              <div
                onClick={() => openEdit(g)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, cursor: 'pointer' }}
              >
                <div
                  style={{
                    width: '2.25rem',
                    height: '2.25rem',
                    borderRadius: '0.5rem',
                    background: `${g.categorias?.color || '#888'}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <CategoryIcon name={g.categorias?.icono} size={18} />
                </div>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{g.nombre}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Día de cobro: {g.dia_del_mes} · Total: {formatCOP(g.monto)}
                  </p>
                  {g.activo && g.diasRestantes !== null && (
                    <p style={{ fontSize: '0.6875rem', color: 'var(--accent)', marginTop: '0.125rem', fontWeight: 500 }}>
                      Cobro en {g.diasRestantes} {g.diasRestantes === 1 ? 'día' : 'días'}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', textAlign: 'right' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: g.activo ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {formatCOP(g.cuotaDiaria)}
                  </p>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>/ día</p>
                </div>
                
                {/* Switch Toggle */}
                <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '2.5rem', height: '1.375rem' }} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={g.activo}
                    onChange={() => handleToggle(g.id, g.activo)}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: g.activo ? 'var(--accent)' : '#444',
                      borderRadius: '1rem',
                      transition: 'background-color 0.2s ease'
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      content: '""',
                      height: '0.875rem', width: '0.875rem',
                      left: g.activo ? '1.375rem' : '0.25rem',
                      bottom: '0.25rem',
                      backgroundColor: '#fff',
                      borderRadius: '50%',
                      transition: 'left 0.2s ease'
                    }}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}

      {gastos.length > 0 && (
        <button className="fab" onClick={openAdd} aria-label="Agregar gasto fijo">
          <Plus size={24} />
        </button>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nombre del gasto</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Netflix, Arriendo..."
              value={formNombre}
              onChange={e => setFormNombre(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Monto (COP)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={formMonto}
              onChange={e => setFormMonto(e.target.value)}
              inputMode="decimal"
              required
              style={{ fontSize: '1.375rem', fontWeight: 700, textAlign: 'center' }}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Día del mes de cobro (1-31)</label>
            <input
              type="number"
              className="form-input"
              min="1"
              max="31"
              placeholder="1"
              value={formDia}
              onChange={e => setFormDia(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Categoría (opcional)</label>
            <select
              className="form-input"
              value={formCatId}
              onChange={e => setFormCatId(e.target.value)}
              style={{ color: formCatId ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              <option value="">Ninguna categoría</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn-primary" disabled={saving || !formNombre || !formMonto || !formDia}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear Gasto Fijo'}
          </button>

          {editId && (
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
              Eliminar Gasto Fijo
            </button>
          )}
        </form>
      </Modal>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Eliminar Gasto Fijo"
        message="¿Estás seguro de que deseas eliminar este gasto fijo? Esta acción no se puede deshacer."
        onConfirm={handleDelete}
      />
    </div>
  )
}
