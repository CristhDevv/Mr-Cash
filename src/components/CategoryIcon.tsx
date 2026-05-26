import {
  Utensils, Car, Home, Film, HeartPulse, GraduationCap,
  CircleEllipsis, Briefcase, Laptop, Store, TrendingUp, Tag,
  type LucideProps,
} from 'lucide-react'

type IconComp = React.ComponentType<LucideProps>

const ICON_MAP: Record<string, IconComp> = {
  Utensils, Car, Home, Film, HeartPulse, GraduationCap,
  CircleEllipsis, Briefcase, Laptop, Store, TrendingUp, Tag,
}

export function CategoryIcon({
  name,
  size = 18,
  color,
}: {
  name: string | null | undefined
  size?: number
  color?: string
}) {
  const Icon: IconComp = (name && ICON_MAP[name]) ? ICON_MAP[name] : Tag
  return <Icon size={size} color={color} />
}
