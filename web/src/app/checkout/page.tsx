'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useCartStore } from '@/store/cartStore'
import { useAuthModalStore } from '@/store/authModalStore'
import api from '@/lib/api'
import { Address, CartItem, PaymentMethod } from '@/types'
import { MapPin, Plus, Truck, Store } from 'lucide-react'
import toast from 'react-hot-toast'

const paymentLabels: Record<PaymentMethod, string> = {
  PROMPTPAY: '💚 PromptPay',
  CREDIT_CARD: '💳 บัตรเครดิต',
  BANK_TRANSFER: '🏦 โอนเงิน',
}

interface ShippingConfig {
  baseRate: number
  weightLimitKg: number
  perKgRate: number
  freeThreshold: number
  minBaseRate: number
  maxBaseRate: number
}

function getItemWeightKg(item: CartItem): number {
  const { unit, weightKg } = item.product
  if (unit === 'กิโลกรัม') return item.quantity
  if (unit === 'กรัม') return item.quantity / 1000
  return (weightKg ?? 0.5) * item.quantity
}

function calcFarmShipping(
  farmItems: CartItem[],
  farmSubtotal: number,
  config: ShippingConfig,
  farmRate: number | null | undefined,
): { fee: number; isFree: boolean } {
  if (farmSubtotal >= config.freeThreshold) return { fee: 0, isFree: true }
  const weightKg = farmItems.reduce((s, i) => s + getItemWeightKg(i), 0)
  const baseRate = farmRate != null
    ? Math.max(config.minBaseRate, Math.min(config.maxBaseRate, farmRate))
    : config.baseRate
  if (weightKg <= config.weightLimitKg) return { fee: baseRate, isFree: false }
  return { fee: baseRate + Math.ceil(weightKg - config.weightLimitKg) * config.perKgRate, isFree: false }
}

