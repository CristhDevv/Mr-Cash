'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, LogOut, Trash2, Calendar, Target, Copy, Check, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, getDaysRemaining } from '@/lib/utils/format'
import { Modal } from '@/components/Modal'
import { ConfirmModal } from '@/components/ConfirmModal'
import { toast } from 'react-hot-toast'
import { generarCodigoInvitacion, unirseAlHogar } from '@/app/actions/hogar'

interface Miembro {
  id: string
  user_id: string
  rol: 'admin' | 'miembro'
  estado: 'pendiente' | 'activo'
  profiles: {
    nombre: string | null
  } | null
}

interface PresupuestoHogar {
  id: string
  categoria_nombre: string
  monto_limite: number
  mes: number
  año: number
}

interface MetaHogar {
  id: string
  nombre: string
  monto_objetivo: number
  monto_actual: number
  fecha_limite: string | null
  color: string | null
}

interface GastoMatch {
  monto: number
  categoria_nombre: string
}

export default function HogarPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<{ id: string; hogar_id: string | null } | null>(null)
  
  // Household data state
  const [hogar, setHogar] = useState<{ id: string; nombre: string; creado_por: string | null; codigo_invitacion: string | null; codigo_expira_at: string | null } | null>(null)
  const [miembros, setMiembros] = useState<Miembro[]>([])
  const [presupuestos, setPresupuestos] = useState<PresupuestoHogar[]>([])
  const [metas, setMetas] = useState<MetaHogar[]>([])
  const [gastosAgregados, setGastosAgregados] = useState<GastoMatch[]>([])

  // Invite states
  const [copied, setCopied] = useState(false)
  const [generatingInvite, setGeneratingInvite] = useState(false)

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [showAddBudgetModal, setShowAddBudgetModal] = useState(false)
  const [showAddGoalModal, setShowAddGoalModal] = useState(false)
  const [showAbonoModal, setShowAbonoModal] = useState(false)
  const [showConfirmLeave, setShowConfirmLeave] = useState(false)
  const [selectedMeta, setSelectedMeta] = useState<MetaHogar | null>(null)

  // Form states
  const [formHogarNombre, setFormHogarNombre] = useState('')
  const [formCodigoInvitacion, setFormCodigoInvitacion] = useState('')
  const [formCategoriaNombre, setFormCategoriaNombre] = useState('')
  const [formMontoLimite, setFormMontoLimite] = useState('')
  const [formGoalNombre, setFormGoalNombre] = useState('')
  const [formGoalMontoObjetivo, setFormGoalMontoObjetivo] = useState('')
  const [formGoalMontoActual, setFormGoalMontoActual] = useState('0')
  const [formGoalFechaLimite, setFormGoalFechaLimite] = useState('')
  const [formGoalColor, setFormGoalColor] = useState('#00C48C')
  const [formAbonoMonto, setFormAbonoMonto] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const now = new Date()
  const mesActual = now.getMonth() + 1
  const añoActual = now.getFullYear()

  const fetchHogarData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, hogar_id')
      .eq('id', user.id)
      .single()

    setUserProfile(profile)

    if (profile?.hogar_id) {
      // 1. Fetch household info
      const { data: hogarData } = await supabase
        .from('hogares')
        .select('*')
        .eq('id', profile.hogar_id)
        .single()
      
      setHogar(hogarData)

      if (hogarData) {
        // 2. Fetch household members
        const { data: membersData } = await supabase
          .from('hogar_miembros')
          .select('id, user_id, rol, estado, profiles(nombre)')
          .eq('hogar_id', profile.hogar_id)
        
        const activeMembers = membersData || []
        setMiembros(activeMembers as unknown as Miembro[])

        // Get list of active user IDs
        const activeUserIds = activeMembers
          .filter(m => m.estado === 'activo')
          .map(m => m.user_id)

        // 3. Fetch budgets
        const { data: budgetsData } = await supabase
          .from('presupuestos_hogar')
          .select('*')
          .eq('hogar_id', profile.hogar_id)
          .eq('mes', mesActual)
          .eq('año', añoActual)
        
        setPresupuestos(budgetsData || [])

        // 4. Fetch goals
        const { data: goalsData } = await supabase
          .from('metas_hogar')
          .select('*')
          .eq('hogar_id', profile.hogar_id)
          .order('created_at', { ascending: false })
        
        setMetas(goalsData || [])

        // 5. Fetch all expenses of all active household members for matching budget aggregation
        if (activeUserIds.length > 0) {
          const startOfMonth = new Date(añoActual, mesActual - 1, 1).toISOString().split('T')[0]
          const endOfMonth = new Date(añoActual, mesActual, 0).toISOString().split('T')[0]

          const { data: txnsData } = await supabase
            .from('transacciones')
            .select('monto, categorias(nombre)')
            .in('user_id', activeUserIds)
            .eq('tipo', 'gasto')
            .gte('fecha', startOfMonth)
            .lte('fecha', endOfMonth)

          const formattedGastos: GastoMatch[] = (txnsData || []).map(t => {
            const cat = t.categorias
            const name = Array.isArray(cat) 
              ? (cat[0]?.nombre || '') 
              : (cat as any)?.nombre || ''
            return {
              monto: t.monto,
              categoria_nombre: name
            }
          })
          setGastosAgregados(formattedGastos)
        }
      }
    } else {
      setHogar(null)
      setMiembros([])
      setPresupuestos([])
      setMetas([])
      setGastosAgregados([])
    }
    setLoading(false)
  }, [router, mesActual, añoActual])

  useEffect(() => {
    fetchHogarData()
  }, [fetchHogarData])

  const handleCreateHogar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formHogarNombre.trim()) return

    setSubmitting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      // 1. Create household
      const { data: newHogar, error: hogarError } = await supabase
        .from('hogares')
        .insert({ nombre: formHogarNombre, creado_por: user.id })
        .select()
        .single()

      if (hogarError || !newHogar) throw new Error('Error al crear el hogar')

      // 2. Add creator as admin member
      const { error: memberError } = await supabase
        .from('hogar_miembros')
        .insert({
          hogar_id: newHogar.id,
          user_id: user.id,
          rol: 'admin',
          estado: 'activo'
        })

      if (memberError) throw new Error('Error al crear el miembro')

      // 3. Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ hogar_id: newHogar.id })
        .eq('id', user.id)

      if (profileError) throw new Error('Error al asociar el perfil')

      toast.success('Hogar creado con éxito')
      setShowCreateModal(false)
      setFormHogarNombre('')
      await fetchHogarData()
    } catch (err: any) {
      toast.error(err.message || 'Error en la operación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleJoinHogar = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = formCodigoInvitacion.trim()
    if (code.length !== 6) {
      toast.error('El código debe ser de 6 caracteres')
      return
    }

    setSubmitting(true)
    try {
      // All validation and DB writes happen on the server
      const result = await unirseAlHogar(code)

      if ('error' in result) {
        throw new Error(result.error)
      }

      toast.success(`Te has unido a "${result.hogarNombre}"`)
      setShowJoinModal(false)
      setFormCodigoInvitacion('')
      await fetchHogarData()
    } catch (err: any) {
      toast.error(err.message || 'Error en la operación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleGenerateInvite = async () => {
    if (!hogar) return
    setGeneratingInvite(true)

    try {
      // Code is generated with crypto.randomBytes on the server — never on the client
      const result = await generarCodigoInvitacion(hogar.id)

      if ('error' in result) {
        throw new Error(result.error)
      }

      toast.success('Código de invitación generado')
      setHogar({
        ...hogar,
        codigo_invitacion: result.code,
        codigo_expira_at: result.expiresAt,
      })
    } catch (err: any) {
      toast.error(err.message || 'Error al generar código de invitación')
    } finally {
      setGeneratingInvite(false)
    }
  }

  const handleCopyCode = () => {
    if (!hogar?.codigo_invitacion) return
    navigator.clipboard.writeText(hogar.codigo_invitacion)
    setCopied(true)
    toast.success('Código copiado al portapapeles')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleLeaveOrDeleteHogar = async () => {
    if (!hogar || !userProfile) return
    setSubmitting(true)
    const supabase = createClient()

    const miRol = miembros.find(m => m.user_id === userProfile.id)?.rol
    const isAdmin = miRol === 'admin'

    try {
      if (isAdmin) {
        // Admin deletes or leaves. "Si el admin abandona o elimina el hogar, todos los miembros quedan sin hogar (hogar_id = null en sus perfiles)"
        // 1. Set hogar_id = null in profiles of all members
        const { error: profileResetError } = await supabase
          .from('profiles')
          .update({ hogar_id: null })
          .eq('hogar_id', hogar.id)

        if (profileResetError) throw new Error('Error al desasociar miembros')

        // 2. Delete the household row
        const { error: deleteError } = await supabase
          .from('hogares')
          .delete()
          .eq('id', hogar.id)

        if (deleteError) throw new Error('Error al eliminar el hogar')

        toast.success('Hogar eliminado y disuelto exitosamente')
      } else {
        // Member leaves
        // 1. Delete member row
        const { error: deleteMemberError } = await supabase
          .from('hogar_miembros')
          .delete()
          .eq('hogar_id', hogar.id)
          .eq('user_id', userProfile.id)

        if (deleteMemberError) throw new Error('Error al salir del hogar')

        // 2. Update profile
        const { error: profileResetError } = await supabase
          .from('profiles')
          .update({ hogar_id: null })
          .eq('id', userProfile.id)

        if (profileResetError) throw new Error('Error al actualizar tu perfil')

        toast.success('Has salido del hogar')
      }

      setShowConfirmLeave(false)
      await fetchHogarData()
    } catch (err: any) {
      toast.error(err.message || 'Error en la operación')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCategoriaNombre.trim() || !formMontoLimite) return

    setSubmitting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('presupuestos_hogar')
      .insert({
        hogar_id: hogar?.id,
        categoria_nombre: formCategoriaNombre.trim(),
        monto_limite: parseFloat(formMontoLimite),
        mes: mesActual,
        año: añoActual
      })

    setSubmitting(false)
    if (!error) {
      toast.success('Presupuesto compartido creado')
      setShowAddBudgetModal(false)
      setFormCategoriaNombre('')
      setFormMontoLimite('')
      await fetchHogarData()
    } else {
      toast.error('Error al crear presupuesto')
    }
  }

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formGoalNombre.trim() || !formGoalMontoObjetivo) return

    setSubmitting(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('metas_hogar')
      .insert({
        hogar_id: hogar?.id,
        nombre: formGoalNombre.trim(),
        monto_objetivo: parseFloat(formGoalMontoObjetivo),
        monto_actual: parseFloat(formGoalMontoActual) || 0,
        fecha_limite: formGoalFechaLimite || null,
        color: formGoalColor
      })

    setSubmitting(false)
    if (!error) {
      toast.success('Meta compartida creada')
      setShowAddGoalModal(false)
      setFormGoalNombre('')
      setFormGoalMontoObjetivo('')
      setFormGoalMontoActual('0')
      setFormGoalFechaLimite('')
      setFormGoalColor('#00C48C')
      await fetchHogarData()
    } else {
      toast.error('Error al crear meta compartida')
    }
  }

  const handleAbono = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedMeta || !formAbonoMonto || !userProfile) return

    setSubmitting(true)
    const supabase = createClient()

    const abonoValue = parseFloat(formAbonoMonto)
    const nuevoMonto = selectedMeta.monto_actual + abonoValue

    // Update shared goal
    const { error: updateError } = await supabase
      .from('metas_hogar')
      .update({ monto_actual: nuevoMonto })
      .eq('id', selectedMeta.id)

    if (!updateError) {
      // Find or default a category to register the transfer
      const { data: catData } = await supabase
        .from('categorias')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('nombre', 'Ahorro')
        .single()

      let catId = catData?.id
      if (!catId) {
        const { data: allCats } = await supabase.from('categorias').select('id').eq('user_id', userProfile.id).limit(1)
        if (allCats && allCats.length > 0) catId = allCats[0].id
      }

      // Log the contribution as a transfer transaction in the contributor's personal finance ledger
      if (catId) {
        await supabase.from('transacciones').insert({
          user_id: userProfile.id,
          monto: abonoValue,
          tipo: 'transferencia',
          categoria_id: catId,
          descripcion: `Abono a meta hogar: ${selectedMeta.nombre}`,
          fecha: new Date().toISOString().split('T')[0]
        })
      }

      toast.success('Abono compartido registrado con éxito')
      setShowAbonoModal(false)
      setFormAbonoMonto('')
      await fetchHogarData()
    } else {
      toast.error('Error al registrar abono')
    }
    setSubmitting(false)
  }

  const getInitials = (nombre: string) => {
    if (!nombre) return 'M'
    return nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  }

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: '2.5rem', width: '50%', marginBottom: '2rem' }} />
        <div className="card skeleton" style={{ height: '8rem', marginBottom: '1rem' }} />
        <div className="card skeleton" style={{ height: '12rem' }} />
      </div>
    )
  }

  const miMiembro = miembros.find(m => m.user_id === userProfile?.id)
  const isAdmin = miMiembro?.rol === 'admin'

  return (
    <div className="page" style={{ paddingBottom: '6rem' }}>
      {!hogar ? (
        // NO HOUSEHOLD STATE
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center', minHeight: '80vh' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '4.5rem',
              height: '4.5rem',
              borderRadius: '50%',
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent)',
              margin: '0 auto 1rem auto'
            }}>
              <Users size={36} />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>Hogar Compartido</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', maxWidth: '300px', margin: '0 auto' }}>
              Administra presupuestos compartidos y metas de ahorro junto a tu pareja, familia o roomies.
            </p>
          </div>

          <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Crear un nuevo Hogar</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Inicia un hogar e invita a otros miembros compartiendo un código único.
            </p>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>Crear Hogar</button>
          </div>

          <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Tengo un código</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              ¿Te invitaron a un hogar existente? Ingresa el código de 6 caracteres para unirte.
            </p>
            <button className="btn-secondary" onClick={() => setShowJoinModal(true)}>Ingresar Código</button>
          </div>
        </div>
      ) : (
        // ACTIVE HOUSEHOLD VIEW
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.125rem' }}>Finanzas del Hogar</p>
              <h1 style={{ fontSize: '1.625rem', fontWeight: 800, letterSpacing: '-0.03em', margin: 0 }}>{hogar.nombre}</h1>
            </div>
            <button
              onClick={() => setShowConfirmLeave(true)}
              style={{
                background: 'rgba(255,92,92,0.1)',
                border: '1px solid rgba(255,92,92,0.3)',
                color: 'var(--error)',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem'
              }}
            >
              {isAdmin ? <Trash2 size={14} /> : <LogOut size={14} />}
              {isAdmin ? 'Disolver' : 'Salir'}
            </button>
          </div>

          {/* Members List */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Users size={16} color="var(--accent)" />
              Miembros ({miembros.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {miembros.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '2.25rem',
                      height: '2.25rem',
                      borderRadius: '50%',
                      background: m.rol === 'admin' ? 'var(--accent-dim)' : 'rgba(255,255,255,0.06)',
                      color: m.rol === 'admin' ? 'var(--accent)' : 'var(--text-primary)',
                      border: m.rol === 'admin' ? '1px solid rgba(0,196,140,0.3)' : '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8125rem',
                      fontWeight: 700
                    }}>
                      {getInitials(m.profiles?.nombre || '')}
                    </div>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{m.profiles?.nombre || 'Usuario Invitado'}</p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                        {m.rol === 'admin' ? 'Administrador' : 'Miembro'}
                      </p>
                    </div>
                  </div>
                  {m.estado === 'pendiente' && (
                    <span style={{
                      fontSize: '0.6875rem',
                      background: 'rgba(255,196,0,0.1)',
                      color: 'var(--warning)',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '1rem',
                      fontWeight: 600
                    }}>
                      Pendiente
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Invite Section (Admin Only) */}
            {isAdmin && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
                {!hogar.codigo_invitacion ? (
                  <button
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                    onClick={handleGenerateInvite}
                    disabled={generatingInvite}
                  >
                    Generar código de invitación
                  </button>
                ) : (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                      Código de invitación activo (24h de validez):
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px dashed var(--border)',
                        borderRadius: '0.5rem',
                        padding: '0.5rem 0.75rem',
                        fontFamily: 'monospace',
                        fontSize: '1rem',
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textAlign: 'center',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {hogar.codigo_invitacion}
                      </div>
                      <button
                        onClick={handleCopyCode}
                        style={{
                          background: 'var(--accent-dim)',
                          border: 'none',
                          color: 'var(--accent)',
                          borderRadius: '0.5rem',
                          padding: '0.5rem 0.75rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {copied ? <Check size={18} /> : <Copy size={18} />}
                      </button>
                    </div>
                    <button
                      className="section-link"
                      style={{ marginTop: '0.5rem', fontSize: '0.75rem', background: 'none', border: 'none', padding: 0 }}
                      onClick={handleGenerateInvite}
                    >
                      Generar nuevo código
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Compartidos Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Presupuestos Compartidos */}
            <div>
              <div className="section-header">
                <span className="section-title">Presupuestos Compartidos</span>
                <button
                  onClick={() => setShowAddBudgetModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Plus size={16} /> Agregar
                </button>
              </div>

              {presupuestos.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                    Aún no hay presupuestos compartidos este mes.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {presupuestos.map(p => {
                    // Match transacciones with exactly matching name (case insensitive)
                    const totalGastado = gastosAgregados
                      .filter(g => g.categoria_nombre.toLowerCase() === p.categoria_nombre.toLowerCase())
                      .reduce((acc, curr) => acc + curr.monto, 0)
                    
                    const pct = p.monto_limite > 0 ? Math.min((totalGastado / p.monto_limite) * 100, 100) : 0
                    const barColor = pct >= 90 ? 'var(--error)' : pct >= 70 ? 'var(--warning)' : 'var(--accent)'

                    return (
                      <div key={p.id} className="card card-sm">
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '0.375rem', background: 'rgba(0,196,140,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <Target size={14} color="var(--accent)" />
                            </div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.categoria_nombre}</span>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {formatCOP(totalGastado)} / {formatCOP(p.monto_limite)}
                          </span>
                        </div>
                        <div className="progress-bar-wrap">
                          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Metas Compartidas */}
            <div>
              <div className="section-header">
                <span className="section-title">Metas Compartidas</span>
                <button
                  onClick={() => setShowAddGoalModal(true)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                >
                  <Plus size={16} /> Agregar
                </button>
              </div>

              {metas.length === 0 ? (
                <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                    No hay metas de ahorro compartidas creadas.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {metas.map(meta => {
                    const pct = meta.monto_objetivo > 0 ? Math.min((meta.monto_actual / meta.monto_objetivo) * 100, 100) : 0
                    const dias = meta.fecha_limite ? getDaysRemaining(meta.fecha_limite) : null

                    // circular progress sizing
                    const radius = 28
                    const stroke = 4
                    const normalizedRadius = radius - stroke
                    const circumference = normalizedRadius * 2 * Math.PI
                    const strokeDashoffset = circumference - (pct / 100) * circumference

                    return (
                      <div key={meta.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', flex: 1 }}>
                          
                          {/* Circular SVG */}
                          <div style={{ position: 'relative', width: radius * 2, height: radius * 2, flexShrink: 0 }}>
                            <svg height={radius * 2} width={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
                              <circle stroke="rgba(255,255,255,0.06)" fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
                              <circle stroke={meta.color || 'var(--accent)'} fill="transparent" strokeWidth={stroke} strokeDasharray={circumference + ' ' + circumference} style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.35s' }} strokeLinecap="round" r={normalizedRadius} cx={radius} cy={radius} />
                            </svg>
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                              {Math.round(pct)}%
                            </div>
                          </div>

                          <div>
                            <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '0.125rem' }}>{meta.nombre}</h3>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {formatCOP(meta.monto_actual)} de {formatCOP(meta.monto_objetivo)}
                            </p>
                            {dias !== null && (
                              <p style={{ fontSize: '0.6875rem', color: dias > 0 ? 'var(--text-muted)' : 'var(--error)', marginTop: '0.125rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <Calendar size={10} />
                                {dias > 0 ? `${dias} días` : 'Vencida'}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          className="btn-primary"
                          onClick={() => {
                            setSelectedMeta(meta)
                            setShowAbonoModal(true)
                          }}
                          style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem', borderRadius: '0.375rem', fontWeight: 700, width: 'auto' }}
                        >
                          Abonar
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* CREATE HOUSEHOLD MODAL */}
      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Crear Nuevo Hogar">
        <form onSubmit={handleCreateHogar}>
          <div className="form-group">
            <label className="form-label">Nombre del Hogar</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Familia García, Mi Hogar..."
              value={formHogarNombre}
              onChange={e => setFormHogarNombre(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting || !formHogarNombre.trim()}>
            {submitting ? 'Creando...' : 'Crear e Iniciar'}
          </button>
        </form>
      </Modal>

      {/* JOIN HOUSEHOLD MODAL */}
      <Modal isOpen={showJoinModal} onClose={() => setShowJoinModal(false)} title="Unirse a un Hogar">
        <form onSubmit={handleJoinHogar}>
          <div className="form-group">
            <label className="form-label">Código de invitación (6 caracteres)</label>
            <input
              type="text"
              className="form-input"
              placeholder="EJ: X8A9P2"
              maxLength={6}
              value={formCodigoInvitacion}
              onChange={e => setFormCodigoInvitacion(e.target.value.toUpperCase())}
              required
              style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.1em' }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting || formCodigoInvitacion.trim().length !== 6}>
            {submitting ? 'Verificando...' : 'Unirse al Hogar'}
          </button>
        </form>
      </Modal>

      {/* ADD SHARED BUDGET MODAL */}
      <Modal isOpen={showAddBudgetModal} onClose={() => setShowAddBudgetModal(false)} title="Nuevo Presupuesto Compartido">
        <form onSubmit={handleAddBudget}>
          <div className="form-group">
            <label className="form-label">Nombre de Categoría</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Alimentación, Servicios..."
              value={formCategoriaNombre}
              onChange={e => setFormCategoriaNombre(e.target.value)}
              required
            />
            <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Info size={12} />
              Sumará los gastos de todos los miembros donde la categoría se llame igual.
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Monto Límite Mensual (COP)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={formMontoLimite}
              onChange={e => setFormMontoLimite(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting || !formCategoriaNombre.trim() || !formMontoLimite}>
            {submitting ? 'Guardando...' : 'Agregar Presupuesto'}
          </button>
        </form>
      </Modal>

      {/* ADD SHARED GOAL MODAL */}
      <Modal isOpen={showAddGoalModal} onClose={() => setShowAddGoalModal(false)} title="Nueva Meta Compartida">
        <form onSubmit={handleAddGoal}>
          <div className="form-group">
            <label className="form-label">Nombre de la meta</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej: Vacaciones, Enganche casa..."
              value={formGoalNombre}
              onChange={e => setFormGoalNombre(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Monto objetivo (COP)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={formGoalMontoObjetivo}
              onChange={e => setFormGoalMontoObjetivo(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Ahorro inicial (COP) - Opcional</label>
            <input
              type="number"
              className="form-input"
              value={formGoalMontoActual}
              onChange={e => setFormGoalMontoActual(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Fecha límite (Opcional)</label>
            <input
              type="date"
              className="form-input"
              value={formGoalFechaLimite}
              onChange={e => setFormGoalFechaLimite(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Color de la barra</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.375rem' }}>
              {['#00C48C', '#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#EC4899'].map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFormGoalColor(c)}
                  style={{
                    width: '2rem',
                    height: '2rem',
                    borderRadius: '50%',
                    backgroundColor: c,
                    border: formGoalColor === c ? '2px solid #fff' : 'none',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary" disabled={submitting || !formGoalNombre.trim() || !formGoalMontoObjetivo}>
            {submitting ? 'Creando...' : 'Crear Meta Compartida'}
          </button>
        </form>
      </Modal>

      {/* ABONAR TO SHARED GOAL MODAL */}
      <Modal isOpen={showAbonoModal} onClose={() => setShowAbonoModal(false)} title={`Abonar a ${selectedMeta?.nombre}`}>
        <form onSubmit={handleAbono}>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
            Ahorrado actual: {selectedMeta ? formatCOP(selectedMeta.monto_actual) : ''} de {selectedMeta ? formatCOP(selectedMeta.monto_objetivo) : ''}.
          </p>
          <div className="form-group">
            <label className="form-label">Monto del abono personal (COP)</label>
            <input
              type="number"
              className="form-input"
              placeholder="0"
              value={formAbonoMonto}
              onChange={e => setFormAbonoMonto(e.target.value)}
              required
              style={{ fontSize: '1.25rem', fontWeight: 700, textAlign: 'center' }}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting || !formAbonoMonto}>
            {submitting ? 'Registrando...' : 'Confirmar Abono Compartido'}
          </button>
        </form>
      </Modal>

      {/* LEAVE/DELETE CONFIRM MODAL */}
      <ConfirmModal
        isOpen={showConfirmLeave}
        onClose={() => setShowConfirmLeave(false)}
        title={isAdmin ? "Disolver Hogar" : "Salir del Hogar"}
        message={isAdmin 
          ? "¿Estás completamente seguro de disolver este hogar? Todos los miembros perderán la vinculación y se eliminarán presupuestos y metas compartidas."
          : "¿Estás seguro de que deseas salir de este hogar compartido?"
        }
        onConfirm={handleLeaveOrDeleteHogar}
      />
    </div>
  )
}
