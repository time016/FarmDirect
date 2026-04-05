'use client'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface SubdistrictOption { name_th: string; postal_code: number }
interface DistrictOption { name_th: string; subdistricts: SubdistrictOption[] }
interface ProvinceOption { name_th: string; districts: DistrictOption[] }

export default function CreateFarmClient({ provinces }: { provinces: ProvinceOption[] }) {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const [form, setForm] = useState({ name: '', description: '', location: '', province: '', district: '', subdistrict: '', zipCode: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isAuthenticated || (user?.role !== 'SELLER' && user?.role !== 'ADMIN' && user?.role !== 'HOST')) router.push('/')
  }, [isAuthenticated, user])

  const selectedProvince = useMemo(() => provinces.find((p) => p.name_th === form.province) ?? null, [form.province, provinces])
  const selectedDistrict = useMemo(() => selectedProvince?.districts.find((d) => d.name_th === form.district) ?? null, [selectedProvince, form.district])

  const handleProvinceChange = (value: string) => setForm((f) => ({ ...f, province: value, district: '', subdistrict: '', zipCode: '' }))
  const handleDistrictChange = (value: string) => setForm((f) => ({ ...f, district: value, subdistrict: '', zipCode: '' }))
  const handleSubdistrictChange = (value: string) => {
    const sub = selectedDistrict?.subdistricts.find((s) => s.name_th === value)
    setForm((f) => ({ ...f, subdistrict: value, zipCode: sub?.postal_code ? String(sub.postal_code) : '' }))
  }

  const nameInvalid = submitted && !form.name.trim()
  const locationInvalid = submitted && !form.location.trim()
  const provinceInvalid = submitted && !form.province
  const districtInvalid = submitted && !form.district
  const subdistrictInvalid = submitted && !form.subdistrict

  const fieldCls = (invalid: boolean) =>
    `w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition bg-white ${invalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!form.name.trim() || !form.location.trim() || !form.province || !form.district || !form.subdistrict) return
    setLoading(true)
    try {
      await api.post('/farms', form)
      toast.success('สร้างฟาร์มสำเร็จ!')
      router.push('/seller/dashboard')
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-600 mb-6">สร้างฟาร์มของคุณ</h1>
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">ชื่อฟาร์ม</label>
            <input value={form.name} placeholder="เช่น ฟาร์มสุขใจ"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldCls(nameInvalid)} />
            {nameInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกชื่อฟาร์ม</p>}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">ที่ตั้ง (เลขที่ / หมู่บ้าน)</label>
            <input value={form.location} placeholder="เช่น 123 หมู่ 5"
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className={fieldCls(locationInvalid)} />
            {locationInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกที่ตั้งฟาร์ม</p>}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">จังหวัด</label>
            <select value={form.province} onChange={(e) => handleProvinceChange(e.target.value)} className={fieldCls(provinceInvalid)}>
              <option value="">เลือกจังหวัด</option>
              {provinces.map((p) => <option key={p.name_th} value={p.name_th}>{p.name_th}</option>)}
            </select>
            {provinceInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณาเลือกจังหวัด</p>}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">อำเภอ / เขต</label>
            <select value={form.district} onChange={(e) => handleDistrictChange(e.target.value)}
              disabled={!selectedProvince} className={fieldCls(districtInvalid)}>
              <option value="">เลือกอำเภอ / เขต</option>
              {selectedProvince?.districts.map((d) => <option key={d.name_th} value={d.name_th}>{d.name_th}</option>)}
            </select>
            {districtInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณาเลือกอำเภอ</p>}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">ตำบล / แขวง</label>
            <select value={form.subdistrict} onChange={(e) => handleSubdistrictChange(e.target.value)}
              disabled={!selectedDistrict} className={fieldCls(subdistrictInvalid)}>
              <option value="">เลือกตำบล / แขวง</option>
              {selectedDistrict?.subdistricts.map((s) => <option key={s.name_th} value={s.name_th}>{s.name_th}</option>)}
            </select>
            {subdistrictInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณาเลือกตำบล</p>}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">รหัสไปรษณีย์</label>
            <input value={form.zipCode} readOnly placeholder="กรอกอัตโนมัติเมื่อเลือกตำบล"
              className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-gray-600" />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">คำอธิบายฟาร์ม</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4} placeholder="เล่าเกี่ยวกับฟาร์มของคุณ..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50">
            {loading ? 'กำลังสร้าง...' : 'สร้างฟาร์ม'}
          </button>
        </form>
      </div>
    </div>
  )
}
