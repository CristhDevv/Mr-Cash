'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, getMonthRange, getMonthLabel } from '@/lib/utils/format'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { toast } from 'react-hot-toast'

interface Presupuesto {
  id: string; monto_limite: number; categoria_id: string; mes: number; ano: number
  categorias: { nombre: string; color: string | null; icono: string | null } | null
}
interface Categoria { id: string; nombre: string; tipo: string; color: string | null; icono: string | null }
interface Txn { monto: number; tipo: string; categoria_id: string | null }

export default function PresupuestosPage() {
  const router = useRouter()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [txns, setTxns] = useState<Txn[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [formCatId, setFormCatId] = useState('')
  const [formMonto, setFormMonto] = useState('')
  const [saving, setSaving] = useState(false)

  const { start, end } = getMonthRange(mes, ano)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const [presRes, txnRes, catRes] = await Promise.all([
      supabase.from('presupuestos').select('id,monto_limite,categoria_id,mes,año,categorias(nombre,color,icono)')
        .eq('user_id', user.id).eq('mes', mes).eq('año', ano),
      supabase.from('transacciones').select('monto,tipo,categoria_id')
        .eq('user_id', user.id).eq('tipo', 'gasto').gte('fecha', start).lte('fecha', end),
      supabase.from('categorias').select('id,nombre,tipo,color,icono').eq('user_id', user.id).eq('tipo', 'gasto').order('nombre'),
    ])
    setPresupuestos((presRes.data || []) as unknown as Presupuesto[])
    setTxns(txnRes.data || [])
    setCategorias(catRes.data || [])
    setLoading(false)
  }, [mes, ano, start, end, router])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() { if (mes === 1) { setMes(12); setAno(a => a - 1) } else setMes(m => m - 1) }
  function nextMonth() { if (mes === 12) { setMes(1); setAno(a => a + 1) } else setMes(m => m + 1) }

  function openAdd() { setEditId(null); setFormCatId(''); setFormMonto(''); setShowModal(true) }
  function openEdit(p: Presupuesto) { setEditId(p.id); setFormCatId(p.categoria_id); setFormMonto(String(p.monto_limite)); setShowModal(true) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!formCatId || !formMonto) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { monto_limite: parseFloat(formMonto), categoria_id: formCatId, mes, año: ano }
    if (editId) {
      const { error } = await supabase.from('presupuestos').update(payload).eq('id', editId)
      if (!error) toast.success('Presupuesto actualizado')
      else toast.error('Error al actualizar')
    } else {
      const { error } = await supabase.from('presupuestos').insert({ ...payload, user_id: user.id })
      if (!error) toast.success('Presupuesto creado')
      else toast.error('Error al crear')
    }
    setSaving(false); setShowModal(false); await fetchData()
  }

  function confirmDelete() {
    setShowConfirm(true)
  }

  async function deletePres() {
    if (!editId) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('presupuestos').delete().eq('id', editId)
    setSaving(false)
    if (!error) {
      toast.success('Presupuesto eliminado')
      setShowModal(false)
      await fetchData()
    } else {
      toast.error('Error al eliminar')
    }
  }

  const presConGasto = presupuestos.map(p => {
    const gastado = txns.filter(t => t.categoria_id === p.categoria_id).reduce((s, t) => s + t.monto, 0)
    const pct = p.monto_limite > 0 ? Math.min((gastado / p.monto_limite) * 100, 100) : 0
    return { ...p, gastado, pct }
  })

  const catsUsadas = new Set(presupuestos.map(p => p.categoria_id))
  const catsDisponibles = categorias.filter(c => !catsUsadas.has(c.id) || c.id === formCatId)

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginBottom: '1rem' }}>Presupuestos</h1>

      <div className="month-selector">
        <button className="month-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
        <span className="month-label">{getMonthLabel(mes, ano)}</span>
        <button className="month-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
      </div>

      {loading ? (
        <>{[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '5rem', marginBottom: '0.75rem' }} />)}</>
      ) : presConGasto.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎯</div>
          <p className="empty-title">Sin presupuestos este mes</p>
          <p className="empty-desc" style={{ marginBottom: '1.5rem' }}>Define límites de gasto por categoría</p>
          <button className="btn-primary" style={{ maxWidth: '200px', margin: '0 auto', display: 'block' }} onClick={openAdd}>Crear presupuesto</button>
        </div>
      ) : (
        presConGasto.map(p => {
          const barColor = p.pct >= 90 ? 'var(--error)' : p.pct >= 70 ? 'var(--warning)' : 'var(--accent)'
          const chipClass = p.pct >= 90 ? 'chip chip-red' : p.pct >= 70 ? 'chip chip-yellow' : 'chip chip-green'
          return (
            <div key={p.id} className="card" onClick={() => openEdit(p)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.5rem', background: `${p.categorias?.color || '#888'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CategoryIcon name={p.categorias?.icono} size={18} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{p.categorias?.nombre}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatCOP(p.gastado)} gastado</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>{formatCOP(p.monto_limite)}</p>
                  <span className={chipClass}>{Math.round(p.pct)}%</span>
                </div>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{ width: `${p.pct}%`, background: barColor }} />
              </div>
              <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.375rem', textAlign: 'right' }}>
                Disponible: {formatCOP(Math.max(p.monto_limite - p.gastado, 0))}
              </p>
            </div>
          )
        })
      )}

      {presConGasto.length > 0 && (
        <button className="fab" onClick={openAdd} aria-label="Agregar presupuesto"><Plus size={24} /></button>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editId ? 'Editar presupuesto' : 'Nuevo presupuesto'}>
        <form onSubmit={save}>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <select className="form-input" value={formCatId} onChange={e => setFormCatId(e.target.value)} required style={{ color: formCatId ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              <option value="">Selecciona una categoría</option>
              {catsDisponibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Límite de gasto (COP)</label>
            <input type="number" className="form-input" placeholder="0" value={formMonto} onChange={e => setFormMonto(e.target.value)} inputMode="decimal" required style={{ fontSize: '1.375rem', fontWeight: 700, textAlign: 'center' }} />
          </div>
          <button type="submit" className="btn-primary" disabled={saving || !formCatId || !formMonto}>
            {saving ? 'Guardando...' : editId ? 'Actualizar' : 'Crear presupuesto'}
          </button>
          {editId && (
            <button type="button" onClick={confirmDelete} disabled={saving} style={{ width: '100%', marginTop: '0.5rem', background: 'rgba(255,92,92,0.1)', color: 'var(--error)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: '0.625rem', padding: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
              Eliminar presupuesto
            </button>
          )}
        </form>
      </Modal>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Eliminar Presupuesto"
        message="¿Estás seguro de que deseas eliminar este presupuesto? Se borrará el límite establecido para esta categoría."
        onConfirm={deletePres}
      />
    </div>
  )
}
