export function formatCOP(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatShortDate(fecha: string): string {
  const date = new Date(fecha + 'T12:00:00')
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })
}

export function formatDateLabel(fecha: string): string {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  if (fecha === todayStr) return 'Hoy'
  if (fecha === yesterdayStr) return 'Ayer'
  const date = new Date(fecha + 'T12:00:00')
  const label = date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function getMonthRange(mes: number, ano: number): { start: string; end: string } {
  const start = `${ano}-${String(mes).padStart(2, '0')}-01`
  const lastDay = new Date(ano, mes, 0).getDate()
  const end = `${ano}-${String(mes).padStart(2, '0')}-${lastDay}`
  return { start, end }
}

export function getMonthLabel(mes: number, ano: number): string {
  const date = new Date(ano, mes - 1, 1)
  const label = date.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function getDaysRemaining(fechaLimite: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const limit = new Date(fechaLimite + 'T00:00:00')
  return Math.ceil((limit.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}
