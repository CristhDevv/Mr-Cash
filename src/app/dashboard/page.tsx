'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, ChevronDown, ChevronUp, TrendingUp, TrendingDown, ArrowRight, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, formatShortDate, getMonthRange } from '@/lib/utils/format'
import { calcularReservaDiaria } from '@/lib/utils/reserva'
import { CategoryIcon } from '@/components/CategoryIcon'
import { Modal } from '@/components/Modal'

interface Txn {
  id: string; monto: number; tipo: string; descripcion: string | null
  fecha: string; categoria_id: string | null
  categorias: { nombre: string; color: string | null; icono: string | null } | null
}
interface GastoFijo { id: string; nombre: string; monto: number; dia_del_mes: number; activo: boolean }
interface Presupuesto {
  id: string; monto_limite: number; categoria_id: string
  categorias: { nombre: string; color: string | null; icono: string | null } | null
}
interface Categoria { id: string; nombre: string; tipo: string; color: string | null; icono: string | null }

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [nombre, setNombre] = useState('')
  const [ingresoDiario, setIngresoDiario] = useState(0)
  const [txns, setTxns] = useState<Txn[]>([])
  const [gastosFijos, setGastosFijos] = useState<GastoFijo[]>([])
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [showDesglose, setShowDesglose] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [txnMonto, setTxnMonto] = useState('')
  const [txnTipo, setTxnTipo] = useState<'ingreso' | 'gasto'>('gasto')
  const [txnCatId, setTxnCatId] = useState('')
  const [txnDesc, setTxnDesc] = useState('')
  const [txnFecha, setTxnFecha] = useState(new Date().toISOString().split('T')[0])
  const [txnSaving, setTxnSaving] = useState(false)

  const now = new Date()
  const mes = now.getMonth() + 1
  const ano = now.getFullYear()
  const { start, end } = getMonthRange(mes, ano)

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const [profileRes, txnRes, fijosRes, presRes, catRes] = await Promise.all([
      supabase.from('profiles').select('nombre, ingreso_diario_esperado').eq('id', user.id).single(),
      supabase.from('transacciones').select('id,monto,tipo,descripcion,fecha,categoria_id,categorias(nombre,color,icono)')
        .eq('user_id', user.id).gte('fecha', start).lte('fecha', end).order('fecha', { ascending: false }),
      supabase.from('gastos_fijos').select('id,nombre,monto,dia_del_mes,activo').eq('user_id', user.id).eq('activo', true),
      supabase.from('presupuestos').select('id,monto_limite,categoria_id,categorias(nombre,color,icono)')
        .eq('user_id', user.id).eq('mes', mes).eq('año', ano).limit(3),
      supabase.from('categorias').select('id,nombre,tipo,color,icono').eq('user_id', user.id).order('nombre'),
    ])
    setNombre(profileRes.data?.nombre || '')
    setIngresoDiario(profileRes.data?.ingreso_diario_esperado || 0)
    setTxns((txnRes.data || []) as unknown as Txn[])
    setGastosFijos(fijosRes.data || [])
    setPresupuestos((presRes.data || []) as unknown as Presupuesto[])
    setCategorias(catRes.data || [])
    setLoading(false)
  }, [start, end, mes, ano, router])

  useEffect(() => { fetchData() }, [fetchData])

  const ingresos = txns.filter(t => t.tipo === 'ingreso').reduce((s, t) => s + t.monto, 0)
  const gastos = txns.filter(t => t.tipo === 'gasto').reduce((s, t) => s + t.monto, 0)
  const balance = ingresos - gastos
  const { items: reservaItems, totalDiario } = calcularReservaDiaria(gastosFijos)
  const presConGasto = presupuestos.map(p => {
    const gastado = txns.filter(t => t.tipo === 'gasto' && t.categoria_id === p.categoria_id).reduce((s, t) => s + t.monto, 0)
    const pct = p.monto_limite > 0 ? Math.min((gastado / p.monto_limite) * 100, 100) : 0
    return { ...p, gastado, pct }
  })
  const catsFiltered = categorias.filter(c => c.tipo === txnTipo)

  async function saveTxn(e: React.FormEvent) {
    e.preventDefault()
    if (!txnMonto || !txnCatId) return
    setTxnSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('transacciones').insert({
      user_id: user.id, monto: parseFloat(txnMonto), tipo: txnTipo,
      categoria_id: txnCatId, descripcion: txnDesc || null, fecha: txnFecha,
    })
    setTxnMonto(''); setTxnDesc(''); setTxnCatId(''); setShowModal(false); setTxnSaving(false)
    await fetchData()
  }

  const fechaLabel = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  const firstName = nombre?.split(' ')[0] || 'Usuario'

  if (loading) return (
    <div className="page">
      <div className="skeleton" style={{ height: '1.5rem', width: '55%', marginBottom: '1.5rem' }} />
      <div className="card skeleton" style={{ height: '8rem' }} />
      <div className="card skeleton" style={{ height: '5rem' }} />
      <div className="card skeleton" style={{ height: '6rem' }} />
    </div>
  )

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem', textTransform: 'capitalize' }}>{fechaLabel}</p>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.03em' }}>Hola, {firstName} 👋</h1>
        </div>
        <Link
          href="/perfil"
          style={{
            width: '2.5rem',
            height: '2.5rem',
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          aria-label="Perfil y Configuración"
        >
          <Settings size={20} />
        </Link>
      </div>

      {/* Balance */}
      <div className="card balance-card">
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Balance del mes</p>
        <p className="balance-amount" style={{ color: balance >= 0 ? 'var(--accent)' : 'var(--error)' }}>{formatCOP(balance)}</p>
        <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <TrendingUp size={13} color="var(--accent)" />
            <span style={{ fontSize: '0.8125rem', color: 'var(--accent)', fontWeight: 600 }}>{formatCOP(ingresos)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <TrendingDown size={13} color="var(--error)" />
            <span style={{ fontSize: '0.8125rem', color: 'var(--error)', fontWeight: 600 }}>{formatCOP(gastos)}</span>
          </div>
        </div>
      </div>

      {/* Reserva Diaria */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>Reservar hoy</p>
            <p style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.03em' }}>{formatCOP(totalDiario)}</p>
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {reservaItems.length} compromisos fijos activos
            </p>
          </div>
          <button onClick={() => setShowDesglose(!showDesglose)} style={{
            display: 'flex', alignItems: 'center', gap: '0.25rem',
            background: 'var(--accent-dim)', color: 'var(--accent)',
            border: 'none', borderRadius: '0.5rem', padding: '0.5rem 0.75rem',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Ver desglose {showDesglose ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
        {showDesglose && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
            {reservaItems.length === 0
              ? <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>Sin gastos fijos activos. <Link href="/gastos-fijos" style={{ color: 'var(--accent)' }}>Agregar</Link></p>
              : reservaItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(46,46,46,0.5)' }}>
                  <div>
                    <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{item.nombre}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>Día {item.dia_del_mes} · {item.diasRestantes} días</p>
                  </div>
                  <p style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9375rem' }}>{formatCOP(item.cuotaDiaria)}<span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>/día</span></p>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Ingreso Comprometido Indicator */}
      {ingresoDiario > 0 ? (
        <div style={{ marginBottom: '1.5rem', marginTop: '0.5rem', padding: '0 0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Comprometido: {formatCOP(totalDiario)}</span>
            <span>Libre: {formatCOP(Math.max(ingresoDiario - totalDiario, 0))}</span>
          </div>
          <div className="progress-bar-wrap" style={{ height: '6px', background: 'rgba(255,255,255,0.1)' }}>
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${Math.min((totalDiario / ingresoDiario) * 100, 100)}%`, 
                background: totalDiario > ingresoDiario ? 'var(--error)' : 'var(--accent)' 
              }} 
            />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
            De {formatCOP(ingresoDiario)}/día, tienes {formatCOP(totalDiario)} comprometidos — te quedan {formatCOP(Math.max(ingresoDiario - totalDiario, 0))} libres.
          </p>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '1.5rem', marginTop: '0.5rem', padding: '1rem', textAlign: 'center', background: 'rgba(255,196,0,0.1)', border: '1px solid rgba(255,196,0,0.2)' }}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--warning)', marginBottom: '0.5rem' }}>No has configurado tu ingreso diario esperado.</p>
          <Link href="/perfil" style={{ color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 600 }}>Configurar en el perfil →</Link>
        </div>
      )}

      {/* Presupuestos */}
      <div>
        <div className="section-header">
          <span className="section-title">Presupuestos</span>
          <Link href="/presupuestos" className="section-link">Ver todos →</Link>
        </div>
        {presConGasto.length === 0
          ? <div className="card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>Sin presupuestos este mes</p>
              <Link href="/presupuestos" style={{ color: 'var(--accent)', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none', background: 'var(--accent-dim)', padding: '0.375rem 0.875rem', borderRadius: '0.5rem' }}>Crear presupuesto</Link>
            </div>
          : presConGasto.map(p => {
              const barColor = p.pct >= 90 ? 'var(--error)' : p.pct >= 70 ? 'var(--warning)' : 'var(--accent)'
              return (
                <div key={p.id} className="card card-sm" style={{ marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', background: `${p.categorias?.color || '#666'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CategoryIcon name={p.categorias?.icono} size={14} />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.categorias?.nombre}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatCOP(p.gastado)} / {formatCOP(p.monto_limite)}</span>
                  </div>
                  <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${p.pct}%`, background: barColor }} /></div>
                </div>
              )
            })}
      </div>

      {/* Últimas transacciones */}
      <div style={{ marginTop: '0.5rem' }}>
        <div className="section-header">
          <span className="section-title">Últimas transacciones</span>
          <Link href="/transacciones" className="section-link">Ver todas →</Link>
        </div>
        <div className="card card-sm">
          {txns.slice(0, 5).length === 0
            ? <div className="empty-state" style={{ padding: '1.5rem' }}><p className="empty-desc">Sin transacciones este mes</p></div>
            : txns.slice(0, 5).map(t => (
                <div key={t.id} className="txn-item">
                  <div className="txn-icon" style={{ background: `${t.categorias?.color || '#888'}22` }}>
                    <CategoryIcon name={t.categorias?.icono} size={16} />
                  </div>
                  <div className="txn-info">
                    <p className="txn-name">{t.categorias?.nombre || 'Sin categoría'}</p>
                    {t.descripcion && <p className="txn-desc">{t.descripcion}</p>}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p className={t.tipo === 'ingreso' ? 'amount-pos' : 'amount-neg'}>{t.tipo === 'ingreso' ? '+' : '-'}{formatCOP(t.monto)}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{formatShortDate(t.fecha)}</p>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* FAB */}
      <button className="fab" onClick={() => setShowModal(true)} aria-label="Agregar transacción"><Plus size={24} /></button>

      {/* Modal Add Transaction */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Nueva transacción">
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
            <input type="text" className="form-input" placeholder="Ej: Almuerzo" value={txnDesc} onChange={e => setTxnDesc(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha</label>
            <input type="date" className="form-input" value={txnFecha} onChange={e => setTxnFecha(e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary" disabled={txnSaving || !txnMonto || !txnCatId}>
            {txnSaving ? 'Guardando...' : 'Guardar transacción'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
