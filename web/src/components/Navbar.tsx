'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { ShoppingCart, ShoppingBag, LogOut, LogIn, LayoutDashboard, Tractor, ClipboardList, Leaf, Menu, X, Sun, Moon, Monitor } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import Image from 'next/image'
import { useAuthModalStore } from '@/store/authModalStore'
import { useTheme } from 'next-themes'
import NotificationBell from './NotificationBell'

const THEMES = ['system', 'light', 'dark'] as const
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon }
const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' }

function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-8 h-8" />

  const current = (theme ?? 'system') as 'system' | 'light' | 'dark'
  const next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length]
  const Icon = THEME_ICON[current]

  return (
    <button
      onClick={() => setTheme(next)}
      title={`โหมด: ${THEME_LABEL[current]}`}
      className={`hover:text-green-200 transition flex items-center justify-center ${className}`}
    >
      <Icon size={18} />
    </button>
  )
}

function ThemeToggleMobile() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const current = theme ?? 'system'
  return (
    <div className="flex items-center gap-1 px-4 py-2">
      <span className="text-sm text-gray-600 mr-2">โหมด</span>
      {THEMES.map((t) => {
        const Icon = THEME_ICON[t]
        const active = current === t
        return (
          <button key={t} onClick={() => setTheme(t)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition ${active ? 'bg-green-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
            <Icon size={14} /> {THEME_LABEL[t]}
          </button>
        )
      })}
    </div>
  )
}

function Avatar({ name, avatar, size = 32 }: { name?: string; avatar?: string; size?: number }) {
  return (
    <div
      className="relative rounded-full overflow-hidden bg-green-500 flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {avatar
        ? <Image src={avatar} alt={name} fill sizes="80px" className="object-cover" />
        : <span className="text-white font-bold" style={{ fontSize: size * 0.4 }}>{name?.[0]?.toUpperCase()}</span>
      }
    </div>
  )
}

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { itemCount } = useCartStore()
  const { openLogin, openRegister } = useAuthModalStore()
  const qc = useQueryClient()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Check if BUYER user is a farm admin (accepted)
  const { data: memberships } = useQuery({
    queryKey: ['my-farm-memberships'],
    queryFn: () => api.get('/farms/memberships').then((r) => r.data),
    enabled: isAuthenticated && user?.role === 'BUYER',
  })
  const isFarmAdmin = user?.role === 'SELLER' || user?.role === 'ADMIN' || user?.role === 'HOST' || (memberships?.length ?? 0) > 0

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  const close = () => setOpen(false)
  const handleLogout = () => { logout(); qc.clear(); close() }

  const linkCls = 'hover:text-green-200 transition flex items-center gap-1.5'
  const mobileLinkCls = 'flex items-center gap-2 px-4 py-3 text-gray-800 hover:bg-green-50 hover:text-green-700 transition text-base rounded-lg'

  return (
    <>
      {/* Dim overlay — always in DOM, fade via CSS transition */}
      <div
        className="fixed inset-0 z-30 bg-black transition-opacity duration-200"
        style={{ opacity: open ? 0.2 : 0, pointerEvents: open ? 'auto' : 'none' }}
        onClick={close}
      />

      <nav className="bg-green-700 text-white shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">

          {/* Logo */}
          <Link href="/" className="text-2xl font-bold tracking-tight flex-shrink-0 mr-auto">
            🌾 FarmDirect
          </Link>

          {/* Bell + Theme — always visible, all screens */}
          <NotificationBell onOpen={() => setOpen(false)} />
          <ThemeToggle />

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-5 text-base">
            <Link href="/products" className={linkCls}><ShoppingBag size={17} /> สินค้า</Link>
            <Link href="/farms" className={linkCls}><Leaf size={17} /> ฟาร์ม</Link>

            {isAuthenticated ? (
              <>
                {(user?.role === 'BUYER' || user?.role === 'SELLER') && (
                  <>
                    <Link href="/orders" className={linkCls}>
                      <ClipboardList size={18} /> คำสั่งซื้อ
                    </Link>
                    <Link href="/cart" className="relative flex items-center gap-1.5 hover:text-green-200 transition">
                      <ShoppingCart size={18} />
                      {itemCount > 0 && (
                        <span className="absolute -top-2 left-3 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                          {itemCount > 9 ? '9+' : itemCount}
                        </span>
                      )}
                      ตะกร้า
                    </Link>
                  </>
                )}
                {isFarmAdmin && (
                  <Link href="/seller/dashboard" className={linkCls}>
                    <Tractor size={18} /> จัดการฟาร์ม
                  </Link>
                )}
                {(user?.role === 'ADMIN' || user?.role === 'HOST') && (
                  <Link href="/admin/dashboard" className={linkCls}>
                    <LayoutDashboard size={18} /> Admin
                  </Link>
                )}
                <Link href="/profile" className="flex items-center gap-2 hover:text-green-200 transition">
                  <Avatar name={user?.name} avatar={user?.avatar} size={32} />
                  <span className="hidden lg:block">{user?.name}</span>
                </Link>
                <button onClick={handleLogout} className="hover:text-green-200 transition" title="ออกจากระบบ">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <button onClick={openLogin} className={linkCls}><LogIn size={17} /> เข้าสู่ระบบ</button>
              </>
            )}
          </div>

          {/* Mobile right */}
          <div className="flex md:hidden items-center gap-3">
            {isAuthenticated && (
              <Link href="/profile">
                <Avatar name={user?.name} avatar={user?.avatar} size={32} />
              </Link>
            )}
            <button
              onClick={() => setOpen((o) => !o)}
              className="hover:text-green-200 transition p-1"
              aria-label="เมนู"
            >
              {open ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown — always in DOM, fade+slide via CSS transition */}
        <div
          className="md:hidden absolute top-full left-0 right-0 bg-white shadow-xl border-t border-gray-100 z-50 px-4 py-3 space-y-1"
          style={{
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0)' : 'translateY(-10px)',
            pointerEvents: open ? 'auto' : 'none',
            transition: 'opacity 220ms ease, transform 220ms ease',
          }}
        >
          {/* User info card */}
          {isAuthenticated && (
            <div className="flex items-center gap-3 px-4 py-3 mb-2 bg-green-50 rounded-xl">
              <Avatar name={user?.name} avatar={user?.avatar} size={40} />
              <div className="min-w-0">
                <p className="font-semibold text-gray-800 truncate">{user?.name}</p>
                <p className="text-sm text-gray-600">{user?.role === 'BUYER' ? (isFarmAdmin ? 'ผู้ซื้อ · ผู้จัดการฟาร์ม' : 'ผู้ซื้อ') : user?.role === 'SELLER' ? 'ผู้ขาย' : user?.role === 'HOST' ? 'เจ้าของระบบ' : 'แอดมิน'}</p>
              </div>
            </div>
          )}

          <Link href="/products" className={mobileLinkCls} onClick={close}><ShoppingBag size={18} className="text-green-600" /> สินค้า</Link>
          <Link href="/farms" className={mobileLinkCls} onClick={close}><Leaf size={18} className="text-green-600" /> ฟาร์ม</Link>

          {isAuthenticated ? (
            <>
              {(user?.role === 'BUYER' || user?.role === 'SELLER') && (
                <>
                  <Link href="/orders" className={mobileLinkCls} onClick={close}>
                    <ClipboardList size={18} className="text-green-600" /> คำสั่งซื้อ
                  </Link>
                  <Link href="/cart" className={mobileLinkCls} onClick={close}>
                    <ShoppingCart size={18} className="text-green-600" /> ตะกร้าสินค้า
                    {itemCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-sm rounded-full px-1.5 py-0.5 font-bold">{itemCount}</span>
                    )}
                  </Link>
                </>
              )}
              {isFarmAdmin && (
                <Link href="/seller/dashboard" className={mobileLinkCls} onClick={close}>
                  <Tractor size={18} className="text-green-600" /> จัดการฟาร์ม
                </Link>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'HOST') && (
                <Link href="/admin/dashboard" className={mobileLinkCls} onClick={close}>
                  <LayoutDashboard size={18} className="text-green-600" /> Admin
                </Link>
              )}
              <Link href="/profile" className={mobileLinkCls} onClick={close}>
                <Avatar name={user?.name} avatar={user?.avatar} size={24} /> โปรไฟล์
              </Link>
              <div className="border-t border-gray-100 pt-2 mt-2">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 transition text-base rounded-lg">
                  <LogOut size={18} /> ออกจากระบบ
                </button>
              </div>
            </>
          ) : (
            <>
              <button onClick={() => { openLogin(); close() }} className={mobileLinkCls}><LogIn size={18} className="text-green-600" /> เข้าสู่ระบบ</button>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
