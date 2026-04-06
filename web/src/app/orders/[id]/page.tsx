'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import api from '@/lib/api'
import { OrderStatus } from '@/types'
import { MapPin, CreditCard, Store, Truck, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import ReviewModal from '@/components/ReviewModal'
import FarmReviewModal from '@/components/FarmReviewModal'
import { useAuthStore } from '@/store/authStore'

const statusLabel: Record<OrderStatus, string> = {
  PENDING: 'รอชำระเงิน', PAID: 'ชำระแล้ว', CONFIRMED: 'ยืนยันแล้ว',
  SHIPPING: 'กำลังจัดส่ง', DELIVERED: 'จัดส่งแล้ว', CANCELLED: 'ยกเลิก',
}
const statusColor: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', PAID: 'bg-blue-100 text-blue-700',
  CONFIRMED: 'bg-indigo-100 text-indigo-700', SHIPPING: 'bg-orange-100 text-orange-700',
  DELIVERED: 'bg-green-100 text-green-700', CANCELLED: 'bg-red-100 text-red-700',
}

const displaySteps = [
  { label: 'รอชำระเงิน' },
  { label: 'ชำระแล้ว' },
  { label: 'ยืนยันแล้ว' },
  { label: 'กำลังเตรียมสินค้า' },
  { label: 'กำลังจัดส่ง' },
  { label: 'จัดส่งแล้ว' },
]
const statusToStep: Record<string, number> = {
  PENDING: 0, PAID: 1, CONFIRMED: 3, SHIPPING: 4, DELIVERED: 5,
}

function ProgressBar({ status }: { status: string }) {
  const currentStep = statusToStep[status] ?? -1
  const N = displaySteps.length
  const lineOffset = `${(0.5 / N) * 100}%`
  const progressWidth = `${(currentStep / N) * 100}%`
  return (
    <div className="relative flex">
      <div className="absolute top-4 h-0.5 bg-gray-200 z-0" style={{ left: lineOffset, right: lineOffset }} />
      <div className="absolute top-4 h-0.5 bg-green-500 z-0 transition-all" style={{ left: lineOffset, width: progressWidth }} />
      {displaySteps.map((step, i) => (
        <div key={i} className="flex-1 flex flex-col items-center z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 ${i <= currentStep ? 'bg-green-500 border-green-500 text-white' : 'bg-white border-gray-300 text-gray-500'}`}>
            {i < currentStep ? '✓' : i + 1}
          </div>
          <p className="text-sm mt-1 text-gray-600 text-center leading-tight">{step.label}</p>
        </div>
      ))}
    </div>
  )
}

