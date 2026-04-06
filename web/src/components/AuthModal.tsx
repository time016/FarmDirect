'use client'
import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuthModalStore } from '@/store/authModalStore'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phoneRegex = /^0[0-9]{8,9}$/

function inputCls(invalid: boolean) {
  return `w-full border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${invalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`
}

import { API_BASE_URL } from '@/lib/api'

function useOAuthLogin(onClose: () => void) {
  const { loginWithToken } = useAuthStore()

  return (provider: 'google' | 'line') => {
    const w = 520, h = 620
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2)
    const popup = window.open(`${API_BASE_URL}/auth/${provider}`, 'oauth', `width=${w},height=${h},left=${left},top=${top}`)

    let done = false
    const cleanup = () => {
      window.removeEventListener('message', handler)
      clearInterval(pollClosed)
    }

    const handler = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'oauth_callback') return
      done = true
      cleanup()
      if (e.data.error) {
        toast.error(e.data.error === 'email_exists'
          ? 'อีเมลนี้มีบัญชีอยู่แล้ว กรุณาเข้าสู่ระบบด้วยอีเมล/รหัสผ่าน'
          : 'เข้าสู่ระบบไม่สำเร็จ')
        return
      }
      if (e.data.token) {
        try {
          await loginWithToken(e.data.token)
          toast.success('เข้าสู่ระบบสำเร็จ')
          onClose()
        } catch { toast.error('เกิดข้อผิดพลาด') }
      }
    }

    // Clean up if user closes popup without completing login
    const pollClosed = setInterval(() => {
      if (!done && popup?.closed) cleanup()
    }, 500)

    window.addEventListener('message', handler)
  }
}

function OAuthButtons({ onClose }: { onClose: () => void }) {
  const handleOAuth = useOAuthLogin(onClose)
  return (
    <div className="space-y-2 mt-4">
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-sm text-gray-500">หรือเข้าสู่ระบบด้วย</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>
      <button onClick={() => handleOAuth('google')}
        className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 transition">
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Google
      </button>
      <button onClick={() => handleOAuth('line')}
        className="w-full flex items-center justify-center gap-3 rounded-lg py-2.5 text-sm font-medium text-white transition"
        style={{ backgroundColor: '#06C755' }}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.070 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
        </svg>
        LINE
      </button>
    </div>
  )
}

