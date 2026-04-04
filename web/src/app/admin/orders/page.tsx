'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Order, OrderStatus } from '@/types'
import { ChevronDown, ChevronUp } from 'lucide-react'

const statusLabel: Record<OrderStatus, string> = {
  PENDING: 'รอชำระเงิน', PAID: 'ชำระแล้ว', CONFIRMED: 'กำลังเตรียมสินค้า',
  SHIPPING: 'จัดส่งแล้ว', DELIVERED: 'ส่งมอบแล้ว', CANCELLED: 'ยกเลิก',
}
const statusColor: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', PAID: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700', SHIPPING: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-600',
}

export default function AdminOrdersPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN') router.push('/')
  }, [isAuthenticated, user])

  const { data, isLoading } = useQuery({
    queryKey: ['admin-orders', statusFilter],
    queryFn: () => api.get('/admin/orders', { params: { status: statusFilter || undefined } }).then((r) => r.data),
    enabled: isAuthenticated && user?.role === 'ADMIN',
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-extrabold text-gray-600">คำสั่งซื้อทั้งหมด</h1>
        <span className="text-sm text-gray-600">ทั้งหมด {data?.total ?? 0} รายการ</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'PENDING', 'PAID', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${statusFilter === s ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-400'}`}>
            {s === '' ? 'ทั้งหมด' : statusLabel[s]}
          </button>
        ))}
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="bg-gray-100 h-16 rounded-xl animate-pulse" />)}</div>
      ) : data?.orders?.length === 0 ? (
        <div className="text-center py-12 text-gray-500">ไม่พบคำสั่งซื้อ</div>
      ) : (
        <div className="space-y-3">
          {data?.orders?.map((order: Order) => {
            const isOpen = expanded === order.id
            return (
              <div key={order.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-5 py-4 flex items-center gap-3">
                  <button onClick={() => setExpanded(isOpen ? null : order.id)} className="text-gray-500 hover:text-gray-700">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-gray-600">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${statusColor[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">{order.user?.name}</p>
                    <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</p>
                  </div>
                  <p className="font-bold text-green-700 flex-shrink-0">฿{Number(order.totalAmount).toLocaleString()}</p>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 px-5 pb-4 pt-3 space-y-3">
                    <div className="space-y-1.5">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.product.name} x{item.quantity} {item.product.unit}</span>
                          <span className="font-medium text-gray-700">฿{(Number(item.price) * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm">
                      <p className="font-medium text-gray-700">{order.address?.recipient} · {order.address?.phone}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{order.address?.address}, {order.address?.subdistrict}, {order.address?.district}, {order.address?.province} {order.address?.zipCode}</p>
                    </div>
                    {order.payment && (
                      <p className="text-sm text-gray-600">
                        ชำระด้วย <span className="font-medium">{order.payment.method}</span>
                        {' · '}
                        <span className={order.payment.status === 'SUCCESS' ? 'text-green-600' : 'text-yellow-600'}>
                          {order.payment.status === 'SUCCESS' ? 'ชำระแล้ว' : 'รอการชำระ'}
                        </span>
                      </p>
                    )}
                    <div className="flex items-center gap-2">
                      <Link href={`/orders/${order.id}`} className="ml-auto text-sm text-green-600 hover:underline">
                        ดูรายละเอียด →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
