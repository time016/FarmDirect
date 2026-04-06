'use client'
import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { LayoutDashboard, Users, Store, ClipboardList, Settings2, Truck } from 'lucide-react'

const TABS = [
  { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'ผู้ใช้', href: '/admin/users', icon: Users },
  { label: 'ฟาร์ม', href: '/admin/farms', icon: Store },
  { label: 'ออเดอร์', href: '/admin/orders', icon: ClipboardList },
  { label: 'ตั้งค่าราคา', href: '/admin/pricing', icon: Settings2 },
  { label: 'ตั้งค่าขนส่ง', href: '/admin/shipping', icon: Truck },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN' && user?.role !== 'HOST') router.push('/')
  }, [isAuthenticated, user])

  if (!isAuthenticated || user?.role !== 'ADMIN' && user?.role !== 'HOST') return null

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-1 flex gap-1 flex-wrap overflow-x-auto">
        {TABS.map(({ label, href, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
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