function LoginForm({ onSwitch, onClose }: { onSwitch: () => void; onClose: () => void }) {
  const { login } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Forgot password state
  const [fpStep, setFpStep] = useState<'login' | 'email' | 'code' | 'newpass'>('login')
  const [fpEmail, setFpEmail] = useState('')
  const [fpCode, setFpCode] = useState('')
  const [fpPass, setFpPass] = useState('')
  const [fpPassConfirm, setFpPassConfirm] = useState('')
  const [fpLoading, setFpLoading] = useState(false)
  const [fpSubmitted, setFpSubmitted] = useState(false)

  const emailInvalid = submitted && !emailRegex.test(form.email)
  const passwordInvalid = submitted && !form.password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (!emailRegex.test(form.email) || !form.password) return
    setLoading(true)
    try {
      await login(form.email, form.password)
      toast.success('เข้าสู่ระบบสำเร็จ')
      onClose()
    } catch {
      toast.error('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  const handleFpSendCode = async () => {
    setFpSubmitted(true)
    if (!emailRegex.test(fpEmail)) return
    setFpLoading(true)
    try {
      await import('@/lib/api').then(m => m.default.post('/auth/forgot-password', { email: fpEmail }))
      toast.success('ส่งรหัสไปที่อีเมลแล้ว')
      setFpStep('code')
      setFpSubmitted(false)
    } catch { toast.error('เกิดข้อผิดพลาด') }
    finally { setFpLoading(false) }
  }

  const handleFpVerifyCode = async () => {
    setFpSubmitted(true)
    if (fpCode.length < 6) return
    setFpLoading(true)
    try {
      await import('@/lib/api').then(m => m.default.post('/auth/verify-reset-code', { email: fpEmail, code: fpCode }))
      setFpStep('newpass')
      setFpSubmitted(false)
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'รหัสไม่ถูกต้อง')
    } finally { setFpLoading(false) }
  }

  const handleFpReset = async () => {
    setFpSubmitted(true)
    if (fpPass.length < 6 || fpPass !== fpPassConfirm) return
    setFpLoading(true)
    try {
      await import('@/lib/api').then(m => m.default.post('/auth/reset-password', { email: fpEmail, code: fpCode, password: fpPass }))
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่')
      setFpStep('login')
      setFpEmail(''); setFpCode(''); setFpPass(''); setFpPassConfirm('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'รหัสไม่ถูกต้อง')
    } finally { setFpLoading(false) }
  }

  // Forgot password views
  if (fpStep === 'email') return (
    <>
      <button onClick={() => { setFpStep('login'); setFpSubmitted(false) }} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← กลับ</button>
      <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">ลืมรหัสผ่าน</h2>
      <p className="text-sm text-gray-600 text-center mb-5">กรอกอีเมลที่ใช้สมัคร เราจะส่งรหัสยืนยันให้</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-700 mb-1 block">อีเมล</label>
          <input type="text" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)} placeholder="example@email.com"
            className={inputCls(fpSubmitted && !emailRegex.test(fpEmail))} />
          {fpSubmitted && !emailRegex.test(fpEmail) && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกอีเมลที่ถูกต้อง</p>}
        </div>
        <button onClick={handleFpSendCode} disabled={fpLoading}
          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
          {fpLoading ? 'กำลังส่ง...' : 'ส่งรหัสยืนยัน'}
        </button>
      </div>
    </>
  )

  if (fpStep === 'code') return (
    <>
      <button onClick={() => { setFpStep('email'); setFpSubmitted(false) }} className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1">← กลับ</button>
      <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">กรอกรหัสยืนยัน</h2>
      <p className="text-sm text-gray-600 text-center mb-5">รหัส 6 หลักที่ส่งไปที่ <span className="font-medium text-gray-800">{fpEmail}</span></p>
      <div className="space-y-4">
        <input type="text" inputMode="numeric" maxLength={6} value={fpCode}
          onChange={(e) => setFpCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className={`w-full border rounded-lg px-4 py-3 text-2xl font-mono tracking-widest text-center focus:outline-none focus:ring-2 transition ${fpSubmitted && fpCode.length < 6 ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`} />
        {fpSubmitted && fpCode.length < 6 && <p className="text-red-500 text-sm">กรุณากรอกรหัส 6 หลัก</p>}
        <button onClick={handleFpVerifyCode} disabled={fpCode.length < 6 || fpLoading}
          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
          {fpLoading ? 'กำลังตรวจสอบ...' : 'ยืนยันรหัส'}
        </button>
        <button onClick={handleFpSendCode} disabled={fpLoading} className="w-full text-sm text-gray-600 hover:underline disabled:opacity-50">
          {fpLoading ? 'กำลังส่งใหม่...' : 'ส่งรหัสใหม่อีกครั้ง'}
        </button>
      </div>
    </>
  )

  if (fpStep === 'newpass') return (
    <>
      <h2 className="text-xl font-bold text-gray-800 mb-2 text-center">ตั้งรหัสผ่านใหม่</h2>
      <p className="text-sm text-gray-600 text-center mb-5">รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร</p>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-gray-700 mb-1 block">รหัสผ่านใหม่</label>
          <input type="password" value={fpPass} onChange={(e) => setFpPass(e.target.value)} placeholder="••••••••"
            className={inputCls(fpSubmitted && fpPass.length < 6)} />
          {fpSubmitted && fpPass.length < 6 && <p className="text-red-500 text-sm mt-0.5">รหัสผ่านต้องมีอย่างน้อย 6 ตัว</p>}
        </div>
        <div>
          <label className="text-sm text-gray-700 mb-1 block">ยืนยันรหัสผ่านใหม่</label>
          <input type="password" value={fpPassConfirm} onChange={(e) => setFpPassConfirm(e.target.value)} placeholder="••••••••"
            className={inputCls(fpSubmitted && fpPassConfirm !== fpPass)} />
          {fpSubmitted && fpPassConfirm !== fpPass && <p className="text-red-500 text-sm mt-0.5">รหัสผ่านไม่ตรงกัน</p>}
        </div>
        <button onClick={handleFpReset} disabled={fpLoading}
          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
          {fpLoading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
        </button>
      </div>
    </>
  )

  return (
    <>
      <h2 className="text-xl font-bold text-gray-800 mb-5 text-center">เข้าสู่ระบบ</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-700 mb-1 block">อีเมล</label>
          <input type="text" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="example@email.com"
            className={inputCls(emailInvalid)} />
          {emailInvalid && <p className="text-red-500 text-sm mt-0.5">{!form.email ? 'กรุณากรอกอีเมล' : 'รูปแบบอีเมลไม่ถูกต้อง'}</p>}
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm text-gray-700">รหัสผ่าน</label>
            <button type="button" onClick={() => { setFpEmail(form.email); setFpStep('email') }}
              className="text-sm text-green-600 hover:underline">
              ลืมรหัสผ่าน?
            </button>
          </div>
          <input type="password" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
            className={inputCls(passwordInvalid)} />
          {passwordInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกรหัสผ่าน</p>}
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
      <OAuthButtons onClose={onClose} />
      <p className="text-center text-sm text-gray-600 mt-4">
        ยังไม่มีบัญชี?{' '}
        <button onClick={onSwitch} className="text-green-600 hover:underline font-medium">สมัครสมาชิก</button>
      </p>
    </>
  )
}

function RegisterForm({ onSwitch, onClose, initialRole }: { onSwitch: () => void; onClose: () => void; initialRole: 'BUYER' | 'SELLER' }) {
  const { register } = useAuthStore()
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', name: '', phone: '', role: initialRole })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const nameInvalid = submitted && !form.name.trim()
  const emailInvalid = submitted && !emailRegex.test(form.email)
  const phoneInvalid = submitted && !!form.phone && !phoneRegex.test(form.phone.replace(/[-\s]/g, ''))
  const passwordInvalid = submitted && form.password.length < 6
  const confirmInvalid = submitted && form.confirmPassword !== form.password

  const hasErrors = () =>
    !form.name.trim() ||
    !emailRegex.test(form.email) ||
    (!!form.phone && !phoneRegex.test(form.phone.replace(/[-\s]/g, ''))) ||
    form.password.length < 6 ||
    form.confirmPassword !== form.password

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    if (hasErrors()) return
    setLoading(true)
    try {
      const { confirmPassword, ...payload } = form
      await register(payload)
      toast.success('สมัครสมาชิกสำเร็จ')
      onClose()
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h2 className="text-xl font-bold text-gray-800 mb-5 text-center">สมัครสมาชิก</h2>

      <div className="flex bg-gray-100 rounded-lg p-1 mb-4">
        {(['BUYER', 'SELLER'] as const).map((r) => (
          <button key={r} type="button" onClick={() => setForm({ ...form, role: r })}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition ${form.role === r ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600'}`}>
            {r === 'BUYER' ? '🛒 ผู้ซื้อ' : '🌾 ผู้ขาย/เกษตรกร'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-sm text-gray-700 mb-1 block">ชื่อ-นามสกุล</label>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="ชื่อของคุณ" className={inputCls(nameInvalid)} />
          {nameInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกชื่อ-นามสกุล</p>}
        </div>
        <div>
          <label className="text-sm text-gray-700 mb-1 block">อีเมล</label>
          <input type="text" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="example@email.com" className={inputCls(emailInvalid)} />
          {emailInvalid && <p className="text-red-500 text-sm mt-0.5">{!form.email ? 'กรุณากรอกอีเมล' : 'รูปแบบอีเมลไม่ถูกต้อง'}</p>}
        </div>
        <div>
          <label className="text-sm text-gray-700 mb-1 block">เบอร์โทรศัพท์ <span className="text-gray-500">(ไม่บังคับ)</span></label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="08x-xxx-xxxx" className={inputCls(phoneInvalid)} />
          {phoneInvalid && <p className="text-red-500 text-sm mt-0.5">รูปแบบเบอร์โทรไม่ถูกต้อง (ตัวอย่าง: 0812345678)</p>}
        </div>
        <div>
          <label className="text-sm text-gray-700 mb-1 block">รหัสผ่าน <span className="text-gray-500">(อย่างน้อย 6 ตัว)</span></label>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••" className={inputCls(passwordInvalid)} />
          {passwordInvalid && <p className="text-red-500 text-sm mt-0.5">{!form.password ? 'กรุณากรอกรหัสผ่าน' : 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'}</p>}
        </div>
        <div>
          <label className="text-sm text-gray-700 mb-1 block">ยืนยันรหัสผ่าน</label>
          <input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
            placeholder="••••••••" className={inputCls(confirmInvalid || (!!form.confirmPassword && form.password !== form.confirmPassword))} />
          {(confirmInvalid || (!!form.confirmPassword && form.password !== form.confirmPassword)) && (
            <p className="text-red-500 text-sm mt-0.5">รหัสผ่านไม่ตรงกัน</p>
          )}
        </div>
        <button type="submit" disabled={loading}
          className="w-full bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50">
          {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
        </button>
      </form>
      <OAuthButtons onClose={onClose} />
      <p className="text-center text-sm text-gray-600 mt-4">
        มีบัญชีแล้ว?{' '}
        <button onClick={onSwitch} className="text-green-600 hover:underline font-medium">เข้าสู่ระบบ</button>
      </p>
    </>
  )
}

export default function AuthModal() {
  const { isOpen, mode, initialRole, openLogin, openRegister, close } = useAuthModalStore()

  // Listen for 401 events from api.ts
  useEffect(() => {
    const handler = () => openLogin()
    window.addEventListener('auth:required', handler)
    return () => window.removeEventListener('auth:required', handler)
  }, [openLogin])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    if (isOpen) window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, close])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 z-10 max-h-[90vh] overflow-y-auto">
        <button onClick={close}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition">
          <X size={20} />
        </button>

        {mode === 'login'
          ? <LoginForm onSwitch={() => openRegister()} onClose={close} />
          : <RegisterForm onSwitch={openLogin} onClose={close} initialRole={initialRole} />
        }
      </div>
    </div>
  )
}
