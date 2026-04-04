'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import { Category } from '@/types'
import toast from 'react-hot-toast'
import ImageManager from '@/components/ImageManager'
import VideoManager from '@/components/VideoManager'

const units = ['กิโลกรัม', 'กรัม', 'ชิ้น', 'กล่อง', 'มัด', 'ลิตร', 'แพ็ค', 'หวี', 'ลูก']

export default function NewProductPage() {
  const { isAuthenticated, user } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', price: '', unit: 'กิโลกรัม', stock: '', categoryId: '', weightKg: '0.5', images: [''], videos: [] as string[] })

  const nameInvalid = submitted && !form.name.trim()
  const categoryInvalid = submitted && !form.categoryId
  const priceInvalid = submitted && (form.price === '' || Number(form.price) <= 0)
  const stockInvalid = submitted && (form.stock === '' || Number(form.stock) < 0)

  const fieldCls = (invalid: boolean) =>
    `w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 transition ${invalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`

  useEffect(() => {
    if (!isAuthenticated) router.push('/')
  }, [isAuthenticated, user])

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => api.get('/categories').then((r) => r.data),
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!form.name.trim() || !form.categoryId || form.price === '' || Number(form.price) <= 0 || form.stock === '' || Number(form.stock) < 0) return
    setLoading(true)
    try {
      await api.post('/products', {
        ...form,
        price: Number(form.price),
        stock: Number(form.stock),
        weightKg: Number(form.weightKg) || 0.5,
        images: form.images.filter((img) => img.trim()),
        videos: form.videos,
      })
      toast.success('เพิ่มสินค้าสำเร็จ!')
      router.push('/seller/products')
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-600 mb-6">เพิ่มสินค้าใหม่</h1>
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 mb-1 block">ชื่อสินค้า</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น มะม่วงน้ำดอกไม้" className={fieldCls(nameInvalid)} />
            {nameInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกชื่อสินค้า</p>}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">หมวดหมู่</label>
            <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className={fieldCls(categoryInvalid)}>
              <option value="">เลือกหมวดหมู่</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {categoryInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณาเลือกหมวดหมู่</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">ราคา (บาท)</label>
              <input type="number" min="0.01" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="0.00" className={fieldCls(priceInvalid)} />
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-1 block">จำนวนสต็อก</label>
              <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })}
                placeholder="0" className={fieldCls(stockInvalid)} />
              {stockInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกจำนวนสต็อก</p>}
            </div>
            {!['กิโลกรัม', 'กรัม'].includes(form.unit) && (
              <div>
                <label className="text-sm text-gray-600 mb-1 block">น้ำหนักต่อหน่วย (kg)</label>
                <input type="number" min="0" step="0.1" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })}
                  placeholder="0.5" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-1 block">คำอธิบาย</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} placeholder="รายละเอียดสินค้า..."
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
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

          <button type="submit" disabled={loading}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50">
            {loading ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}
          </button>
        </form>
      </div>
    </div>
  )
}
