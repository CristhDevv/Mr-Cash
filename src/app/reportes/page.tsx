'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCOP, getMonthRange, getMonthLabel } from '@/lib/utils/format'
import { CategoryIcon } from '@/components/CategoryIcon'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts'

interface CategoryExpense {
  name: string
  value: number
  color: string
  icono: string | null
}

interface MonthlyComparison {
  name: string
  ingresos: number
  gastos: number
}

export default function ReportesPage() {
  const router = useRouter()
  const now = new Date()
  const [mes, setMes] = useState(now.getMonth() + 1)
  const [ano, setAno] = useState(now.getFullYear())
  const [loading, setLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // Chart Data states
  const [categoryData, setCategoryData] = useState<CategoryExpense[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyComparison[]>([])
  const [topCategories, setTopCategories] = useState<CategoryExpense[]>([])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // 1. Fetch current month transactions to build Category Pie Chart
    const { start, end } = getMonthRange(mes, ano)
    const { data: currentTxns, error: currentTxnsError } = await supabase
      .from('transacciones')
      .select('monto, tipo, categoria_id, categorias(nombre, color, icono)')
      .eq('user_id', user.id)
      .gte('fecha', start)
      .lte('fecha', end)

    if (currentTxnsError) {
      setLoading(false)
      return
    }

    // 2. Fetch past 6 months transactions for the Bar Chart comparison
    // Calculate 6 months ago start date
    const sixMonthsAgo = new Date(ano, mes - 6, 1)
    const sixMonthsAgoStart = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`
    
    const { data: comparisonTxns, error: comparisonError } = await supabase
      .from('transacciones')
      .select('monto, tipo, fecha')
      .eq('user_id', user.id)
      .gte('fecha', sixMonthsAgoStart)
      .lte('fecha', end)

    if (comparisonError) {
      setLoading(false)
      return
    }

    // Process current month category details (only gastos)
    const expensesByCategory: Record<string, { total: number; color: string; icono: string | null }> = {}
    
    const rawTxns = (currentTxns || []) as any[]
    rawTxns
      .filter(t => t.tipo === 'gasto')
      .forEach(t => {
        const catObj = Array.isArray(t.categorias) ? t.categorias[0] : t.categorias
        const catName = catObj?.nombre || 'Otros'
        const catColor = catObj?.color || '#888888'
        const catIcon = catObj?.icono || null
        if (!expensesByCategory[catName]) {
          expensesByCategory[catName] = { total: 0, color: catColor, icono: catIcon }
        }
        expensesByCategory[catName].total += t.monto
      })

    const pieData: CategoryExpense[] = Object.entries(expensesByCategory).map(([name, item]) => ({
      name,
      value: item.total,
      color: item.color,
      icono: item.icono
    }))

    // Sort and set Top Categories (Top 5)
    const sortedCategories = [...pieData].sort((a, b) => b.value - a.value)
    setCategoryData(pieData)
    setTopCategories(sortedCategories.slice(0, 5))

    // Process Monthly Comparison (past 6 months)
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const historyMap: Record<string, { ingresos: number; gastos: number; order: number }> = {}

    // Pre-populate past 6 months with 0s
    for (let i = 5; i >= 0; i--) {
      const d = new Date(ano, mes - 1 - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`
      historyMap[key] = { ingresos: 0, gastos: 0, order: 5 - i }
    }

    comparisonTxns.forEach(t => {
      const dateParts = t.fecha.split('-')
      const key = `${dateParts[0]}-${dateParts[1]}`
      if (historyMap[key]) {
        if (t.tipo === 'ingreso') {
          historyMap[key].ingresos += t.monto
        } else if (t.tipo === 'gasto') {
          historyMap[key].gastos += t.monto
        }
      }
    })

    const barData: MonthlyComparison[] = Object.entries(historyMap)
      .sort((a, b) => a[1].order - b[1].order)
      .map(([key, data]) => {
        const [yearStr, monthStr] = key.split('-')
        const mIdx = parseInt(monthStr, 10) - 1
        const label = `${monthNames[mIdx]} ${yearStr.slice(-2)}`
        return {
          name: label,
          ingresos: data.ingresos,
          gastos: data.gastos
        }
      })

    setMonthlyData(barData)
    setLoading(false)
  }, [mes, ano, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const prevMonth = () => {
    if (mes === 1) {
      setMes(12)
      setAno(a => a - 1)
    } else {
      setMes(m => m - 1)
    }
  }

  const nextMonth = () => {
    if (mes === 12) {
      setMes(1)
      setAno(a => a + 1)
    } else {
      setMes(m => m + 1)
    }
  }

  const totalGastado = categoryData.reduce((sum, item) => sum + item.value, 0)

  // Custom tooltips for nice styling matching globals.css theme
  const renderCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.75rem',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          <p style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{payload[0].name}</p>
          <p style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.875rem', marginTop: '0.125rem' }}>
            {formatCOP(payload[0].value)}
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="page" style={{ paddingBottom: '5rem' }}>
      <div style={{ marginBottom: '1.25rem' }}>
        <h1 className="page-title" style={{ marginBottom: '0.25rem' }}>Reportes Financieros</h1>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Analiza y visualiza la evolución de tus ingresos, gastos y categorías principales.
        </p>
      </div>

      <div className="month-selector" style={{ marginBottom: '1.25rem' }}>
        <button className="month-btn" onClick={prevMonth}>
          <ChevronLeft size={18} />
        </button>
        <span className="month-label">{getMonthLabel(mes, ano)}</span>
        <button className="month-btn" onClick={nextMonth}>
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card skeleton" style={{ height: '16rem' }} />
          <div className="card skeleton" style={{ height: '16rem' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          
          {/* 1. Distribution of expenses by category (Pie Chart) */}
          <div className="card">
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '1rem' }}>Estructura de Gastos</h2>
            {categoryData.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '12rem', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</span>
                <p style={{ fontSize: '0.875rem' }}>Sin gastos registrados este mes</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Total gastado</p>
                <p style={{ fontSize: '1.375rem', fontWeight: 800, color: 'var(--error)', marginBottom: '1rem' }}>{formatCOP(totalGastado)}</p>
                {isMounted && (
                  <div style={{ width: '100%', height: 220, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={renderCustomTooltip} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Mini Legend list */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginTop: '1rem' }}>
                  {categoryData.map((item, idx) => {
                    const percentage = totalGastado > 0 ? (item.value / totalGastado) * 100 : 0
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem' }}>
                        <span style={{ width: '0.625rem', height: '0.625rem', borderRadius: '50%', backgroundColor: item.color, flexShrink: 0 }} />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '75px', color: 'var(--text-muted)' }}>{item.name}</span>
                        <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{Math.round(percentage)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Top 5 Categories list */}
          {topCategories.length > 0 && (
            <div className="card">
              <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '0.875rem' }}>Top 5 Categorías de Gastos</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {topCategories.map((item, idx) => {
                  const pct = totalGastado > 0 ? (item.value / totalGastado) * 100 : 0
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: '2rem', height: '2rem', borderRadius: '0.375rem',
                        background: `${item.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <CategoryIcon name={item.icono} size={15} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8125rem' }}>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontWeight: 700 }}>{formatCOP(item.value)}</span>
                        </div>
                        <div className="progress-bar-wrap" style={{ height: '4px' }}>
                          <div className="progress-bar-fill" style={{ width: `${pct}%`, background: item.color }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 3. Bar Chart: Ingresos vs Gastos last 6 months */}
          <div className="card">
            <h2 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '1.25rem' }}>Histórico 6 Meses</h2>
            {isMounted && (
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#888" fontSize={10} tickLine={false} />
                    <YAxis stroke="#888" fontSize={10} tickLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div style={{
                              backgroundColor: 'var(--bg-card)',
                              border: '1px solid var(--border)',
                              borderRadius: '0.5rem',
                              padding: '0.5rem 0.75rem',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                            }}>
                              <p style={{ fontWeight: 600, fontSize: '0.75rem', marginBottom: '0.25rem', color: 'var(--text-primary)' }}>{payload[0].payload.name}</p>
                              <p style={{ color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 600 }}>
                                Ingresos: {formatCOP(payload[0].payload.ingresos)}
                              </p>
                              <p style={{ color: 'var(--error)', fontSize: '0.8125rem', fontWeight: 600 }}>
                                Gastos: {formatCOP(payload[0].payload.gastos)}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 10 }} />
                    <Bar dataKey="ingresos" name="Ingresos" fill="var(--accent)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="var(--error)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          
        </div>
      )}
    </div>
  )
}