type OrderItem = {
  id: string
  quantity: number
  price: number
  product: {
    id: string
    name: string
    images: string[]
    unit: string
    farm?: { id: string; slug?: string | null; name: string }
  }
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [showConfirm, setShowConfirm] = useState(false)
  const [cancelNote, setCancelNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [showFarmReview, setShowFarmReview] = useState(false)
  const [farmReviewLoading, setFarmReviewLoading] = useState(false)
  const [pendingFarm, setPendingFarm] = useState<{ id: string; name: string } | null>(null)

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => api.get(`/orders/${id}`).then((r) => r.data),
    staleTime: 0,
  })

  const handleConfirmDelivery = async (reviewData: { productId: string; rating: number; comment: string }[]) => {
    setReviewLoading(true)
    try {
      await api.put(`/orders/${id}/confirm-delivery`)
      await Promise.allSettled(reviewData.map((r) => api.post('/reviews', r)))
      qc.invalidateQueries({ queryKey: ['order', id] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['farm'] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      toast.success('ยืนยันได้รับสินค้าและเขียนรีวิวเรียบร้อย')
      setShowReview(false)
      const farmFromOrder = order?.items?.[0]?.product?.farm
      if (farmFromOrder?.id) {
        setPendingFarm({ id: farmFromOrder.id, name: farmFromOrder.name })
        setShowFarmReview(true)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setReviewLoading(false)
    }
  }

  const cancelOrder = useMutation({
    mutationFn: () => api.put(`/orders/${id}/cancel`, { cancelNote: cancelNote.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['order', id] })
      qc.invalidateQueries({ queryKey: ['orders'] })
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['farm'] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      toast.success('ยกเลิกคำสั่งซื้อแล้ว')
      setShowConfirm(false)
      setCancelNote('')
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message ?? 'เกิดข้อผิดพลาด')
      setShowConfirm(false)
    },
  })

  const handleFarmReview = async (rating: number, comment: string) => {
    if (!pendingFarm) return
    setFarmReviewLoading(true)
    try {
      await api.post(`/farms/${pendingFarm.id}/reviews`, { rating, comment })
      toast.success('ขอบคุณสำหรับรีวิวฟาร์ม!')
      qc.invalidateQueries({ queryKey: ['farm', pendingFarm.id] })
    } catch {
      toast.error('ส่งรีวิวฟาร์มไม่สำเร็จ')
    } finally {
      setFarmReviewLoading(false)
      setShowFarmReview(false)
      setPendingFarm(null)
    }
  }

  if (isLoading) return <div className="animate-pulse bg-gray-100 h-96 rounded-2xl" />
  if (!order) return <div className="text-center py-20 text-gray-500">ไม่พบคำสั่งซื้อ</div>

  const items: OrderItem[] = order.items ?? []
  const canCancel = order.status === 'PENDING'

  // จัดกลุ่มสินค้าตามฟาร์ม
  const farmGroups: { farmId: string; farmName: string; farmPageId?: string; items: OrderItem[] }[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const fid = item.product.farm?.id ?? 'unknown'
    if (!seen.has(fid)) {
      seen.add(fid)
      farmGroups.push({
        farmId: fid,
        farmName: item.product.farm?.name ?? 'ฟาร์ม',
        farmPageId: item.product.farm?.slug ?? item.product.farm?.id,
        items: items.filter((i) => (i.product.farm?.id ?? 'unknown') === fid),
      })
    }
  }

  const subtotal = items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-600">รายละเอียดคำสั่งซื้อ</h1>
        <span className={`text-sm px-3 py-1 rounded-full font-medium ${statusColor[order.status as OrderStatus]}`}>
          {statusLabel[order.status as OrderStatus]}
        </span>
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        #{order.id.toUpperCase()} · {new Date(order.createdAt).toLocaleDateString('th-TH', { dateStyle: 'long' })}
      </p>

      {/* Progress bar */}
      {order.status !== 'CANCELLED' && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <ProgressBar status={order.status} />
        </div>
      )}

      {/* Cancel reason */}
      {order.status === 'CANCELLED' && order.cancelNote && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-500 mb-1">เหตุผลการยกเลิก</p>
          <p className="text-sm text-red-700">{order.cancelNote}</p>
        </div>
      )}

      {/* Tracking number */}
      {['SHIPPING', 'DELIVERED'].includes(order.status) && (
        <div className={`rounded-xl border p-4 ${order.status === 'DELIVERED' ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Truck size={16} className={order.status === 'DELIVERED' ? 'text-green-600' : 'text-orange-500'} />
            <span className={`text-sm font-semibold ${order.status === 'DELIVERED' ? 'text-green-700' : 'text-orange-700'}`}>
              {order.status === 'DELIVERED' ? 'จัดส่งถึงแล้ว' : 'อยู่ระหว่างจัดส่ง'}
            </span>
          </div>
          {order.trackingNumber ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white rounded-lg border border-orange-200 px-3 py-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500 mb-0.5">หมายเลขพัสดุ</p>
                  <p className="font-mono font-semibold text-gray-800 text-sm tracking-wider">{order.trackingNumber}</p>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(order.trackingNumber!)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-green-600 transition px-2 py-1 rounded-lg hover:bg-green-50"
                >
                  {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">ร้านค้ายังไม่ได้กรอกหมายเลขพัสดุ</p>
          )}
        </div>
      )}

      {/* Items grouped by farm */}
      {farmGroups.map((group) => {
        const groupSubtotal = group.items.reduce((s, i) => s + Number(i.price) * i.quantity, 0)
        return (
          <div key={group.farmId} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Farm header */}
            <div className="flex items-center justify-between px-5 py-3 bg-green-50 border-b border-green-100">
              <div className="flex items-center gap-2">
                <Store size={15} className="text-green-600" />
                {group.farmPageId ? (
                  <Link href={`/farms/${group.farmPageId}`}
                    className="font-semibold text-green-700 hover:underline text-sm">
                    {group.farmName}
                  </Link>
                ) : (
                  <span className="font-semibold text-green-700 text-sm">{group.farmName}</span>
                )}
              </div>
              <span className="text-sm text-green-600 font-medium">
                {group.items.length} รายการ
              </span>
            </div>

            {/* Items */}
            <div className="divide-y divide-gray-50">
              {group.items.map((item) => (
                <div key={item.id} className="flex gap-3 items-center px-5 py-4">
                  <Link href={`/products/${item.product.id}`}
                    className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 hover:opacity-90 transition block">
                    {item.product.images?.[0] ? (
                      <Image src={item.product.images[0]} alt={item.product.name} fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xl">🌿</div>
                    )}
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${item.product.id}`}
                      className="font-medium text-sm text-gray-800 hover:text-green-700 transition line-clamp-1 block">
                      {item.product.name}
                    </Link>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {item.quantity} {item.product.unit} × ฿{Number(item.price).toLocaleString()}
                    </p>
                  </div>
                  <p className="font-semibold text-sm text-gray-800 flex-shrink-0">
                    ฿{(Number(item.price) * item.quantity).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Farm subtotal */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-700">
              <span>รวมฟาร์มนี้</span>
              <span>฿{groupSubtotal.toLocaleString()}</span>
            </div>
          </div>
        )
      })}

      {/* Grand total summary */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>ยอดสินค้ารวม</span>
          <span>฿{subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-sm text-gray-600 items-center">
          <span className="flex items-center gap-1.5"><Truck size={13} /> ค่าขนส่ง</span>
          {Number(order.shippingFee) === 0 ? (
            <span className="text-green-600 font-medium">ฟรี</span>
          ) : (
            <span>฿{Number(order.shippingFee).toLocaleString()}</span>
          )}
        </div>
        <div className="border-t pt-2 flex justify-between font-bold text-gray-800">
          <span>รวมทั้งหมด</span>
          <span className="text-green-700">฿{Number(order.totalAmount).toLocaleString()}</span>
        </div>
      </div>

      {/* Address */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h2 className="font-semibold text-gray-600 mb-3 flex items-center gap-2"><MapPin size={16} /> ที่อยู่จัดส่ง</h2>
        <p className="font-medium text-gray-800">{order.address.recipient} · {order.address.phone}</p>
        <p className="text-sm text-gray-600 mt-1">
          {order.address.address}, {order.address.subdistrict}, {order.address.district}, {order.address.province} {order.address.zipCode}
        </p>
      </div>

      {/* Payment */}
      {order.payment && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-600 mb-3 flex items-center gap-2"><CreditCard size={16} /> การชำระเงิน</h2>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">วิธีชำระ</span>
            <span className="text-gray-800">{order.payment.method}</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-600">สถานะ</span>
            <span className={order.payment.status === 'SUCCESS' ? 'text-green-600' : 'text-yellow-600'}>{order.payment.status}</span>
          </div>
          {order.payment.transactionId && (
            <div className="flex justify-between text-sm mt-1">
              <span className="text-gray-600">Transaction ID</span>
              <span className="font-mono text-sm text-gray-800">{order.payment.transactionId}</span>
            </div>
          )}
        </div>
      )}

      {/* Confirm delivery */}
      {order.status === 'SHIPPING' && user?.id === order.userId && (
        <button onClick={() => setShowReview(true)}
          className="w-full bg-green-600 text-white py-3 rounded-xl text-sm font-semibold hover:bg-green-700 transition">
          ยืนยันได้รับสินค้าแล้ว และเขียนรีวิว
        </button>
      )}

      {/* Cancel */}
      {canCancel && (
        <button onClick={() => setShowConfirm(true)}
          className="w-full border border-red-300 text-red-500 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition">
          ยกเลิกคำสั่งซื้อ
        </button>
      )}

      <ReviewModal
        open={showReview}
        items={items.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          productImage: item.product.images?.[0],
        }))}
        isLoading={reviewLoading}
        onConfirm={handleConfirmDelivery}
        onCancel={() => setShowReview(false)}
      />

      <ConfirmDialog
        open={showConfirm}
        title="ยืนยันการยกเลิกคำสั่งซื้อ"
        description="เมื่อยกเลิกแล้วจะไม่สามารถเปลี่ยนแปลงได้ กรุณาระบุเหตุผล (ถ้ามี)"
        confirmLabel="ยกเลิกคำสั่งซื้อ"
        cancelLabel="ไม่ยกเลิก"
        variant="danger"
        isLoading={cancelOrder.isPending}
        onConfirm={() => cancelOrder.mutate()}
        onCancel={() => { setShowConfirm(false); setCancelNote('') }}
      >
        <textarea
          value={cancelNote}
          onChange={(e) => setCancelNote(e.target.value)}
          placeholder="เช่น ต้องการเปลี่ยนที่อยู่จัดส่ง, สั่งผิดรายการ..."
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
        />
      </ConfirmDialog>

      {showFarmReview && pendingFarm && (
        <FarmReviewModal
          farmName={pendingFarm.name}
          onConfirm={handleFarmReview}
          onSkip={() => { setShowFarmReview(false); setPendingFarm(null) }}
          isLoading={farmReviewLoading}
        />
      )}
    </div>
  )
}
