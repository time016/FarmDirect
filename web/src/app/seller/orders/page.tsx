'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Order, OrderStatus } from '@/types'
import { CheckCircle, Truck, Package, ChevronDown, ChevronUp, Loader2, Pencil, X, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'

const PAGE_SIZE = 20

interface SellerOrdersPage {
  orders: Order[]
  total: number
  page: number
  totalPages: number
  statusCounts: Partial<Record<OrderStatus, number>>
}

const statusLabel: Record<OrderStatus, string> = {
  PENDING: 'รอชำระเงิน', PAID: 'ออเดอร์รอยืนยัน', CONFIRMED: 'กำลังเตรียมสินค้า',
  SHIPPING: 'จัดส่งแล้ว', DELIVERED: 'ส่งมอบแล้ว', CANCELLED: 'ยกเลิก',
}
const statusColor: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', PAID: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700', SHIPPING: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-600',
}

// PENDING: ลูกค้ายังไม่จ่าย — seller ไม่ต้องทำอะไร ระบบ payment จัดการให้
const nextActions: Partial<Record<OrderStatus, { label: string; next: OrderStatus; icon: React.ReactNode; color: string }>> = {
  PAID: { label: 'ยืนยันรับออเดอร์', next: 'CONFIRMED', icon: <Package size={14} />, color: 'bg-indigo-500 hover:bg-indigo-600 text-white' },
  CONFIRMED: { label: 'ส่งสินค้าให้ขนส่งแล้ว', next: 'SHIPPING', icon: <Truck size={14} />, color: 'bg-orange-500 hover:bg-orange-600 text-white' },
  SHIPPING: { label: 'ยืนยันจัดส่งถึงแล้ว', next: 'DELIVERED', icon: <CheckCircle size={14} />, color: 'bg-green-600 hover:bg-green-700 text-white' },
}

