'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Truck, CheckCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Mode = 'platform' | 'custom'

interface FieldState { mode: Mode; value: string }

function useFieldState(farmValue: number | null | undefined, platformValue: number): FieldState & { setMode: (m: Mode) => void; setValue: (v: string) => void } {
  const [mode, setMode] = useState<Mode>('platform')
  const [value, setValue] = useState('')
  useEffect(() => {
    if (farmValue != null) { setMode('custom'); setValue(String(farmValue)) }
    else { setMode('platform'); setValue(String(platformValue)) }
  }, [farmValue, platformValue])
  return { mode, value, setMode, setValue }
}

function FieldRow({
  label, unit, description, platformValue,
  state, min, max, step = 1, readOnly = false,
}: {
  label: string; unit: string; description?: string; platformValue: number
  state: ReturnType<typeof useFieldState>; min: number; max: number; step?: number; readOnly?: boolean
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="flex gap-2">
        <button
          onClick={() => !readOnly && state.setMode('platform')}
          disabled={readOnly}
          className={`flex-1 py-2 rounded-lg border text-sm transition ${state.mode === 'platform' ? 'border-green-500 bg-green-50 text-green-700 font-medium' : 'border-gray-200 text-gray-600'} ${readOnly ? 'cursor-default' : 'hover:border-gray-300'}`}
        >
          Platform ({unit}{platformValue})
        </button>
        <button
          onClick={() => !readOnly && state.setMode('custom')}
          disabled={readOnly}
          className={`flex-1 py-2 rounded-lg border text-sm transition ${state.mode === 'custom' ? 'border-green-500 bg-green-50 text-green-700 font-medium' : 'border-gray-200 text-gray-600'} ${readOnly ? 'cursor-default' : 'hover:border-gray-300'}`}
        >
          กำหนดเอง
        </button>
      </div>
      {state.mode === 'custom' && (
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden w-48">
          <span className="px-3 py-2 text-sm text-gray-600 bg-gray-50 border-r border-gray-300">{unit}</span>
          <input
            type="number" min={min} max={max} step={step}
            value={state.value}
            readOnly={readOnly}
            onChange={(e) => !readOnly && state.setValue(e.target.value)}
            className={`flex-1 px-3 py-2 text-sm focus:outline-none ${readOnly ? 'bg-gray-50 text-gray-600 cursor-default' : ''}`}
          />
        </div>
      )}
      {description && <p className="text-sm text-gray-500">{description}</p>}
    </div>
  )
}

export default function SellerShippingPage() {
  const { user, isAuthenticated } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const isOwner = user?.role === 'SELLER' || user?.role === 'ADMIN'

  useEffect(() => {
    if (!isAuthenticated) router.push('/')
  }, [isAuthenticated, user])

  const { data: farm } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const { data: config } = useQuery({
    queryKey: ['shipping-config'],
    queryFn: () => api.get('/farms/shipping-config').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const baseRate = useFieldState(farm?.shippingRate, config?.baseRate ?? 40)
  const weightLimit = useFieldState(farm?.shippingWeightLimitKg, config?.weightLimitKg ?? 3)
  const perKg = useFieldState(farm?.shippingPerKgRate, config?.perKgRate ?? 15)
  const freeThresh = useFieldState(farm?.shippingFreeThreshold, config?.freeThreshold ?? 500)

  const save = useMutation({
    mutationFn: () => api.put('/farms/shipping', {
      shippingRate: baseRate.mode === 'platform' ? null : Number(baseRate.value),
      shippingWeightLimitKg: weightLimit.mode === 'platform' ? null : Number(weightLimit.value),
      shippingPerKgRate: perKg.mode === 'platform' ? null : Number(perKg.value),
      shippingFreeThreshold: freeThresh.mode === 'platform' ? null : Number(freeThresh.value),
    }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      qc.invalidateQueries({ queryKey: ['shipping-config'] })
      toast.success('บันทึกค่าขนส่งแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  if (!config) return <div className="animate-pulse bg-gray-100 h-64 rounded-xl" />

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Truck size={20} className="text-green-600" />
        <h1 className="text-2xl font-bold text-gray-600">ตั้งค่าขนส่ง</h1>
      </div>

      {/* Platform reference */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 space-y-1">
        <p className="font-semibold text-blue-800 mb-2">ค่า Platform (ค่าเริ่มต้น)</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
          <span>ค่าส่งพื้นฐาน</span><span className="font-medium">฿{config.baseRate}</span>
          <span>น้ำหนักฟรี</span><span className="font-medium">{config.weightLimitKg} kg</span>
          <span>ค่าน้ำหนักเกิน</span><span className="font-medium">฿{config.perKgRate}/kg</span>
          <span>ส่งฟรีเมื่อยอดถึง</span><span className="font-medium">฿{config.freeThreshold}</span>
        </div>
      </div>

      {/* Settings */}
      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          คุณมีสิทธิ์ดูข้อมูลเท่านั้น เฉพาะเจ้าของฟาร์มสามารถแก้ไขค่าขนส่งได้
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-5">
        <FieldRow
          label="ค่าส่งพื้นฐาน" unit="฿" platformValue={config.baseRate}
          description={`ช่วงที่อนุญาต: ฿${config.minBaseRate}–฿${config.maxBaseRate}`}
          state={baseRate} min={config.minBaseRate} max={config.maxBaseRate} readOnly={!isOwner}
        />
        <div className="border-t border-gray-100" />
        <FieldRow
          label="น้ำหนักฟรี" unit="" platformValue={config.weightLimitKg}
          description="สินค้าน้ำหนักไม่เกินนี้ ไม่คิดค่าเพิ่ม"
          state={weightLimit} min={0} max={100} step={0.5} readOnly={!isOwner}
        />
        <div className="border-t border-gray-100" />
        <FieldRow
          label="ค่าน้ำหนักเกิน" unit="฿" platformValue={config.perKgRate}
          description="ราคาต่อ kg ที่เกินจากน้ำหนักฟรี"
          state={perKg} min={0} max={200} readOnly={!isOwner}
        />
        <div className="border-t border-gray-100" />
        <FieldRow
          label="ส่งฟรีเมื่อยอดถึง" unit="฿" platformValue={config.freeThreshold}
          description="ยอดสั่งซื้อต่อฟาร์มที่จะได้รับการจัดส่งฟรี"
          state={freeThresh} min={0} max={100000} step={50} readOnly={!isOwner}
        />

        {isOwner && (
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-40"
          >
            {save.isPending
              ? <><Loader2 size={15} className="animate-spin" /> กำลังบันทึก...</>
              : <><CheckCircle size={15} /> บันทึกการตั้งค่า</>}
          </button>
        )}
      </div>
    </div>
  )
}
