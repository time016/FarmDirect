'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { Suspense } from 'react'

function RegisterForm() {
  const searchParams = useSearchParams()
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '',
    role: (searchParams.get('role') || 'BUYER') as 'BUYER' | 'SELLER',
  })
  const [loading, setLoading] = useState(false)
  const { register } = useAuthStore()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await register(form)
      toast.success('สมัครสมาชิกสำเร็จ')
      router.push('/')
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white rounded-2xl shadow-sm p-8 border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-600 mb-6 text-center">สมัครสมาชิก</h1>

        {/* Role Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          {(['BUYER', 'SELLER'] as const).map((r) => (
            <button
              key={r} type="button"
              onClick={() => setForm({ ...form, role: r })}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition ${form.role === r ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600'}`}
            >
              {r === 'BUYER' ? '🛒 ผู้ซื้อ' : '🌾 ผู้ขาย/เกษตรกร'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'ชื่อ-นามสกุล', key: 'name', type: 'text', placeholder: 'ชื่อของคุณ' },
            { label: 'อีเมล', key: 'email', type: 'email', placeholder: 'example@email.com' },
            { label: 'เบอร์โทรศัพท์', key: 'phone', type: 'tel', placeholder: '08x-xxx-xxxx' },
            { label: 'รหัสผ่าน', key: 'password', type: 'password', placeholder: '••••••••' },
          ].map((f) => (
            <div key={f.key}>
              <label className="text-sm text-gray-600 mb-1 block">{f.label}</label>
              <input
                type={f.type} required={f.key !== 'phone'}
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          ))}
          <button
            type="submit" disabled={loading}
            className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-600 mt-4">
          มีบัญชีแล้ว?{' '}
          <Link href="/auth/login" className="text-green-600 hover:underline">เข้าสู่ระบบ</Link>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>
}
