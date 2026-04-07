'use client'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Order, OrderStatus } from '@/types'
import { Package, Store, ChevronRight, ShoppingBag, Leaf } from 'lucide-react'
import LoginRequired from '@/components/LoginRequired'

const statusLabel: Record<OrderStatus, string> = {
  PENDING: 'รอชำระเงิน', PAID: 'รอยืนยัน', CONFIRMED: 'กำลังเตรียม',
  SHIPPING: 'กำลังจัดส่ง', DELIVERED: 'ส่งมอบแล้ว', CANCELLED: 'ยกเลิก',
}
const statusColor: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PAID: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700',
  SHIPPING: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}
const statusDot: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-400', PAID: 'bg-blue-400', CONFIRMED: 'bg-indigo-400',
  SHIPPING: 'bg-orange-400', DELIVERED: 'bg-green-500', CANCELLED: 'bg-red-400',
}

const ACTIVE_STATUSES: OrderStatus[] = ['PENDING', 'PAID', 'CONFIRMED', 'SHIPPING']

// แต่ละ "farm entry" คือ 1 ฟาร์มใน 1 order
interface FarmEntry {
  orderId: string
  order: Order
  farmId: string
  farmName: string
  items: Order['items']
  subtotal: number
}

function FarmOrderCard({ entry }: { entry: FarmEntry }) {
  const previewImages = entry.items.slice(0, 3)
  const status = entry.order.status

  const isInactive = status === 'DELIVERED' || status === 'CANCELLED'

  return (
    <div className={`rounded-xl border overflow-hidden hover:shadow-md transition flex ${isInactive ? 'bg-gray-100 border-gray-200' : 'bg-white border-gray-100'}`}>
      {/* Full-height image panel — links to product page */}
      <Link
        href={previewImages[0] ? `/products/${previewImages[0].product.id}` : '/products'}
        className="hidden sm:block w-24 md:w-28 flex-shrink-0 self-stretch relative bg-gray-200 hover:brightness-90 transition"
      >
        {(previewImages[0]?.product.images as string[])?.[0] ? (
          <Image
            src={(previewImages[0].product.images as string[])[0]}
            alt={previewImages[0].product.name}
            fill
            sizes="(max-width:640px) 0px, 112px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xl">🌿</div>
        )}
        {entry.items.length > 1 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-sm rounded-md px-1.5 py-0.5 font-medium">
            +{entry.items.length - 1}
          </div>
        )}
      </Link>

      {/* Mobile image stack — links to product (hidden on sm+) */}
      <div className="flex sm:hidden flex-col justify-center pl-3 py-3 gap-1 flex-shrink-0">
        {previewImages.map((item) => (
          <Link key={item.id} href={`/products/${(item.product as { id?: string }).id ?? ''}`}
            className="relative w-10 h-10 rounded-lg overflow-hidden bg-gray-200 border-2 border-white flex-shrink-0 block hover:brightness-90 transition">
            {(item.product.images as string[])?.[0] ? (
              <Image src={(item.product.images as string[])[0]} alt={item.product.name} fill sizes="40px" className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-sm">🌿</div>
            )}
          </Link>
        ))}
        {entry.items.length > 3 && (
          <div className="w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center text-sm text-gray-600 font-medium flex-shrink-0">
            +{entry.items.length - 3}
          </div>
        )}
      </div>

      {/* Content — links to order */}
      <Link href={`/orders/${entry.orderId}`} className="flex-1 min-w-0 px-4 py-3">
        {/* Farm + status */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Store size={13} className={`flex-shrink-0 ${isInactive ? 'text-gray-500' : 'text-green-600'}`} />
            <span className={`font-semibold text-sm truncate ${isInactive ? 'text-gray-500' : 'text-green-700'}`}>{entry.farmName}</span>
          </div>
          <span className={`flex items-center gap-1 text-sm px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${statusColor[status]}`}>
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot[status]}`} />
            {statusLabel[status]}
          </span>
        </div>
        {/* Items preview */}
        <p className="text-sm text-gray-600 truncate">
          {entry.items.slice(0, 2).map((i) => `${i.product.name} ×${i.quantity}`).join(', ')}
          {entry.items.length > 2 && ` +${entry.items.length - 2}`}
        </p>
        {/* Meta + price */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-sm text-gray-500">
            #{entry.orderId.slice(0, 8).toUpperCase()} · {new Date(entry.order.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
          </span>
          <div className="flex items-center gap-0.5">
            <span className={`font-bold text-sm ${isInactive ? 'text-gray-500' : 'text-green-700'}`}>฿{entry.subtotal.toLocaleString()}</span>
            <ChevronRight size={13} className="text-gray-500" />
          </div>
        </div>
      </Link>
    </div>
  )
}

function Section({ title, entries, badge }: {
  title: string; entries: FarmEntry[]; badge?: string
}) {
  if (entries.length === 0) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-gray-600">{title}</h2>
        {badge && (
          <span className="text-sm bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
      </div>
      {entries.map((entry) => (
        <FarmOrderCard key={`${entry.orderId}-${entry.farmId}`} entry={entry} />
      ))}
    </div>
  )
}

export default function OrdersPage() {
  const { isAuthenticated } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then((r) => r.data),
    enabled: isAuthenticated,
  })

  if (!isAuthenticated) return <LoginRequired description="คุณต้องเข้าสู่ระบบก่อนเพื่อดูคำสั่งซื้อ" />

  const orders: Order[] = data?.orders ?? []

  // Flatten: order → farm entries (1 entry ต่อฟาร์มต่อ order)
  const farmEntries: FarmEntry[] = orders.flatMap((order) => {
    const seenFarms = new Set<string>()
    const groups: FarmEntry[] = []
    for (const item of order.items) {
      const fid = (item.product as { farm?: { id: string; name: string } }).farm?.id ?? order.id
      const fname = (item.product as { farm?: { id: string; name: string } }).farm?.name ?? 'ฟาร์ม'
      if (!seenFarms.has(fid)) {
        seenFarms.add(fid)
        const farmItems = order.items.filter(
          (i) => ((i.product as { farm?: { id: string } }).farm?.id ?? order.id) === fid
        )
        groups.push({
          orderId: order.id,
          order,
          farmId: fid,
          farmName: fname,
          items: farmItems,
          subtotal: farmItems.reduce((s, i) => s + Number(i.price) * i.quantity, 0),
        })
      }
    }
    return groups
  })

  const active = farmEntries.filter((e) => ACTIVE_STATUSES.includes(e.order.status))
  const delivered = farmEntries.filter((e) => e.order.status === 'DELIVERED')
  const cancelled = farmEntries.filter((e) => e.order.status === 'CANCELLED')

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-3">
      {Array.from({ length: 3 }).map((_, i) => <div key={i} className="bg-gray-100 h-40 rounded-xl animate-pulse" />)}
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-gray-600">คำสั่งซื้อของฉัน</h1>

      {farmEntries.length === 0 ? (
        <div className="text-center py-20">
          <Package size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600">ยังไม่มีคำสั่งซื้อ</p>
          <Link href="/products" className="inline-block mt-4 text-sm text-green-600 hover:underline">เลือกซื้อสินค้า →</Link>
        </div>
      ) : (
        <>
          {active.length === 0 && (
            <div className="text-center ">
              <div className="relative inline-block mb-4">
                <ShoppingBag size={48} className="text-gray-300" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center border-2 border-white">
                  <Leaf size={12} className="text-gray-500" />
                </div>
              </div>
              <p className="text-gray-600 mb-1">ไม่มีออเดอร์ที่กำลังดำเนินการ</p>
              <p className="text-sm text-gray-500 mb-4">ลองเลือกซื้อสินค้าสดจากฟาร์มกันเลย!</p>
              <Link
                href="/products"
                className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-full text-sm font-semibold hover:bg-green-700 transition"
              >
                <ShoppingBag size={15} /> เลือกซื้อสินค้า
              </Link>
            </div>
          )}
          <Section title="กำลังดำเนินการ" entries={active} badge={active.length > 0 ? `${active.length}` : undefined} />
          <Section title="สำเร็จแล้ว" entries={delivered} badge={delivered.length > 0 ? `${delivered.length}` : undefined} />
          <Section title="ถูกยกเลิก" entries={cancelled} badge={cancelled.length > 0 ? `${cancelled.length}` : undefined} />
        </>
      )}
    </div>
  )
}
