export interface GastoFijoBasic {
  id: string
  nombre: string
  monto: number
  dia_del_mes: number
  activo: boolean
}

export interface ReservaDiariaItem {
  id: string
  nombre: string
  monto: number
  dia_del_mes: number
  diasRestantes: number
  cuotaDiaria: number
}

export function calcularReservaDiaria(gastosFijos: GastoFijoBasic[]): {
  items: ReservaDiariaItem[]
  totalDiario: number
} {
  const hoy = new Date()
  const diaHoy = hoy.getDate()
  const mesHoy = hoy.getMonth()
  const anoHoy = hoy.getFullYear()

  const items = gastosFijos
    .filter((g) => g.activo)
    .map((g) => {
      let diasRestantes: number
      if (g.dia_del_mes > diaHoy) {
        diasRestantes = g.dia_del_mes - diaHoy
      } else {
        const fechaProxima = new Date(anoHoy, mesHoy + 1, g.dia_del_mes)
        const hoyDate = new Date(anoHoy, mesHoy, diaHoy)
        diasRestantes = Math.ceil(
          (fechaProxima.getTime() - hoyDate.getTime()) / (1000 * 60 * 60 * 24)
        )
      }
      if (diasRestantes <= 0) diasRestantes = 1
      const cuotaDiaria = g.monto / diasRestantes
      return { id: g.id, nombre: g.nombre, monto: g.monto, dia_del_mes: g.dia_del_mes, diasRestantes, cuotaDiaria }
    })

  const totalDiario = items.reduce((sum, item) => sum + item.cuotaDiaria, 0)
  return { items, totalDiario }
}
