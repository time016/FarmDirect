'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Leaf, Shield, Truck } from 'lucide-react'
import { useAuthModalStore } from '@/store/authModalStore'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'

export default function Footer() {
  const { openRegister } = useAuthModalStore()
  const { user, isAuthenticated, setUser } = useAuthStore()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSellerClick = () => {
    if (!isAuthenticated) { openRegister('SELLER'); return }
    if (user?.role === 'SELLER' || (user?.role === 'ADMIN' || user?.role === 'HOST')) { router.push('/seller/dashboard'); return }
    // BUYER — show confirm
    setConfirm(true)
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const { data } = await api.post('/users/become-seller')
      setUser(data)
      setConfirm(false)
      toast.success('เปลี่ยนเป็นผู้ขายแล้ว สามารถสร้างฟาร์มได้เลย')
      router.push('/seller/dashboard')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <footer className="max-w-7xl mx-auto px-4 pb-10 space-y-6 mt-12">
      <section className="bg-gradient-to-r from-green-700 to-green-500 text-white rounded-2xl p-10 text-center">
        <h2 className="text-4xl font-bold mb-3">สินค้าเกษตรจากฟาร์มสู่มือคุณ</h2>
        <p className="text-green-100 text-lg mb-6">สด ปลอดภัย คุณภาพดี ตรงจากเกษตรกร ไม่ผ่านพ่อค้าคนกลาง</p>

        {!confirm ? (
          <div className="flex justify-center gap-4">
            <Link href="/products" className="bg-white text-green-700 px-6 py-2.5 rounded-full font-semibold hover:bg-green-50 transition">
              เลือกซื้อสินค้า
            </Link>
            <button onClick={handleSellerClick} className="border border-white px-6 py-2.5 rounded-full hover:bg-white/10 transition">
              สมัครเป็นผู้ขาย
            </button>
          </div>
        ) : (
          <div className="inline-block bg-white/10 border border-white/30 rounded-2xl px-6 py-4 space-y-3 text-left max-w-sm mx-auto">
            <p className="font-semibold text-white">ยืนยันเปลี่ยนบทบาทเป็นผู้ขาย?</p>
            <p className="text-green-100 text-sm">คุณจะสามารถสร้างฟาร์มและลงขายสินค้าได้ทันที</p>
            <div className="flex gap-3">
              <button onClick={handleConfirm} disabled={loading}
                className="bg-white text-green-700 px-5 py-2 rounded-full font-semibold text-sm hover:bg-green-50 transition disabled:opacity-50">
                {loading ? 'กำลังเปลี่ยน...' : 'ยืนยัน'}
              </button>
              <button onClick={() => setConfirm(false)} className="border border-white/60 px-5 py-2 rounded-full text-sm hover:bg-white/10 transition">
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { icon: <Leaf className="text-green-600" size={28} />, title: 'สินค้าคุณภาพดี', desc: 'คัดสรรจากเกษตรกรที่ผ่านการรับรอง' },
          { icon: <Shield className="text-green-600" size={28} />, title: 'ปลอดภัยน่าเชื่อถือ', desc: 'ตรวจสอบได้ว่าสินค้ามาจากฟาร์มไหน' },
          { icon: <Truck className="text-green-600" size={28} />, title: 'จัดส่งรวดเร็ว', desc: 'ผ่านระบบขนส่งชั้นนำทั่วประเทศ' },
        ].map((f, i) => (
          <div key={i} className="bg-white rounded-xl p-6 shadow-sm text-center border border-gray-100">
            <div className="flex justify-center mb-3">{f.icon}</div>
            <h3 className="font-semibold text-gray-600">{f.title}</h3>
            <p className="text-gray-600 text-sm mt-1">{f.desc}</p>
          </div>
        ))}
      </section>
    </footer>
  )
}
