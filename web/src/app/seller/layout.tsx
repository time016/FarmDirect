'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { LayoutDashboard, ClipboardList, Package, Store, Truck, Users } from 'lucide-react'

const BASE_TABS = [
  { label: 'แดชบอร์ด', href: '/seller/dashboard', icon: LayoutDashboard },
  { label: 'ออเดอร์', href: '/seller/orders', icon: ClipboardList },
  { label: 'สินค้า', href: '/seller/products', icon: Package },
  { label: 'ตั้งค่าขนส่ง', href: '/seller/shipping', icon: Truck },
  { label: 'ทีมแอดมิน', href: '/seller/admins', icon: Users },
]

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()

  const { data: farm } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isAuthenticated,
  })

  // Allow SELLER/ADMIN directly; allow BUYER if they are an accepted farm admin
  const { data: memberships, status: membershipsStatus } = useQuery({
    queryKey: ['my-farm-memberships'],
    queryFn: () => api.get('/farms/memberships').then((r) => r.data),
    enabled: isAuthenticated && user?.role === 'BUYER',
    staleTime: 0,
  })

  // Determine access — null means still loading, true/false means decided
  const isBuyer = isAuthenticated && user?.role === 'BUYER'
  const membershipsFetched = membershipsStatus === 'success' || membershipsStatus === 'error'
  const isAllowed =
    !isAuthenticated ? false
    : user?.role === 'SELLER' || (user?.role === 'ADMIN' || user?.role === 'HOST') ? true
    : isBuyer && membershipsFetched ? (memberships?.length ?? 0) > 0
    : null

  useEffect(() => {
    if (isAllowed === false) router.push('/')
  }, [isAllowed])

  const isFarmOwner = user?.role === 'SELLER' || (user?.role === 'ADMIN' || user?.role === 'HOST')
  const tabs = [
    ...BASE_TABS.filter((t) => isFarmOwner || t.href !== '/seller/admins'),
    ...(farm?.id ? [{ label: 'ฟาร์มของฉัน', href: '/seller/farm/edit', icon: Store }] : []),
  ]

  // Still determining access — show spinner
  if (isAllowed === null) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  // No access — redirect handled by useEffect, render nothing
  if (isAllowed === false) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Tab bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1 flex-wrap overflow-x-auto">
        {tabs.map(({ label, href, icon: Icon }) => {
          const isActive = href.startsWith('/seller')
            ? pathname === href || pathname.startsWith(href + '/')
            : false
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                isActive
                  ? 'bg-green-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-700'
              }`}
            >
              <Icon size={15} />
              {label}
            </Link>
          )
        })}
      </div>

      {children}
    </div>
  )
}
