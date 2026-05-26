'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ArrowLeftRight, Target, Star, Users } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Inicio', icon: Home },
  { href: '/transacciones', label: 'Cuentas', icon: ArrowLeftRight },
  { href: '/presupuestos', label: 'Presup.', icon: Target },
  { href: '/metas', label: 'Metas', icon: Star },
  { href: '/hogar', label: 'Hogar', icon: Users },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${isActive ? ' active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={22} />
            <span className="nav-item-label">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
