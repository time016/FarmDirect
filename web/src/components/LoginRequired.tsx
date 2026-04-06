'use client'
import { LogIn } from 'lucide-react'
import { useAuthModalStore } from '@/store/authModalStore'

interface Props {
  title?: string
  description?: string
}

export default function LoginRequired({
  title = 'กรุณาเข้าสู่ระบบ',
  description = 'คุณต้องเข้าสู่ระบบก่อนเพื่อใช้งานส่วนนี้',
}: Props) {
  const { openLogin } = useAuthModalStore()
  return (
    <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
      <div className="bg-green-50 rounded-full p-5 mb-5">
        <LogIn size={36} className="text-green-600" />
      </div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">{title}</h2>
      <p className="text-gray-500 mb-6 max-w-xs">{description}</p>
      <button
        onClick={openLogin}
        className="bg-green-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-green-700 transition"
      >
        เข้าสู่ระบบ
      </button>
    </div>
  )
}
