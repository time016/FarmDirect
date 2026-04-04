'use client'
import { usePathname } from 'next/navigation'
import Footer from './Footer'

const FOOTER_PATHS = ['/', '/products', '/farms']

export default function ConditionalFooter() {
  const pathname = usePathname()
  const show = FOOTER_PATHS.some((p) =>
    p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(p + '/')
  )
  if (!show) return null
  return <Footer />
}
