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
        ? <Image src={avatar} alt={name ?? ''} fill sizes="80px" className="object-cover" />
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

  const navLink = (href: string) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return `relative flex items-center gap-1.5 transition px-2 py-1 rounded-lg
      ${active ? 'bg-white/20 text-white' : 'text-green-100 hover:bg-white/10 hover:text-white'}`
  }
  const mobileLinkCls = (href: string) => {
    const active = pathname === href || pathname.startsWith(href + '/')
    return `flex items-center gap-2 px-4 py-3 transition text-base rounded-lg
      ${active ? 'bg-green-100 text-green-700 font-semibold' : 'text-gray-800 hover:bg-green-50 hover:text-green-700'}`
  }

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
            🌾<span className="hidden md:inline"> FarmDirect</span>
          </Link>

          {/* Bell + Theme — always visible, all screens */}
          <NotificationBell onOpen={() => setOpen(false)} />
          <ThemeToggle />

          {/* Mobile quick-links: product / farm / cart */}
          <div className="flex md:hidden items-center gap-1">
            {[
              { href: '/products', icon: ShoppingBag, label: 'สินค้า' },
              { href: '/farms',    icon: Leaf,        label: 'ฟาร์ม'  },
            ].map(({ href, icon: Icon, label }) => {
              const active = pathname.startsWith(href)
              return (
                <Link key={href} href={href} title={label}
                  className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-xl transition
                    ${active ? 'bg-white/20 text-white' : 'text-green-100 hover:bg-white/10'}`}>
                  <Icon size={19} />
                  {active && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />}
                </Link>
              )
            })}
            {(() => {
              const active = pathname.startsWith('/cart')
              return (
                <Link href="/cart" title="ตะกร้า"
                  className={`relative flex flex-col items-center justify-center w-10 h-10 rounded-xl transition
                    ${active ? 'bg-white/20 text-white' : 'text-green-100 hover:bg-white/10'}`}>
                  <ShoppingCart size={19} />
                  {itemCount > 0 && (
                    <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-0.5">
                      {itemCount > 9 ? '9+' : itemCount}
                    </span>
                  )}
                  {active && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />}
                </Link>
              )
            })()}
          </div>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1 text-base">
            <Link href="/products" className={navLink('/products')}><ShoppingBag size={17} /> สินค้า</Link>
            <Link href="/farms" className={navLink('/farms')}><Leaf size={17} /> ฟาร์ม</Link>

            {/* Cart — show for everyone */}
            <Link href="/cart" className={navLink('/cart') + ' relative'}>
              <ShoppingCart size={18} />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 left-5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
              ตะกร้า
            </Link>

            {isAuthenticated ? (
              <>
                <Link href="/orders" className={navLink('/orders')}>
                  <ClipboardList size={18} /> คำสั่งซื้อ
                </Link>
                {isFarmAdmin && (
                  <Link href="/seller/dashboard" className={navLink('/seller')}>
                    <Tractor size={18} /> จัดการฟาร์ม
                  </Link>
                )}
                {(user?.role === 'ADMIN' || user?.role === 'HOST') && (
                  <Link href="/admin/dashboard" className={navLink('/admin')}>
                    <LayoutDashboard size={18} /> Admin
                  </Link>
                )}
                <Link href="/profile" className={navLink('/profile') + ' ml-1'}>
                  <Avatar name={user?.name} avatar={user?.avatar} size={32} />
                  <span className="hidden lg:block">{user?.name}</span>
                </Link>
                <button onClick={handleLogout} className="text-green-100 hover:bg-white/10 hover:text-white transition p-2 rounded-lg ml-1" title="ออกจากระบบ">
                  <LogOut size={18} />
                </button>
              </>
            ) : (
              <>
                <button onClick={openLogin} className={navLink('/login')}><LogIn size={17} /> เข้าสู่ระบบ</button>
              </>
            )}
          </div>

          {/* Mobile right: avatar + menu */}
          <div className="flex md:hidden items-center gap-2">
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

          <Link href="/products" className={mobileLinkCls('/products')} onClick={close}><ShoppingBag size={18} className="text-green-600" /> สินค้า</Link>
          <Link href="/farms" className={mobileLinkCls('/farms')} onClick={close}><Leaf size={18} className="text-green-600" /> ฟาร์ม</Link>

          {isAuthenticated ? (
            <>
              <Link href="/orders" className={mobileLinkCls('/orders')} onClick={close}>
                <ClipboardList size={18} className="text-green-600" /> คำสั่งซื้อ
              </Link>
              <Link href="/cart" className={mobileLinkCls('/cart')} onClick={close}>
                <ShoppingCart size={18} className="text-green-600" /> ตะกร้าสินค้า
                {itemCount > 0 && (
                  <span className="ml-auto bg-red-500 text-white text-sm rounded-full px-1.5 py-0.5 font-bold">{itemCount}</span>
                )}
              </Link>
              {isFarmAdmin && (
                <Link href="/seller/dashboard" className={mobileLinkCls('/seller')} onClick={close}>
                  <Tractor size={18} className="text-green-600" /> จัดการฟาร์ม
                </Link>
              )}
              {(user?.role === 'ADMIN' || user?.role === 'HOST') && (
                <Link href="/admin/dashboard" className={mobileLinkCls('/admin')} onClick={close}>
                  <LayoutDashboard size={18} className="text-green-600" /> Admin
                </Link>
              )}
              <Link href="/profile" className={mobileLinkCls('/profile')} onClick={close}>
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
              <button onClick={() => { openLogin(); close() }} className={mobileLinkCls('')}><LogIn size={18} className="text-green-600" /> เข้าสู่ระบบ</button>
            </>
          )}
        </div>
      </nav>
    </>
  )
}
