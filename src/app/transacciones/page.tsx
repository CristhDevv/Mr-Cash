'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, formatDateLabel, getMonthRange, getMonthLabel } from '@/lib/utils/format'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Modal } from '@/components/Modal'

interface Txn {
  id: string; monto: number; tipo: string; descripcion: string | null; fecha: string
  categoria_id: string | null
  categorias: { nombre: string; color: string | null; icono: string | null } | null
}
interface Categoria { id: string; nombre: string; tipo: string; color: string | null; icono: string | null }

export default function TransaccionesPage() {
  const router = useRouter()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'ingreso' | 'gasto'>('todos')
  const [txns, setTxns] = useState<Txn[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editTxn, setEditTxn] = useState<Txn | null>(null)
  const [txnMonto, setTxnMonto] = useState('')
  const [txnTipo, setTxnTipo] = useState<'ingreso' | 'gasto'>('gasto')
  const [txnCatId, setTxnCatId] = useState('')
  const [txnDesc, setTxnDesc] = useState('')
  const [txnFecha, setTxnFecha] = useState(now.toISOString().split('T')[0])
  const [saving, setSaving] = useState(false)

  const { start, end } = getMonthRange(mes, ano)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const [txnRes, catRes] = await Promise.all([
      supabase.from('transacciones').select('id,monto,tipo,descripcion,fecha,categoria_id,categorias(nombre,color,icono)')
        .eq('user_id', user.id).gte('fecha', start).lte('fecha', end).order('fecha', { ascending: false }),
      supabase.from('categorias').select('id,nombre,tipo,color,icono').eq('user_id', user.id).order('nombre'),
    ])
    setTxns((txnRes.data || []) as unknown as Txn[])
    setCategorias(catRes.data || [])
    setLoading(false)
  }, [start, end, router])

  useEffect(() => { fetchData() }, [fetchData])

  function prevMonth() {
    if (mes === 1) { setMes(12); setAno(a => a - 1) } else setMes(m => m - 1)
  }
  function nextMonth() {
    if (mes === 12) { setMes(1); setAno(a => a + 1) } else setMes(m => m + 1)
  }

  const filtered = txns.filter(t => filtroTipo === 'todos' || t.tipo === filtroTipo)

  // Group by date
  const groups: Record<string, Txn[]> = {}
  filtered.forEach(t => {
    if (!groups[t.fecha]) groups[t.fecha] = []
    groups[t.fecha].push(t)
  })
  const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a))

  function openAdd() {
    setEditTxn(null); setTxnMonto(''); setTxnDesc(''); setTxnCatId('')
    setTxnTipo('gasto'); setTxnFecha(now.toISOString().split('T')[0]); setShowModal(true)
  }
  function openEdit(t: Txn) {
    setEditTxn(t); setTxnMonto(String(t.monto)); setTxnDesc(t.descripcion || '')
    setTxnCatId(t.categoria_id || ''); setTxnTipo(t.tipo as 'ingreso' | 'gasto')
    setTxnFecha(t.fecha); setShowModal(true)
  }

  async function saveTxn(e: React.FormEvent) {
    e.preventDefault()
    if (!txnMonto || !txnCatId) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const payload = { monto: parseFloat(txnMonto), tipo: txnTipo, categoria_id: txnCatId, descripcion: txnDesc || null, fecha: txnFecha }
    if (editTxn) {
      await supabase.from('transacciones').update(payload).eq('id', editTxn.id)
    } else {
      await supabase.from('transacciones').insert({ ...payload, user_id: user.id })
    }
    setSaving(false); setShowModal(false); await fetchData()
  }

  async function deleteTxn() {
    if (!editTxn) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('transacciones').delete().eq('id', editTxn.id)
    setSaving(false); setShowModal(false); await fetchData()
  }

  const catsFiltered = categorias.filter(c => c.tipo === txnTipo)
  const totalIngresos = txns.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const totalGastos = txns.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0)

  return (
    <div className="page">
      <h1 className="page-title" style={{ marginBottom: '1rem' }}>Transacciones</h1>

      {/* Month Selector */}
      <div className="month-selector">
        <button className="month-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
        <span className="month-label">{getMonthLabel(mes, ano)}</span>
        <button className="month-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
        <div className="card card-sm" style={{ textAlign: 'center', padding: '0.75rem' }}>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Ingresos</p>
          <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9375rem' }}>{formatCOP(totalIngresos)}</p>
        </div>
        <div className="card card-sm" style={{ textAlign: 'center', padding: '0.75rem' }}>
          <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Gastos</p>
          <p style={{ fontWeight: 700, color: 'var(--error)', fontSize: '0.9375rem' }}>{formatCOP(totalGastos)}</p>
        </div>
      </div>

      {/* Type Filter */}
      <div className="toggle" style={{ marginBottom: '1rem' }}>
        {(['todos', 'ingreso', 'gasto'] as const).map(t => (
          <button key={t} type="button"
            className={`toggle-btn${filtroTipo === t ? (t === 'gasto' ? ' active-red' : ' active') : ''}`}
            onClick={() => setFiltroTipo(t)}>
            {t === 'todos' ? 'Todos' : t === 'ingreso' ? 'Ingresos' : 'Gastos'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <>
          {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '4rem', marginBottom: '0.5rem' }} />)}
        </>
      ) : sortedDates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <p className="empty-title">Sin transacciones</p>
          <p className="empty-desc">Toca el botón + para agregar una</p>
        </div>
      ) : (
        sortedDates.map(fecha => (
          <div key={fecha}>
            <p className="date-group-label">{formatDateLabel(fecha)}</p>
            <div className="card card-sm" style={{ marginBottom: '0.5rem', padding: '0 1rem' }}>
              {groups[fecha].map(t => (
                <div key={t.id} className="txn-item" onClick={() => openEdit(t)} style={{ cursor: 'pointer' }}>
                  <div className="txn-icon" style={{ background: `${t.categorias?.color || '#888'}22` }}>
                    <CategoryIcon name={t.categorias?.icono} size={16} />
                  </div>
                  <div className="txn-info">
                    <p className="txn-name">{t.categorias?.nombre || 'Sin categoría'}</p>
                    {t.descripcion && <p className="txn-desc">{t.descripcion}</p>}
                  </div>
                  <p className={t.tipo === 'ingreso' ? 'amount-pos' : 'amount-neg'}>
                    {t.tipo === 'ingreso' ? '+' : '-'}{formatCOP(t.monto)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <button className="fab" onClick={openAdd} aria-label="Agregar transacción"><Plus size={24} /></button>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editTxn ? 'Editar transacción' : 'Nueva transacción'}>
        <form onSubmit={saveTxn}>
          <div className="toggle" style={{ marginBottom: '1rem' }}>
            <button type="button" className={`toggle-btn${txnTipo === 'gasto' ? ' active-red' : ''}`} onClick={() => { setTxnTipo('gasto'); setTxnCatId('') }}>Gasto</button>
            <button type="button" className={`toggle-btn${txnTipo === 'ingreso' ? ' active' : ''}`} onClick={() => { setTxnTipo('ingreso'); setTxnCatId('') }}>Ingreso</button>
          </div>
          <div className="form-group">
            <label className="form-label">Monto (COP)</label>
            <input type="number" className="form-input" placeholder="0" value={txnMonto} onChange={e => setTxnMonto(e.target.value)} inputMode="decimal" required style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center' }} />
          </div>
          <div className="form-group">
            <label className="form-label">Categoría</label>
            <div className="cat-grid">
              {catsFiltered.map(c => (
                <button key={c.id} type="button" className={`cat-btn${txnCatId === c.id ? ' selected' : ''}`} onClick={() => setTxnCatId(c.id)}>
                  <CategoryIcon name={c.icono} size={18} />
                  <span>{c.nombre}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Descripción (opcional)</label>
            <input type="text" className="form-input" placeholder="Ej: Mercado semanal" value={txnDesc} onChange={e => setTxnDesc(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" value={txnFecha} onChange={e => setTxnFecha(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={saving || !txnMonto || !txnCatId}>
            {saving ? 'Guardando...' : editTxn ? 'Actualizar' : 'Guardar'}
          </button>
          {editTxn && (
            <button type="button" onClick={deleteTxn} disabled={saving} style={{ width: '100%', marginTop: '0.5rem', background: 'rgba(255,92,92,0.1)', color: 'var(--error)', border: '1px solid rgba(255,92,92,0.3)', borderRadius: '0.625rem', padding: '0.75rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>
              Eliminar transacción
            </button>
          )}
        </form>
      </Modal>
    </div>
  )
}