export default function CheckoutPage() {
  const { isAuthenticated } = useAuthStore()
  const { cart, fetchCart, clearCart } = useCartStore()
  const { openLogin } = useAuthModalStore()
  const router = useRouter()
  const qc = useQueryClient()
  const [selectedAddress, setSelectedAddress] = useState<string>('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PROMPTPAY')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!isAuthenticated) { openLogin(); return }
    fetchCart()
  }, [isAuthenticated])

  const { data: addresses } = useQuery<Address[]>({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then((r) => r.data),
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (addresses?.length) {
      const def = addresses.find((a) => a.isDefault) || addresses[0]
      if (def) setSelectedAddress(def.id)
    }
  }, [addresses])

  const { data: shippingConfig } = useQuery<ShippingConfig>({
    queryKey: ['shipping-config'],
    queryFn: () => api.get('/farms/shipping-config').then((r) => r.data),
  })

  // Group by farm
  const farmGroups: { farmId: string; farmName: string; farmRate: number | null | undefined; items: CartItem[] }[] = []
  if (cart) {
    const seen = new Set<string>()
    for (const item of cart.items) {
      const fid = item.product.farm?.id ?? item.product.farmId
      if (!seen.has(fid)) {
        seen.add(fid)
        farmGroups.push({
          farmId: fid,
          farmName: item.product.farm?.name ?? 'ฟาร์ม',
          farmRate: item.product.farm?.shippingRate,
          items: cart.items.filter((i) => (i.product.farm?.id ?? i.product.farmId) === fid),
        })
      }
    }
  }

  const farmCalcs = shippingConfig
    ? farmGroups.map((g) => {
        const subtotal = g.items.reduce((s, i) => s + Number(i.product.displayPrice ?? i.product.price) * i.quantity, 0)
        const shipping = calcFarmShipping(g.items, subtotal, shippingConfig, g.farmRate)
        return { ...g, subtotal, shipping }
      })
    : []

  const totalSubtotal = farmCalcs.reduce((s, g) => s + g.subtotal, 0)
  const totalShipping = farmCalcs.reduce((s, g) => s + g.shipping.fee, 0)
  const grandTotal = totalSubtotal + totalShipping

  const orderMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/orders', { addressId: selectedAddress, note })
      const orders: { id: string }[] = data.orders
      // สร้าง payment แยกต่อ order
      await Promise.all(orders.map((o) => api.post('/payments', { orderId: o.id, method: paymentMethod })))
      return orders
    },
    onSuccess: (orders) => {
      clearCart()
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['farm'] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      toast.success(orders.length > 1 ? `สั่งซื้อสำเร็จ ${orders.length} ออเดอร์!` : 'สั่งซื้อสำเร็จ!')
      // ถ้า 1 ฟาร์ม → ไปหน้า order นั้น, ถ้าหลายฟาร์ม → ไปหน้ารายการทั้งหมด
      if (orders.length === 1) {
        router.push(`/orders/${orders[0].id}`)
      } else {
        router.push('/orders')
      }
    },
    onError: () => toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่'),
  })

  useEffect(() => {
    if (cart !== null && cart.items.length === 0) router.push('/cart')
  }, [cart])

  if (!cart || cart.items.length === 0) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-600">สรุปการสั่งซื้อ</h1>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-3 space-y-4">
          {/* Address */}
          <div className="bg-white rounded-xl p-3 sm:p-5 border border-gray-100">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-semibold text-gray-600 flex items-center gap-2"><MapPin size={16} /> ที่อยู่จัดส่ง</h2>
              <button onClick={() => router.push('/profile?tab=addresses&addAddress=1')} className="text-green-600 text-sm flex items-center gap-1">
                <Plus size={14} /> เพิ่มที่อยู่
              </button>
            </div>
            {addresses?.length === 0 ? (
              <p className="text-gray-500 text-sm">ยังไม่มีที่อยู่ กรุณาเพิ่มที่อยู่ก่อน</p>
            ) : (
              <div className="space-y-2">
                {addresses?.map((addr) => (
                  <label key={addr.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${selectedAddress === addr.id ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                    <input type="radio" name="address" value={addr.id} checked={selectedAddress === addr.id}
                      onChange={() => setSelectedAddress(addr.id)} className="mt-1" />
                    <div>
                      <p className="font-medium text-sm text-gray-600">{addr.recipient} · {addr.phone}</p>
                      <p className="text-sm text-gray-600">{addr.address}, {addr.subdistrict}, {addr.district}, {addr.province} {addr.zipCode}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment */}
          <div className="bg-white rounded-xl p-3 sm:p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-600 mb-3">วิธีชำระเงิน</h2>
            <div className="space-y-2">
              {(Object.keys(paymentLabels) as PaymentMethod[]).map((method) => (
                <label key={method} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${paymentMethod === method ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                  <input type="radio" name="payment" value={method} checked={paymentMethod === method}
                    onChange={() => setPaymentMethod(method)} />
                  <span className="text-gray-600">{paymentLabels[method]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="bg-white rounded-xl p-3 sm:p-5 border border-gray-100">
            <h2 className="font-semibold text-gray-600 mb-3">หมายเหตุ</h2>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="ระบุหมายเหตุ (ถ้ามี)" rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm resize-none" />
          </div>
        </div>

        {/* Order Summary */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl p-3 sm:p-5 border border-gray-100 sticky top-4 space-y-4">
            <h2 className="font-semibold text-gray-600">สรุปรายการ</h2>

            {/* Per-farm breakdown */}
            <div className="space-y-4">
              {farmCalcs.map((g) => (
                <div key={g.farmId}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Store size={12} className="text-green-600" />
                    <span className="text-sm font-semibold text-green-700">{g.farmName}</span>
                  </div>
                  <div className="space-y-1 ml-3.5">
                    {g.items.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-gray-600">
                        <span className="line-clamp-1 flex-1 mr-2">{item.product.name} ×{item.quantity}</span>
                        <span>฿{(Number(item.product.displayPrice ?? item.product.price) * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm text-gray-600 pt-1">
                      <span className="flex items-center gap-1"><Truck size={10} /> ค่าขนส่ง</span>
                      {g.shipping.isFree ? (
                        <span className="text-green-600">ฟรี</span>
                      ) : (
                        <span>฿{g.shipping.fee.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand total */}
            <div className="border-t pt-3 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>ยอดสินค้า</span>
                <span>฿{totalSubtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 items-center">
                <span className="flex items-center gap-1">
                  <Truck size={12} />
                  ค่าขนส่งรวม{farmGroups.length > 1 ? ` (${farmGroups.length} ฟาร์ม)` : ''}
                </span>
                {!shippingConfig ? (
                  <span className="text-gray-500 text-sm">คำนวณ...</span>
                ) : totalShipping === 0 ? (
                  <span className="text-green-600 font-medium">ฟรี</span>
                ) : (
                  <span>฿{totalShipping.toLocaleString()}</span>
                )}
              </div>
              <div className="flex justify-between font-bold text-gray-700 pt-1 border-t">
                <span>รวมทั้งหมด</span>
                <span className="text-green-700">฿{grandTotal.toLocaleString()}</span>
              </div>
            </div>

            <button
              onClick={() => orderMutation.mutate()}
              disabled={!selectedAddress || orderMutation.isPending}
              className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50"
            >
              {orderMutation.isPending ? 'กำลังสั่งซื้อ...' : 'ยืนยันการสั่งซื้อ'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