export default function SellerOrdersPage() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<string | null>(null)
  const [cancelNote, setCancelNote] = useState('')
  const [shippingTarget, setShippingTarget] = useState<string | null>(null)
  const [trackingNumber, setTrackingNumber] = useState('')
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null)
  const [editingTrackingValue, setEditingTrackingValue] = useState('')

  const isSellerOrAdmin = user?.role === 'SELLER' || user?.role === 'ADMIN'

  useEffect(() => {
    if (!isAuthenticated) router.push('/')
  }, [isAuthenticated, user])

  const sentinelRef = useRef<HTMLDivElement>(null)

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<SellerOrdersPage>({
    queryKey: ['seller-orders-manage', statusFilter],
    queryFn: ({ pageParam = 1 }) =>
      api.get('/orders/seller', {
        params: { status: statusFilter || undefined, page: pageParam, limit: PAGE_SIZE },
      }).then((r) => r.data),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    enabled: isAuthenticated,
  })

  const orders: Order[] = data?.pages.flatMap((p) => p.orders) ?? []
  const statusCounts = data?.pages[0]?.statusCounts
  const total = data?.pages[0]?.total ?? 0

  // Infinite scroll — observe sentinel
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const updateTracking = useMutation({
    mutationFn: ({ id, trackingNumber }: { id: string; trackingNumber: string }) =>
      api.put(`/orders/${id}/status`, { status: 'SHIPPING', trackingNumber }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-orders-manage'] })
      qc.invalidateQueries({ queryKey: ['order'] })
      setEditingTrackingId(null)
      toast.success('บันทึกเลขพัสดุแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status, cancelNote, trackingNumber }: { id: string; status: OrderStatus; cancelNote?: string; trackingNumber?: string }) =>
      api.put(`/orders/${id}/status`, { status, cancelNote, trackingNumber }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller-orders-manage'] })
      qc.invalidateQueries({ queryKey: ['seller-orders'] })
      qc.invalidateQueries({ queryKey: ['order'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['farm'] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      toast.success('อัปเดตสถานะแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-600">จัดการคำสั่งซื้อ</h1>
        <span className="text-sm text-gray-600">ทั้งหมด {total} รายการ</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['', 'PENDING', 'PAID', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'] as const).map((s) => {
          const count = s === '' ? total : (statusCounts?.[s] ?? 0)
          const active = statusFilter === s
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${active ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-green-400'}`}>
              {s === '' ? 'ทั้งหมด' : statusLabel[s]}
              <span className={`text-sm px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'}`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Orders */}
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="bg-gray-100 h-20 rounded-xl animate-pulse" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">ไม่พบคำสั่งซื้อ</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: Order) => {
            const action = nextActions[order.status]
            const isOpen = expanded === order.id
            return (
              <div key={order.id} className={`bg-white rounded-xl border overflow-hidden transition-all duration-200 ${isOpen ? 'border-green-400 shadow-md shadow-green-100 ring-1 ring-green-300' : expanded ? 'border-gray-100 opacity-40' : 'border-gray-100'}`}>
                {/* Header row */}
                <div className="p-4 flex items-center gap-3 cursor-pointer select-none" onClick={() => setExpanded(isOpen ? null : order.id)}>
                  <span className="text-gray-500">
                    {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm text-gray-600">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-sm px-2 py-0.5 rounded-full font-medium ${statusColor[order.status]}`}>
                        {statusLabel[order.status]}
                      </span>

                      {/* Tracking number inline (SHIPPING only) */}
                      {order.status === 'SHIPPING' && (
                        editingTrackingId === order.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              autoFocus
                              type="text"
                              value={editingTrackingValue}
                              onChange={(e) => setEditingTrackingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') updateTracking.mutate({ id: order.id, trackingNumber: editingTrackingValue.trim() })
                                if (e.key === 'Escape') setEditingTrackingId(null)
                              }}
                              placeholder="เลขพัสดุ..."
                              className="text-sm border border-orange-300 rounded px-2 py-0.5 w-36 focus:outline-none focus:ring-1 focus:ring-orange-400"
                            />
                            <button
                              onClick={() => updateTracking.mutate({ id: order.id, trackingNumber: editingTrackingValue.trim() })}
                              disabled={updateTracking.isPending}
                              className="text-green-600 hover:text-green-700 disabled:opacity-50"
                            >
                              {updateTracking.isPending ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                            </button>
                            <button onClick={() => setEditingTrackingId(null)} className="text-gray-500 hover:text-gray-700">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            {order.trackingNumber ? (
                              <span className="text-sm font-mono text-orange-700 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">
                                {order.trackingNumber}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-500">ยังไม่มีเลขพัสดุ</span>
                            )}
                            <button
                              onClick={() => { setEditingTrackingId(order.id); setEditingTrackingValue(order.trackingNumber ?? '') }}
                              className="text-gray-500 hover:text-orange-500 transition"
                              title={order.trackingNumber ? 'แก้ไขเลขพัสดุ' : 'เพิ่มเลขพัสดุ'}
                            >
                              <Pencil size={11} />
                            </button>
                          </div>
                        )
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5">
                      {order.user?.name} · {order.user?.phone}
                    </p>
                    <p className="text-sm text-gray-500">{new Date(order.createdAt).toLocaleDateString('th-TH', { dateStyle: 'medium' })}</p>
                  </div>
                  <div className="text-right flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <p className="font-bold text-green-700">฿{Number(order.totalAmount).toLocaleString()}</p>
                    <p className="text-sm text-gray-500">{order.items.length} รายการ</p>
                  </div>
                </div>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
                    {/* Items */}
                    <div className="space-y-2">
                      {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                          <span className="text-gray-700">{item.product.name} x{item.quantity} {item.product.unit}</span>
                          <span className="font-medium text-gray-700">฿{(Number(item.price) * item.quantity).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>

                    {/* Address */}
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                      <p className="font-medium text-gray-700">{order.address?.recipient} · {order.address?.phone}</p>
                      <p className="text-sm mt-0.5">{order.address?.address}, {order.address?.subdistrict}, {order.address?.district}, {order.address?.province} {order.address?.zipCode}</p>
                    </div>

                    {/* Payment info */}
                    {order.payment && (
                      <p className="text-sm text-gray-600">
                        การชำระเงิน: <span className="font-medium">{order.payment.method}</span>
                        {' · '}
                        <span className={order.payment.status === 'SUCCESS' ? 'text-green-600' : 'text-yellow-600'}>
                          {order.payment.status === 'SUCCESS' ? 'ชำระแล้ว' : 'รอการชำระ'}
                        </span>
                      </p>
                    )}

                    {/* Note */}
                    {order.note && (
                      <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <span className="text-amber-500 text-sm flex-shrink-0">📝</span>
                        <div>
                          <p className="text-sm font-semibold text-amber-700 mb-0.5">หมายเหตุจากลูกค้า</p>
                          <p className="text-sm text-amber-800">{order.note}</p>
                        </div>
                      </div>
                    )}

                    {/* Action buttons — bottom */}
                    <div className="border-t border-gray-100 pt-3 flex items-center gap-2">
                      {action && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (action.next === 'SHIPPING') {
                              setShippingTarget(order.id)
                            } else {
                              updateStatus.mutate({ id: order.id, status: action.next })
                            }
                          }}
                          disabled={updateStatus.isPending}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${action.color}`}
                        >
                          {action.icon} {action.label}
                        </button>
                      )}
                      {!['SHIPPING', 'DELIVERED', 'CANCELLED'].includes(order.status) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setCancelTarget(order.id) }}
                          disabled={updateStatus.isPending}
                          className="px-3 py-2 rounded-lg text-sm text-red-500 border border-red-200 hover:bg-red-50 transition disabled:opacity-50"
                        >
                          ยกเลิก
                        </button>
                      )}
                      <Link href={`/orders/${order.id}`} onClick={(e) => e.stopPropagation()} className="ml-auto text-sm text-green-600 hover:underline">
                        ดูรายละเอียด →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-4" />
          {isFetchingNextPage && (
            <div className="flex justify-center py-4 text-gray-500">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}
          {!hasNextPage && orders.length > PAGE_SIZE && (
            <p className="text-center text-sm text-gray-500 py-3">แสดงทั้งหมด {orders.length} รายการ</p>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!shippingTarget}
        title="ส่งสินค้าให้ขนส่งแล้ว"
        description="กรุณากรอกหมายเลขพัสดุเพื่อให้ลูกค้าติดตามสินค้าได้ (ถ้ามี)"
        confirmLabel="ยืนยันการจัดส่ง"
        cancelLabel="ยกเลิก"
        variant="warning"
        isLoading={updateStatus.isPending}
        onConfirm={() => {
          if (shippingTarget) updateStatus.mutate(
            { id: shippingTarget, status: 'SHIPPING', trackingNumber: trackingNumber.trim() || undefined },
            { onSettled: () => { setShippingTarget(null); setTrackingNumber('') } }
          )
        }}
        onCancel={() => { setShippingTarget(null); setTrackingNumber('') }}
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-600">หมายเลขพัสดุ / Tracking Number</label>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="เช่น TH123456789TH, EF123456789TH"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            autoFocus
          />
          <p className="text-sm text-gray-500">ลูกค้าจะเห็นหมายเลขนี้ในหน้าติดตามคำสั่งซื้อ</p>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!cancelTarget}
        title="ยืนยันการยกเลิกคำสั่งซื้อ"
        description="เมื่อยกเลิกแล้วจะไม่สามารถเปลี่ยนแปลงได้ กรุณาระบุเหตุผล (ถ้ามี)"
        confirmLabel="ยกเลิกคำสั่งซื้อ"
        cancelLabel="ไม่ยกเลิก"
        variant="danger"
        isLoading={updateStatus.isPending}
        onConfirm={() => {
          if (cancelTarget) updateStatus.mutate(
            { id: cancelTarget, status: 'CANCELLED', cancelNote: cancelNote.trim() || undefined },
            { onSettled: () => { setCancelTarget(null); setCancelNote('') } }
          )
        }}
        onCancel={() => { setCancelTarget(null); setCancelNote('') }}
      >
        <textarea
          value={cancelNote}
          onChange={(e) => setCancelNote(e.target.value)}
          placeholder="เช่น ลูกค้าติดต่อขอยกเลิก, สินค้าหมด..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
      </ConfirmDialog>
    </div>
  )
}
