'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { CheckCircle, Loader2, ArrowDownToLine, ArrowUpFromLine, Settings2, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore } from '@/store/cartStore'

type PricingModel = 'A' | 'B'

const EXAMPLE_PRICE = 100
const VAT_RATE = 0.07

export default function AdminPricingPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()

  const { fetchCart } = useCartStore()

  const [model, setModel] = useState<PricingModel>('A')
  const [rateInput, setRateInput] = useState('10')
  const [vatEnabled, setVatEnabled] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN' && user?.role !== 'HOST') router.push('/')
  }, [isAuthenticated, user])

  const { data: config, isLoading } = useQuery({
    queryKey: ['admin-pricing'],
    queryFn: () => api.get('/admin/pricing').then((r) => r.data),
    enabled: isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'HOST'),
  })

  useEffect(() => {
    if (config) {
      setModel(config.pricingModel as PricingModel)
      setRateInput(String(Math.round(config.commissionRate * 100)))
      setVatEnabled(!!config.vatEnabled)
    }
  }, [config])

  const save = useMutation({
    mutationFn: () => {
      const rate = Number(rateInput) / 100
      return api.put('/admin/pricing', { pricingModel: model, commissionRate: rate, vatEnabled }).then((r) => r.data)
    },
    onSuccess: () => {
      // invalidate pricing config ทุกที่
      qc.invalidateQueries({ queryKey: ['admin-pricing'] })
      qc.invalidateQueries({ queryKey: ['pricing-config'] })
      // invalidate products + farms ทุกหน้า (displayPrice คำนวณจาก server ต้อง refetch ใหม่)
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product'] })
      qc.invalidateQueries({ queryKey: ['farm'] })
      qc.invalidateQueries({ queryKey: ['farms'] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      // cart ใช้ Zustand — refetch โดยตรง
      fetchCart().catch(() => {})
      toast.success('บันทึกการตั้งค่าแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const rate = Math.max(0, Math.min(100, Number(rateInput) || 0))
  const rateDecimal = rate / 100

  // Live preview calculation
  const farmPrice = EXAMPLE_PRICE
  const commission = Math.round(farmPrice * rateDecimal * 100) / 100
  const vat = vatEnabled ? Math.round(farmPrice * VAT_RATE * 100) / 100 : 0

  // Option A: ลูกค้าจ่าย = price + VAT, ฟาร์มได้ = price - commission
  // Option B: ลูกค้าจ่าย = price + commission + VAT, ฟาร์มได้ = price
  const customerPays = model === 'A'
    ? Math.round((farmPrice + vat) * 100) / 100
    : Math.round((farmPrice + commission + vat) * 100) / 100
  const farmReceives = model === 'A'
    ? Math.round((farmPrice - commission) * 100) / 100
    : farmPrice
  const platformGets = commission

  const isDirty = config && (
    config.pricingModel !== model ||
    Math.round(config.commissionRate * 100) !== rate ||
    !!config.vatEnabled !== vatEnabled
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Settings2 size={22} className="text-gray-500" />
        <h1 className="text-2xl font-extrabold text-gray-600">โครงสร้างราคา</h1>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
      ) : (
        <>
          {/* Option Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option A */}
            <button
              onClick={() => setModel('A')}
              className={`text-left rounded-2xl border-2 p-5 transition ${
                model === 'A' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-green-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                    <ArrowDownToLine size={16} className="text-green-600" />
                  </div>
                  <span className="font-bold text-gray-700">Option A</span>
                </div>
                {model === 'A' && <CheckCircle size={18} className="text-green-500" />}
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">หัก % จากฟาร์ม</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                ลูกค้าจ่าย ราคาสินค้า {vatEnabled ? '+ VAT 7%' : '(ไม่มี VAT)'}<br />
                Platform หัก commission ก่อนโอนให้ฟาร์ม
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between bg-white rounded-lg px-3 py-1.5 border border-green-200">
                  <span className="text-gray-600">ลูกค้าจ่าย</span>
                  <span className="font-semibold text-gray-700">ราคา{vatEnabled ? ' + VAT' : ''}</span>
                </div>
                <div className="flex justify-between bg-white rounded-lg px-3 py-1.5 border border-green-200">
                  <span className="text-gray-600">ฟาร์มได้รับ</span>
                  <span className="font-semibold text-gray-700">ราคา − commission</span>
                </div>
              </div>
            </button>

            {/* Option B */}
            <button
              onClick={() => setModel('B')}
              className={`text-left rounded-2xl border-2 p-5 transition ${
                model === 'B' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-blue-300'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <ArrowUpFromLine size={16} className="text-blue-600" />
                  </div>
                  <span className="font-bold text-gray-700">Option B</span>
                </div>
                {model === 'B' && <CheckCircle size={18} className="text-blue-500" />}
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-1">บวก % ให้ลูกค้า</p>
              <p className="text-sm text-gray-600 leading-relaxed">
                ลูกค้าจ่าย ราคาสินค้า + commission {vatEnabled ? '+ VAT 7%' : '(ไม่มี VAT)'}<br />
                ฟาร์มได้รับเต็มราคาที่ตั้งไว้
              </p>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between bg-white rounded-lg px-3 py-1.5 border border-blue-200">
                  <span className="text-gray-600">ลูกค้าจ่าย</span>
                  <span className="font-semibold text-gray-700">ราคา + comm{vatEnabled ? ' + VAT' : ''}</span>
                </div>
                <div className="flex justify-between bg-white rounded-lg px-3 py-1.5 border border-blue-200">
                  <span className="text-gray-600">ฟาร์มได้รับ</span>
                  <span className="font-semibold text-gray-700">ราคาเต็ม</span>
                </div>
              </div>
            </button>
          </div>

          {/* Commission Rate */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">อัตรา Commission</p>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={0}
                max={30}
                step={0.5}
                value={rate}
                onChange={(e) => setRateInput(e.target.value)}
                className="flex-1 accent-green-600"
              />
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                <input
                  type="number"
                  min={0}
                  max={30}
                  step={0.5}
                  value={rateInput}
                  onChange={(e) => setRateInput(e.target.value)}
                  className="w-16 text-center py-2 text-sm font-bold text-gray-700 focus:outline-none"
                />
                <span className="px-2 text-sm text-gray-600 bg-gray-50 h-full flex items-center border-l border-gray-200">%</span>
              </div>
            </div>
          </div>

          {/* VAT Toggle */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                  <Receipt size={16} className="text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">VAT 7%</p>
                  <p className="text-sm text-gray-500">บวกเพิ่มจากราคาสินค้า ทั้ง 2 Option</p>
                </div>
              </div>
              <button
                onClick={() => setVatEnabled((v) => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
                  vatEnabled ? 'bg-orange-500' : 'bg-gray-200'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                  vatEnabled ? 'translate-x-6' : 'translate-x-0'
                }`} />
              </button>
            </div>
            {vatEnabled && (
              <p className="mt-3 text-sm text-orange-600 bg-orange-50 rounded-lg px-3 py-2">
                VAT 7% จะถูกบวกเพิ่มจากราคาสินค้าก่อนแสดงให้ลูกค้า
              </p>
            )}
          </div>

          {/* Live Preview */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="text-sm font-semibold text-gray-700 mb-4">
              ตัวอย่างการคำนวณ (ราคาสินค้า ฿{EXAMPLE_PRICE})
            </p>

            {/* Breakdown */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ราคาสินค้า (ฟาร์มตั้ง)</span>
                <span className="font-semibold text-gray-700">฿{farmPrice}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Commission {rate}% {model === 'A' ? '(หักจากฟาร์ม)' : '(บวกให้ลูกค้า)'}</span>
                <span className={`font-semibold ${model === 'A' ? 'text-red-500' : 'text-blue-500'}`}>
                  {model === 'A' ? '−' : '+'}฿{commission}
                </span>
              </div>
              {vatEnabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT 7% (บวกให้ลูกค้า)</span>
                  <span className="font-semibold text-orange-500">+฿{vat}</span>
                </div>
              )}
              <div className="border-t border-gray-100 pt-2 space-y-1">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">ลูกค้าจ่ายทั้งหมด</span>
                  <span className="text-gray-900">฿{customerPays}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">ฟาร์มได้รับ</span>
                  <span className="text-green-700">฿{farmReceives}</span>
                </div>
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">Platform ได้รับ</span>
                  <span className="text-purple-600">฿{Math.round((customerPays - farmReceives) * 100) / 100}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || !isDirty}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              บันทึกการตั้งค่า
            </button>
            {!isDirty && config && (
              <span className="text-sm text-gray-500">
                ใช้งานอยู่: Option {config.pricingModel} · {Math.round(config.commissionRate * 100)}% · VAT {config.vatEnabled ? 'เปิด' : 'ปิด'}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
