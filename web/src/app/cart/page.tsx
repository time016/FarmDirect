'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useQuery } from '@tanstack/react-query'
import { useCartStore } from '@/store/cartStore'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Order, CartItem } from '@/types'
import { Trash2, Plus, Minus, ShoppingBag, Package, ChevronRight, Truck, ChevronDown, Scale, Store } from 'lucide-react'
import toast from 'react-hot-toast'
import LoginRequired from '@/components/LoginRequired'

function RecentProductCard({ product }: { product: { id: string; name: string; images: unknown; farm?: { id?: string; name?: string } } }) {
  const image = (product.images as string[])?.[0]
  return (
    <Link href={`/products/${product.id}`} className="flex-shrink-0 w-28 group">
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden group-hover:shadow-md transition">
        <div className="relative w-full aspect-square bg-gray-100">
          {image ? (
            <Image src={image} alt={product.name} fill sizes="112px" className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
          )}
        </div>
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium text-gray-700 line-clamp-2 leading-tight">{product.name}</p>
          {product.farm?.name && <p className="text-sm text-green-600 truncate mt-0.5">{product.farm.name}</p>}
        </div>
      </div>
    </Link>
  )
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

interface FarmOverride {
  shippingRate?: number | null
  shippingWeightLimitKg?: number | null
  shippingPerKgRate?: number | null
  shippingFreeThreshold?: number | null
}

function calcFarmShipping(
  farmItems: CartItem[],
  farmSubtotal: number,
  config: ShippingConfig,
  override: FarmOverride,
): { fee: number; weightKg: number; breakdown: string; isFree: boolean } {
  const weightKg = farmItems.reduce((s, i) => s + getItemWeightKg(i), 0)

  const freeThreshold = override.shippingFreeThreshold ?? config.freeThreshold
  if (farmSubtotal >= freeThreshold) {
    return { fee: 0, weightKg, breakdown: `ฟรีค่าส่ง (ยอด ≥ ฿${freeThreshold})`, isFree: true }
  }

  const baseRate = override.shippingRate != null
    ? Math.max(config.minBaseRate, Math.min(config.maxBaseRate, override.shippingRate))
    : config.baseRate
  const weightLimit = override.shippingWeightLimitKg ?? config.weightLimitKg
  const perKgRate = override.shippingPerKgRate ?? config.perKgRate

  if (weightKg <= weightLimit) {
    return { fee: baseRate, weightKg, breakdown: `฿${baseRate} (${weightKg.toFixed(2)} kg)`, isFree: false }
  }

  const excess = Math.ceil(weightKg - weightLimit)
  const fee = baseRate + excess * perKgRate
  return {
    fee,
    weightKg,
    breakdown: `฿${baseRate} + ฿${perKgRate}×${excess}kg เกิน = ฿${fee}`,
    isFree: false,
  }
}

export default function CartPage() {
  const { cart, fetchCart, updateItem, removeItem } = useCartStore()
  const { isAuthenticated } = useAuthStore()
  const router = useRouter()
  const [summaryOpen, setSummaryOpen] = useState(false)

  useEffect(() => {
    if (isAuthenticated) fetchCart()
  }, [isAuthenticated])

  if (!isAuthenticated) return <LoginRequired description="คุณต้องเข้าสู่ระบบก่อนเพื่อดูตะกร้าสินค้า" />

  const { data: ordersData } = useQuery({
    queryKey: ['orders'],
    queryFn: () => api.get('/orders').then((r) => r.data),
    enabled: isAuthenticated,
  })
  const recentProducts = (() => {
    const seen = new Set<string>()
    const products: { id: string; name: string; images: unknown; farm?: { id?: string; name?: string } }[] = []
    for (const order of (ordersData?.orders as Order[] | undefined) ?? []) {
      for (const item of order.items) {
        if (!seen.has(item.product.id) && products.length < 8) {
          seen.add(item.product.id)
          products.push(item.product as typeof products[0])
        }
      }
    }
    return products
  })()

  const { data: shippingConfig } = useQuery<ShippingConfig>({
    queryKey: ['shipping-config'],
    queryFn: () => api.get('/farms/shipping-config').then((r) => r.data),
  })

  // --- Group items by farm ---
  const farmGroups: { farmId: string; farmName: string; override: FarmOverride; items: CartItem[] }[] = []
  if (cart) {
    const seen = new Set<string>()
    for (const item of cart.items) {
      const fid = item.product.farm?.id ?? item.product.farmId
      if (!seen.has(fid)) {
        seen.add(fid)
        const farm = item.product.farm as (typeof item.product.farm & FarmOverride) | undefined
        farmGroups.push({
          farmId: fid,
          farmName: farm?.name ?? 'ฟาร์ม',
          override: {
            shippingRate: farm?.shippingRate,
            shippingWeightLimitKg: farm?.shippingWeightLimitKg,
            shippingPerKgRate: farm?.shippingPerKgRate,
            shippingFreeThreshold: farm?.shippingFreeThreshold,
          },
          items: cart.items.filter((i) => (i.product.farm?.id ?? i.product.farmId) === fid),
        })
      }
    }
  }

  // --- Per-farm calculations ---
  const farmCalcs = shippingConfig
    ? farmGroups.map((g) => {
        const subtotal = g.items.reduce((s, i) => s + Number(i.product.displayPrice ?? i.product.price) * i.quantity, 0)
        const shipping = calcFarmShipping(g.items, subtotal, shippingConfig, g.override)
        return { ...g, subtotal, shipping }
      })
    : []

  const totalSubtotal = farmCalcs.reduce((s, g) => s + g.subtotal, 0)
  const totalShipping = farmCalcs.reduce((s, g) => s + g.shipping.fee, 0)
  const totalWeightKg = farmCalcs.reduce((s, g) => s + g.shipping.weightKg, 0)
  const grandTotal = totalSubtotal + totalShipping

  if (!cart || cart.items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center py-16">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-600 mb-4">ตะกร้าของคุณว่างเปล่า</p>
          <Link href="/products" className="bg-green-600 text-white px-6 py-2.5 rounded-full hover:bg-green-700 transition">
            เลือกซื้อสินค้า
          </Link>
        </div>

        {recentProducts.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-gray-600 flex items-center gap-2"><Package size={18} /> สินค้าที่ซื้อล่าสุด</h2>
              <Link href="/orders" className="text-green-600 text-sm flex items-center gap-1 hover:underline">
                ดูออเดอร์ <ChevronRight size={14} />
              </Link>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {recentProducts.map((p) => <RecentProductCard key={p.id} product={p} />)}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-600">ตะกร้าสินค้า</h1>

      {/* Cart items */}
      <div className="space-y-3">
        {cart.items.map((item) => {
          const price = Number(item.product.displayPrice ?? item.product.price)
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="p-3 sm:p-4 flex gap-4">
                <Link href={`/products/${item.product.id}`}
                  className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 block hover:opacity-90 transition">
                  {item.product.images[0] ? (
                    <Image src={item.product.images[0]} alt={item.product.name} fill sizes="80px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                  )}
                </Link>

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-green-600">{item.product.farm?.name}</p>
                  <Link href={`/products/${item.product.id}`}
                    className="font-semibold text-gray-700 hover:text-green-700 transition line-clamp-1 block">
                    {item.product.name}
                  </Link>
                  <p className="text-green-700 font-bold text-sm">฿{price.toLocaleString()}/{item.product.unit}</p>
                  {item.product.weightKg && !['กิโลกรัม', 'กรัม'].includes(item.product.unit) && (
                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                      <Scale size={10} /> {item.product.weightKg} kg/หน่วย
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <button onClick={() => { removeItem(item.id); toast.success('ลบสินค้าแล้ว') }}>
                    <Trash2 size={16} className="text-red-400 hover:text-red-600" />
                  </button>
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button onClick={() => updateItem(item.id, item.quantity - 1)} className="px-2 py-1 hover:bg-gray-100 text-gray-600"><Minus size={12} /></button>
                    <span className="px-3 text-sm text-gray-600">{item.quantity}</span>
                    <button onClick={() => updateItem(item.id, item.quantity + 1)} className="px-2 py-1 hover:bg-gray-100 text-gray-600"><Plus size={12} /></button>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">฿{(price * item.quantity).toLocaleString()}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Order summary */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">

        {/* Collapsible header */}
        <button
          onClick={() => setSummaryOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 sm:px-5 pt-4 sm:pt-5 pb-3 text-left"
        >
          <span className="text-lg font-semibold text-gray-700 flex items-center gap-2">
            <Package size={20} className="text-gray-500" />
            รายละเอียดการสั่งซื้อ
          </span>
          <ChevronDown size={20} className={`text-gray-500 transition-transform ${summaryOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Collapsible body — breakdown per farm */}
        {summaryOpen && shippingConfig && (
          <div className="px-3 sm:px-5 pb-4 border-t border-gray-50 pt-3 space-y-4">
            {farmCalcs.map((g) => (
              <div key={g.farmId}>
                {/* Farm header */}
                <div className="flex items-center gap-1.5 mb-2">
                  <Store size={14} className="text-green-600" />
                  <span className="text-sm font-semibold text-green-700">{g.farmName}</span>
                  {g.override.shippingRate != null && (
                    <span className="text-sm text-gray-500">(ค่าส่งฟาร์ม ฿{g.override.shippingRate})</span>
                  )}
                </div>

                {/* Items */}
                <div className="space-y-1.5 ml-4 mb-3">
                  {g.items.map((item) => {
                    const price = Number(item.product.displayPrice ?? item.product.price)
                    const wkg = getItemWeightKg(item)
                    return (
                      <div key={item.id} className="flex justify-between text-sm text-gray-600">
                        <span className="flex-1 line-clamp-1 mr-2">{item.product.name} ×{item.quantity}</span>
                        <span className="text-gray-500 mr-3">{wkg.toFixed(2)} kg</span>
                        <span className="font-medium">฿{(price * item.quantity).toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>

                {/* Farm subtotals */}
                <div className="ml-4 space-y-1 border-t border-dashed border-gray-100 pt-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span className="flex items-center gap-1"><Scale size={13} /> น้ำหนักรวม</span>
                    <span>{g.shipping.weightKg.toFixed(2)} kg</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>ยอดสินค้า</span>
                    <span>฿{g.subtotal.toLocaleString()}</span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex justify-between text-sm text-gray-600 items-center">
                      <span className="flex items-center gap-1"><Truck size={13} /> ค่าขนส่ง</span>
                      {g.shipping.isFree ? (
                        <span className="text-green-600 font-medium">ฟรี</span>
                      ) : (
                        <span>฿{g.shipping.fee.toLocaleString()}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 ml-4">{g.shipping.breakdown}</p>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-gray-700 pt-1">
                    <span>รวมฟาร์มนี้</span>
                    <span>฿{(g.subtotal + g.shipping.fee).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Grand total breakdown */}
            {farmGroups.length > 1 && (
              <div className="border-t border-gray-200 pt-3 space-y-1">
                <div className="flex justify-between text-sm text-gray-600">
                  <span className="flex items-center gap-1.5"><Scale size={13} /> น้ำหนักรวมทั้งหมด</span>
                  <span>{totalWeightKg.toFixed(2)} kg</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>ยอดสินค้ารวม</span>
                  <span>฿{totalSubtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span className="flex items-center gap-1.5"><Truck size={13} /> ค่าขนส่งรวม ({farmGroups.length} ฟาร์ม)</span>
                  <span>฿{totalShipping.toLocaleString()}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Always-visible summary */}
        <div className="px-3 sm:px-5 pb-4 sm:pb-5 space-y-2.5">
          <div className="flex justify-between text-sm text-gray-600">
            <span>ยอดสินค้า</span>
            <span>฿{totalSubtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600 items-center">
            <span className="flex items-center gap-1.5">
              <Truck size={13} />
              ค่าขนส่ง{farmGroups.length > 1 ? ` (${farmGroups.length} ฟาร์ม)` : ''} {shippingConfig ? '(ประมาณ)' : ''}
            </span>
            {!shippingConfig ? (
              <span className="text-gray-500 text-sm">กำลังคำนวณ...</span>
            ) : totalShipping === 0 ? (
              <span className="text-green-600 font-medium">ฟรี</span>
            ) : (
              <span>฿{totalShipping.toLocaleString()}</span>
            )}
          </div>
          {shippingConfig && totalShipping > 0 && (
            <p className="text-sm text-gray-500 -mt-1">
              {farmCalcs.every((g) => g.subtotal < shippingConfig.freeThreshold)
                ? `แต่ละฟาร์ม: สั่งถึง ฿${shippingConfig.freeThreshold} ต่อฟาร์ม รับส่งฟรี`
                : null}
            </p>
          )}
          <div className="border-t pt-3 flex justify-between text-lg font-bold text-gray-700">
            <span>รวมทั้งหมด</span>
            <span className="text-green-700">฿{grandTotal.toLocaleString()}</span>
          </div>
          <Link
            href="/checkout"
            className="block w-full bg-green-600 text-white text-center py-3 rounded-xl font-semibold hover:bg-green-700 transition"
          >
            ดำเนินการสั่งซื้อ
          </Link>
        </div>
      </div>

      {recentProducts.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-gray-600 flex items-center gap-2"><Package size={18} /> สินค้าที่ซื้อล่าสุด</h2>
            <Link href="/orders" className="text-green-600 text-sm flex items-center gap-1 hover:underline">
              ดูออเดอร์ <ChevronRight size={14} />
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentProducts.map((p) => <RecentProductCard key={p.id} product={p} />)}
          </div>
        </div>
      )}
    </div>
  )
}
