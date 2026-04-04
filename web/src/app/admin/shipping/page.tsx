'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import { Truck, Info } from 'lucide-react'

interface ShippingConfig {
  baseRate: number
  weightLimitKg: number
  perKgRate: number
  freeThreshold: number
  minBaseRate: number
  maxBaseRate: number
}

export default function AdminShippingPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()

  const [form, setForm] = useState<ShippingConfig>({
    baseRate: 40, weightLimitKg: 3, perKgRate: 15, freeThreshold: 500, minBaseRate: 20, maxBaseRate: 80,
  })

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN') router.push('/')
  }, [isAuthenticated, user])

  const { data: config, isLoading } = useQuery<ShippingConfig>({
    queryKey: ['admin-shipping'],
    queryFn: () => api.get('/admin/shipping').then((r) => r.data),
    enabled: isAuthenticated && user?.role === 'ADMIN',
  })

  useEffect(() => {
    if (config) setForm(config)
  }, [config])

  const set = (key: keyof ShippingConfig, val: string) =>
    setForm((f) => ({ ...f, [key]: Number(val) || 0 }))

  const { baseRate, weightLimitKg, perKgRate, freeThreshold, minBaseRate, maxBaseRate } = form

  const mutation = useMutation({
    mutationFn: () => api.put('/admin/shipping', form).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-shipping'] })
      qc.invalidateQueries({ queryKey: ['shipping-config'] })
      toast.success('บันทึกค่าขนส่งแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const calcExample = (weight: number, subtotal: number) => {
    if (subtotal >= freeThreshold) return 0
    if (weight <= weightLimitKg) return baseRate
    return baseRate + Math.ceil(weight - weightLimitKg) * perKgRate
  }

  if (isLoading) return <div className="text-center py-20 text-gray-500">กำลังโหลด...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Truck size={24} className="text-green-600" />
        <h1 className="text-2xl font-bold text-gray-700">ตั้งค่าค่าขนส่ง</h1>
      </div>

      {/* Base rates */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-5">
        <h2 className="font-semibold text-gray-600">ค่าขนส่งพื้นฐาน (Platform)</h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'ค่าส่งพื้นฐาน (฿)', key: 'baseRate' as const, hint: 'ค่าส่งเริ่มต้นสำหรับน้ำหนักไม่เกิน limit', step: '1' },
            { label: 'น้ำหนักฟรี (kg)', key: 'weightLimitKg' as const, hint: 'น้ำหนักรวมที่ไม่คิดเพิ่ม', step: '0.5' },
            { label: 'ค่าน้ำหนักส่วนเกิน (฿/kg)', key: 'perKgRate' as const, hint: 'คิดต่อ kg ที่เกิน limit', step: '1' },
            { label: 'ยอดส่งฟรีขั้นต่ำ (฿)', key: 'freeThreshold' as const, hint: 'ฟรีค่าส่งถ้ายอดรวมถึงนี้', step: '10' },
          ].map(({ label, key, hint, step }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
              <input type="number" min={0} step={step} value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <p className="text-sm text-gray-500 mt-1">{hint}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Farm override range */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-gray-600">ขอบเขตที่ฟาร์มปรับได้</h2>
          <Info size={15} className="text-gray-500" />
        </div>
        <p className="text-sm text-gray-600">ฟาร์มสามารถตั้งค่าขนส่งของตนเองได้ในช่วงนี้ (แทนค่าพื้นฐาน)</p>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ต่ำสุดที่ฟาร์มตั้งได้ (฿)</label>
            <input type="number" min={0} step={1} value={minBaseRate}
              onChange={(e) => set('minBaseRate', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">สูงสุดที่ฟาร์มตั้งได้ (฿)</label>
            <input type="number" min={0} step={1} value={maxBaseRate}
              onChange={(e) => set('maxBaseRate', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-green-700 text-sm">ตัวอย่างการคำนวณ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div className="bg-white rounded-lg p-3 border border-green-100">
            <p className="text-gray-600 mb-1">น้ำหนัก 5 kg · ยอด ฿300</p>
            <p className="font-bold text-green-700">ค่าส่ง ฿{calcExample(5, 300)}</p>
            <p className="text-gray-500 mt-0.5">฿{baseRate} + ฿{perKgRate}×{Math.ceil(Math.max(0, 5 - weightLimitKg))}kg เกิน</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-100">
            <p className="text-gray-600 mb-1">น้ำหนัก {weightLimitKg} kg · ยอด ฿300</p>
            <p className="font-bold text-green-700">ค่าส่ง ฿{calcExample(weightLimitKg, 300)}</p>
            <p className="text-gray-500 mt-0.5">ไม่เกิน limit — จ่ายแค่ base</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-green-100">
            <p className="text-gray-600 mb-1">ยอด ฿{freeThreshold}+</p>
            <p className="font-bold text-green-700">ค่าส่ง ฿0</p>
            <p className="text-gray-500 mt-0.5">ฟรีค่าส่ง</p>
          </div>
        </div>
      </div>

      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50"
      >
        {mutation.isPending ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
      </button>
    </div>
  )
}
