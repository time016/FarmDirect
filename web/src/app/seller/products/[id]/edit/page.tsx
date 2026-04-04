'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Category } from '@/types'
import toast from 'react-hot-toast'
import ImageManager from '@/components/ImageManager'
import VideoManager from '@/components/VideoManager'
import { Info } from 'lucide-react'

const units = ['กิโลกรัม','กรัม','ชิ้น','กล่อง','มัด','ลิตร','แพ็ค','หวี','ลูก']

export default function EditProductPage() {
  const { id } = useParams()
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', description: '', price: '', unit: '', stock: '', categoryId: '', weightKg: '0.5', images: [''], videos: [] as string[], isActive: true })
  const [loaded, setLoaded] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const nameInvalid = submitted && !form.name.trim()
  const priceInvalid = submitted && (form.price === '' || Number(form.price) <= 0)
  const stockInvalid = submitted && (form.stock === '' || Number(form.stock) < 0)

  const fieldCls = (invalid: boolean) =>
    `w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 transition ${invalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`

  useEffect(() => {
    if (!isAuthenticated) router.push('/')
  }, [isAuthenticated])

  const { data: product } = useQuery({
    queryKey: ['product', id],
    queryFn: () => api.get(`/products/${id}`).then((r) => r.data),
    enabled: !!id,
  })

  useEffect(() => {
    if (product && !loaded) {
      setForm({
        name: product.name,
        description: product.description || '',
        price: String(product.price),
        unit: product.unit,
        stock: String(product.stock),
        categoryId: product.categoryId,
        weightKg: String(product.weightKg ?? 0.5),
        images: product.images?.length ? product.images : [''],
        videos: Array.isArray(product.videos) ? product.videos : [],
        isActive: product.isActive,
      })
      setLoaded(true)
    }
  }, [product])

  const { data: pricing } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: () => api.get('/products/pricing-config').then((r) => r.data),
  })

  const priceBreakdown = useMemo(() => {
    const base = Number(form.price) || 0
    if (!pricing || base === 0) return null
    const vat = pricing.vatEnabled ? Math.round(base * pricing.vatRate * 100) / 100 : 0
    const commission = Math.round(base * pricing.commissionRate * 100) / 100
    const markup = pricing.pricingModel === 'B' ? commission : 0
    const customerPays = Math.round((base + markup + vat) * 100) / 100
    const farmReceives = pricing.pricingModel === 'A'
      ? Math.round((base - commission) * 100) / 100
      : base
    return { commission, vat, customerPays, farmReceives }
  }, [form.price, pricing])

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  })

  const updateProduct = useMutation({
    mutationFn: () => api.put(`/products/${id}`, {
      ...form,
      price: Number(form.price),
      stock: Number(form.stock),
      weightKg: Number(form.weightKg) || 0.5,
      images: form.images.filter((img) => img.trim()),
      videos: form.videos,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['product', id] })
      qc.invalidateQueries({ queryKey: ['farm'] })
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      toast.success('อัปเดตสินค้าแล้ว')
      router.back()
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  if (!product) return <div className="animate-pulse bg-gray-100 h-64 rounded-xl" />

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-600 mb-6">แก้ไขสินค้า</h1>
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">ชื่อสินค้า</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldCls(nameInvalid)} />
            {nameInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกชื่อสินค้า</p>}
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">หมวดหมู่</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500">
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">ราคา (บาท)</label>
              <input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={fieldCls(priceInvalid)} />
              {priceInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกราคาที่มากกว่า 0</p>}
            </div>
            <div>
              <label className="text-sm text-gray-600 mb-1 block">หน่วย</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500">
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          {/* Weight per unit (hidden for kg/gram units) */}
          {!['กิโลกรัม', 'กรัม'].includes(form.unit) && (
            <div>
              <label className="text-sm text-gray-600 mb-1 block">น้ำหนักต่อหน่วย (kg) — ใช้คำนวณค่าส่ง</label>
              <input type="number" min="0" step="0.1" value={form.weightKg}
                onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          )}

          {/* Pricing breakdown */}
          {priceBreakdown && pricing && (
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 mb-2">
                <Info size={13} className="text-gray-500" />
                โครงสร้างราคา (Option {pricing.pricingModel} · Commission {Math.round(pricing.commissionRate * 100)}%{pricing.vatEnabled ? ` · VAT ${Math.round(pricing.vatRate * 100)}%` : ''})
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">ราคาที่คุณตั้ง</span>
                <span className="font-semibold text-gray-700">฿{Number(form.price).toLocaleString()}</span>
              </div>
              {pricing.pricingModel === 'A' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">หัก Commission ({Math.round(pricing.commissionRate * 100)}%)</span>
                  <span className="font-semibold text-red-500">−฿{priceBreakdown.commission.toLocaleString()}</span>
                </div>
              )}
              {pricing.pricingModel === 'B' && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Commission ({Math.round(pricing.commissionRate * 100)}%) — บวกจากลูกค้า</span>
                  <span className="font-semibold text-blue-500">+฿{priceBreakdown.commission.toLocaleString()}</span>
                </div>
              )}
              {pricing.vatEnabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT {Math.round(pricing.vatRate * 100)}% — บวกจากลูกค้า</span>
                  <span className="font-semibold text-orange-500">+฿{priceBreakdown.vat.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold">
                <span className="text-gray-700">ลูกค้าจ่าย</span>
                <span className="text-gray-900">฿{priceBreakdown.customerPays.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold">
                <span className="text-gray-700">คุณได้รับ</span>
                <span className="text-green-700">฿{priceBreakdown.farmReceives.toLocaleString()}</span>
              </div>
            </div>
          )}
          <div>
            <label className="text-sm text-gray-600 mb-1 block">สต็อก</label>
            <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
              className={fieldCls(stockInvalid)} />
            {stockInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกจำนวนสต็อก</p>}
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-1 block">คำอธิบาย</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-2 block">รูปภาพสินค้า</label>
            <ImageManager
              images={form.images.filter(Boolean)}
              onChange={(imgs) => setForm({ ...form, images: imgs })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-600 mb-2 block">วิดีโอแนะนำสินค้า <span className="text-gray-500 font-normal">(YouTube / Facebook / TikTok)</span></label>
            <VideoManager videos={form.videos} onChange={(v) => setForm({ ...form, videos: v })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            <label htmlFor="isActive" className="text-sm text-gray-600">เปิดขายสินค้า</label>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => {
              setSubmitted(true)
              if (!form.name.trim() || form.price === '' || Number(form.price) <= 0 || form.stock === '' || Number(form.stock) < 0) return
              updateProduct.mutate()
            }} disabled={updateProduct.isPending}
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
              {updateProduct.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button onClick={() => router.back()} className="btn-cancel">
              ยกเลิก
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
