'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'

const PRIVATE_ROUTES = ['/dashboard', '/transacciones', '/presupuestos', '/gastos-fijos', '/metas', '/reportes', '/perfil', '/hogar']

export default function BottomNavWrapper() {
  const pathname = usePathname()
  const isPrivate = PRIVATE_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))
  if (!isPrivate) return null
  return <BottomNav />
}
