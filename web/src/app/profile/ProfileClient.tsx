'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import Image from 'next/image'

import { Address } from '@/types'
import { Plus, Trash2, Pencil, Camera, Store, Check, X, ShieldCheck, ShieldAlert, Mail, Tractor } from 'lucide-react'
import toast from 'react-hot-toast'
import AvatarCropModal from '@/components/AvatarCropModal'
import LoginRequired from '@/components/LoginRequired'

interface FarmInvitation {
  id: string
  status: string
  createdAt: string
  farm: { id: string; name: string; image?: string; province?: string }
  inviter?: { id: string; name: string; avatar?: string }
}

interface FarmMembership {
  id: string
  status: string
  createdAt: string
  farm: { id: string; name: string; image?: string; province?: string }
}

interface SubdistrictOption { name_th: string; postal_code: number }
interface DistrictOption { name_th: string; subdistricts: SubdistrictOption[] }
interface ProvinceOption { name_th: string; districts: DistrictOption[] }

const emptyAddr = {
  label: 'home',
  recipient: '',
  phone: '',
  address: '',
  province: '',
  district: '',
  subdistrict: '',
  zipCode: '',
  isDefault: false,
}

const requiredKeys = ['recipient', 'phone', 'address', 'province', 'district', 'subdistrict', 'zipCode']

export default function ProfileClient({ provinces }: { provinces: ProvinceOption[] }) {
  const { isAuthenticated, user, setUser } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'profile' | 'addresses' | 'farms'>('profile')
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' })
  const [profileSubmitted, setProfileSubmitted] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [codeSent, setCodeSent] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [showVerify, setShowVerify] = useState(false)

  const profileNameInvalid = profileSubmitted && !form.name.trim()
  const profilePhoneInvalid = profileSubmitted && !!form.phone && !/^0[0-9]{8,9}$/.test(form.phone.replace(/[-\s]/g, ''))
  const [cropFile, setCropFile] = useState<File | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [addrForm, setAddrForm] = useState({ ...emptyAddr })
  const [submitted, setSubmitted] = useState(false)

  if (!isAuthenticated) return <LoginRequired description="คุณต้องเข้าสู่ระบบก่อนเพื่อดูโปรไฟล์" />

  useEffect(() => {
    if (searchParams.get('tab') === 'addresses') {
      setTab('addresses')
      if (searchParams.get('addAddress') === '1') {
        setShowForm(true)
      }
    }
  }, [])

  const { data: addresses } = useQuery<Address[]>({
    queryKey: ['addresses'],
    queryFn: () => api.get('/users/addresses').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const { data: invitations = [] } = useQuery<FarmInvitation[]>({
    queryKey: ['my-invitations'],
    queryFn: () => api.get('/farms/invitations').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const { data: memberships = [] } = useQuery<FarmMembership[]>({
    queryKey: ['my-farm-memberships'],
    queryFn: () => api.get('/farms/memberships').then((r) => r.data),
    enabled: isAuthenticated,
  })

  const acceptInvitation = useMutation({
    mutationFn: (id: string) => api.post(`/farms/invitations/${id}/accept`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invitations'] })
      qc.invalidateQueries({ queryKey: ['my-farm-memberships'] })
      toast.success('ตอบรับคำเชิญแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const declineInvitation = useMutation({
    mutationFn: (id: string) => api.delete(`/farms/invitations/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invitations'] })
      toast.success('ปฏิเสธคำเชิญแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const updateProfile = useMutation({
    mutationFn: () => api.put('/users/profile', form).then((r) => r.data),
    onSuccess: (data) => { setUser(data); toast.success('อัปเดตโปรไฟล์แล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const [confirmSeller, setConfirmSeller] = useState(false)
  const becomeSeller = useMutation({
    mutationFn: () => api.post('/users/become-seller').then((r) => r.data),
    onSuccess: (data) => {
      setUser(data)
      setConfirmSeller(false)
      toast.success('เปลี่ยนเป็นผู้ขายแล้ว สามารถสร้างฟาร์มได้เลย')
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'เกิดข้อผิดพลาด'),
  })

  // Step 1: open file picker → show crop modal
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCropFile(file)
    if (avatarInputRef.current) avatarInputRef.current.value = ''
  }

  // Step 2: after crop confirm → upload blob → save profile
  const handleCropConfirm = async (blob: Blob) => {
    setCropFile(null)
    setAvatarUploading(true)
    try {
      const formData = new FormData()
      formData.append('image', blob, 'avatar.jpg')
      const { data: upload } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
      const updated = await api.put('/users/profile', { name: user?.name, phone: user?.phone, avatar: upload.url }).then((r) => r.data)
      setUser(updated)
      toast.success('เปลี่ยนรูปโปรไฟล์แล้ว')
    } catch {
      toast.error('อัปโหลดล้มเหลว')
    } finally {
      setAvatarUploading(false)
    }
  }

  const createAddress = useMutation({
    mutationFn: () => api.post('/users/addresses', addrForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['addresses'] }); closeForm(); toast.success('เพิ่มที่อยู่แล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const updateAddress = useMutation({
    mutationFn: () => api.put(`/users/addresses/${editId}`, addrForm),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['addresses'] }); closeForm(); toast.success('แก้ไขที่อยู่แล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const deleteAddress = useMutation({
    mutationFn: (id: string) => api.delete(`/users/addresses/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['addresses'] }); toast.success('ลบที่อยู่แล้ว') },
  })

  const closeForm = () => {
    setShowForm(false); setEditId(null); setAddrForm({ ...emptyAddr }); setSubmitted(false)
  }

  const handleEdit = (addr: Address) => {
    setEditId(addr.id)
    setAddrForm({ label: addr.label, recipient: addr.recipient, phone: addr.phone, address: addr.address, province: addr.province, district: addr.district, subdistrict: addr.subdistrict, zipCode: addr.zipCode, isDefault: addr.isDefault })
    setSubmitted(false)
    setShowForm(true)
  }

  const isFormValid = () => requiredKeys.every((k) => String(addrForm[k as keyof typeof emptyAddr]).trim() !== '')
  const fieldInvalid = (key: string) => submitted && requiredKeys.includes(key) && !String(addrForm[key as keyof typeof emptyAddr]).trim()

  const handleSubmit = () => {
    setSubmitted(true)
    if (!isFormValid()) { toast.error('กรุณากรอกข้อมูลให้ครบถ้วน'); return }
    if (editId) updateAddress.mutate()
    else createAddress.mutate()
  }

  const selectedProvince = useMemo(() => provinces.find((p) => p.name_th === addrForm.province) ?? null, [addrForm.province])
  const selectedDistrict = useMemo(() => selectedProvince?.districts.find((d) => d.name_th === addrForm.district) ?? null, [selectedProvince, addrForm.district])

  const handleProvinceChange = (value: string) => {
    setAddrForm((prev) => ({ ...prev, province: value, district: '', subdistrict: '', zipCode: '' }))
  }
  const handleDistrictChange = (value: string) => {
    setAddrForm((prev) => ({ ...prev, district: value, subdistrict: '', zipCode: '' }))
  }
  const handleSubdistrictChange = (value: string) => {
    const sub = selectedDistrict?.subdistricts.find((s) => s.name_th === value)
    setAddrForm((prev) => ({ ...prev, subdistrict: value, zipCode: sub?.postal_code ? String(sub.postal_code) : '' }))
  }

  const selectCls = (invalid: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition bg-white ${invalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`
  const inputCls = (invalid: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition ${invalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`

  const handleSendVerifyCode = async () => {
    setSendingCode(true)
    try {
      await api.post('/auth/send-verify-email')
      setCodeSent(true)
      toast.success('ส่งรหัสยืนยันแล้ว กรุณาตรวจสอบอีเมล')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'เกิดข้อผิดพลาด')
    } finally {
      setSendingCode(false)
    }
  }

  const handleVerifyEmail = async () => {
    if (!verifyCode.trim()) { toast.error('กรุณากรอกรหัสยืนยัน'); return }
    setVerifying(true)
    try {
      const { data } = await api.post('/auth/verify-email', { code: verifyCode })
      setUser(data)
      setCodeSent(false)
      setVerifyCode('')
      toast.success('ยืนยันอีเมลสำเร็จ!')
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'รหัสไม่ถูกต้อง')
    } finally {
      setVerifying(false)
    }
  }

  const isPending = createAddress.isPending || updateAddress.isPending

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-600">โปรไฟล์</h1>

      <div className="flex border-b border-gray-200">
        {(['profile', 'addresses', 'farms'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative px-6 py-3 text-base font-medium border-b-2 transition ${tab === t ? 'border-green-600 text-green-600' : 'border-transparent text-gray-600'}`}>
            {t === 'profile' ? 'ข้อมูลส่วนตัว' : t === 'addresses' ? 'ที่อยู่จัดส่ง' : 'ผู้จัดการฟาร์ม'}
            {t === 'farms' && invitations.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-100">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              <div className="w-24 h-24 rounded-full overflow-hidden bg-green-100 flex items-center justify-center ring-4 ring-green-100">
                {avatarUploading ? (
                  <div className="w-7 h-7 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                ) : user?.avatar ? (
                  <Image src={user.avatar} alt={user.name} fill sizes="200px" className="object-cover" />
                ) : (
                  <span className="text-green-700 text-3xl font-bold">{user?.name?.[0]?.toUpperCase()}</span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <Camera size={22} className="text-white" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="mt-3 text-sm text-green-600 hover:text-green-700 font-medium disabled:opacity-50"
            >
              {avatarUploading ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูปโปรไฟล์'}
            </button>
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarUpload} />
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-base text-gray-600 mb-1.5 block font-medium">อีเมล</label>
              <div className="relative">
                <input value={user?.email ?? ''} disabled
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base bg-gray-50 text-gray-500 pr-12" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2">
                  {user?.emailVerified
                    ? <ShieldCheck size={18} className="text-green-500" />
                    : <ShieldAlert size={18} className="text-amber-500" />}
                </span>
              </div>

              {/* Email not verified banner */}
              {!user?.emailVerified && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={16} className="text-amber-500 flex-shrink-0" />
                      <p className="text-sm text-amber-700">อีเมลของคุณยังไม่ได้รับการยืนยัน</p>
                    </div>
                    <button onClick={() => setShowVerify(v => !v)} className="text-sm text-amber-600 hover:underline">
                      {showVerify ? 'ซ่อน' : 'ยืนยันเลย'}
                    </button>
                  </div>

                  {showVerify && (!codeSent ? (
                    <button onClick={handleSendVerifyCode} disabled={sendingCode}
                      className="flex items-center gap-2 text-sm bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600 transition disabled:opacity-50">
                      <Mail size={14} />
                      {sendingCode ? 'กำลังส่ง...' : 'ส่งรหัสยืนยันทางอีเมล'}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-amber-600">กรอกรหัส 6 หลักที่ส่งไปที่ {user?.email}</p>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full border border-amber-300 rounded-lg px-3 py-2 text-base font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleVerifyEmail} disabled={verifying || verifyCode.length < 6}
                          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">
                          {verifying ? 'กำลังตรวจสอบ...' : 'ยืนยัน'}
                        </button>
                        <button onClick={() => { setCodeSent(false); setVerifyCode('') }}
                          className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                          ยกเลิก
                        </button>
                      </div>
                      <button onClick={handleSendVerifyCode} disabled={sendingCode}
                        className="text-sm text-amber-600 hover:underline disabled:opacity-50">
                        {sendingCode ? 'กำลังส่งใหม่...' : 'ส่งรหัสใหม่อีกครั้ง'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {user?.emailVerified && (
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <ShieldCheck size={12} /> อีเมลได้รับการยืนยันแล้ว
                </p>
              )}
            </div>
            <div>
              <label className="text-base text-gray-600 mb-1.5 block font-medium">ชื่อ-นามสกุล</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={`w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 transition ${profileNameInvalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`} />
              {profileNameInvalid && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกชื่อ-นามสกุล</p>}
            </div>
            <div>
              <label className="text-base text-gray-600 mb-1.5 block font-medium">เบอร์โทรศัพท์</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0812345678"
                className={`w-full border rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 transition ${profilePhoneInvalid ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-gray-300 focus:ring-green-500'}`} />
              {profilePhoneInvalid && <p className="text-red-500 text-sm mt-0.5">รูปแบบเบอร์โทรไม่ถูกต้อง (ตัวอย่าง: 0812345678)</p>}
            </div>
            <div>
              <label className="text-base text-gray-600 mb-1.5 block font-medium">บทบาท</label>
              <input value={user?.role === 'BUYER' ? 'ผู้ซื้อ' : user?.role === 'SELLER' ? 'ผู้ขาย' : user?.role === 'HOST' ? 'เจ้าของระบบ' : user?.role === 'ADMIN' ? 'แอดมิน' : ''} disabled
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-base bg-gray-50 text-gray-500" />

              {user?.role === 'BUYER' && !confirmSeller && (
                <button type="button" onClick={() => setConfirmSeller(true)}
                  className="mt-2 inline-flex items-center gap-2 bg-green-100 text-green-700 hover:bg-green-200 transition px-3 py-1.5 rounded-full text-sm font-semibold">
                  <Tractor size={14} /> สมัครเป็นผู้ขาย / เกษตรกร
                </button>
              )}

              {user?.role === 'BUYER' && confirmSeller && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-4 space-y-3">
                  <p className="text-sm font-semibold text-green-800">ยืนยันการเปลี่ยนบทบาทเป็นผู้ขาย?</p>
                  <p className="text-sm text-green-700">หลังจากเปลี่ยนแล้วคุณจะสามารถสร้างฟาร์มและลงขายสินค้าได้ การเปลี่ยนนี้ไม่สามารถยกเลิกได้ด้วยตัวเอง</p>
                  <div className="flex gap-2">
                    <button onClick={() => becomeSeller.mutate()} disabled={becomeSeller.isPending}
                      className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700 transition disabled:opacity-50">
                      <Tractor size={14} />
                      {becomeSeller.isPending ? 'กำลังเปลี่ยน...' : 'ยืนยัน'}
                    </button>
                    <button onClick={() => setConfirmSeller(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                      ยกเลิก
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button onClick={() => {
              setProfileSubmitted(true)
              if (!form.name.trim()) return
              if (form.phone && !/^0[0-9]{8,9}$/.test(form.phone.replace(/[-\s]/g, ''))) return
              updateProfile.mutate()
            }} disabled={updateProfile.isPending}
              className="w-full bg-green-600 text-white px-6 py-3 rounded-lg text-base font-semibold hover:bg-green-700 transition disabled:opacity-50">
              {updateProfile.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </div>
        </div>
      )}

      {tab === 'addresses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-gray-700 text-sm">{addresses?.length ?? 0} ที่อยู่</p>
            <button onClick={() => { closeForm(); setShowForm(true) }} className="flex items-center gap-2 text-green-600 text-sm hover:underline">
              <Plus size={14} /> เพิ่มที่อยู่ใหม่
            </button>
          </div>

          {showForm && (
            <div className="bg-white rounded-xl p-3 sm:p-5 border border-green-200">
              <h3 className="font-semibold text-gray-800 mb-4">{editId ? 'แก้ไขที่อยู่' : 'เพิ่มที่อยู่ใหม่'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* ชื่อผู้รับ + เบอร์โทร */}
                {[{ label: 'ชื่อผู้รับ', key: 'recipient', type: 'text' }, { label: 'เบอร์โทร', key: 'phone', type: 'tel' }].map((f) => (
                  <div key={f.key}>
                    <label className="text-sm text-gray-600 mb-1 block">{f.label} <span className="text-red-500">*</span></label>
                    <input type={f.type} value={addrForm[f.key as keyof typeof emptyAddr] as string}
                      onChange={(e) => setAddrForm({ ...addrForm, [f.key]: e.target.value })}
                      className={inputCls(fieldInvalid(f.key))} />
                    {fieldInvalid(f.key) && <p className="text-red-500 text-sm mt-0.5">กรุณากรอก{f.label}</p>}
                  </div>
                ))}

                {/* ที่อยู่ */}
                <div className="col-span-1 md:col-span-2">
                  <label className="text-sm text-gray-600 mb-1 block">ที่อยู่ <span className="text-red-500">*</span></label>
                  <input value={addrForm.address} onChange={(e) => setAddrForm({ ...addrForm, address: e.target.value })}
                    className={inputCls(fieldInvalid('address'))} />
                  {fieldInvalid('address') && <p className="text-red-500 text-sm mt-0.5">กรุณากรอกที่อยู่</p>}
                </div>

                {/* จังหวัด */}
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">จังหวัด <span className="text-red-500">*</span></label>
                  <select value={addrForm.province} onChange={(e) => handleProvinceChange(e.target.value)} className={selectCls(fieldInvalid('province'))}>
                    <option value="">-- เลือกจังหวัด --</option>
                    {provinces.map((p) => <option key={p.name_th} value={p.name_th}>{p.name_th}</option>)}
                  </select>
                  {fieldInvalid('province') && <p className="text-red-500 text-sm mt-0.5">กรุณาเลือกจังหวัด</p>}
                </div>

                {/* เขต/อำเภอ */}
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">เขต/อำเภอ <span className="text-red-500">*</span></label>
                  <select value={addrForm.district} onChange={(e) => handleDistrictChange(e.target.value)}
                    disabled={!selectedProvince}
                    className={selectCls(fieldInvalid('district')) + (!selectedProvince ? ' opacity-50 cursor-not-allowed' : '')}>
                    <option value="">-- เลือกเขต/อำเภอ --</option>
                    {selectedProvince?.districts.map((d) => <option key={d.name_th} value={d.name_th}>{d.name_th}</option>)}
                  </select>
                  {fieldInvalid('district') && <p className="text-red-500 text-sm mt-0.5">กรุณาเลือกเขต/อำเภอ</p>}
                </div>

                {/* แขวง/ตำบล */}
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">แขวง/ตำบล <span className="text-red-500">*</span></label>
                  <select value={addrForm.subdistrict} onChange={(e) => handleSubdistrictChange(e.target.value)}
                    disabled={!selectedDistrict}
                    className={selectCls(fieldInvalid('subdistrict')) + (!selectedDistrict ? ' opacity-50 cursor-not-allowed' : '')}>
                    <option value="">-- เลือกแขวง/ตำบล --</option>
                    {selectedDistrict?.subdistricts.map((s) => <option key={s.name_th} value={s.name_th}>{s.name_th}</option>)}
                  </select>
                  {fieldInvalid('subdistrict') && <p className="text-red-500 text-sm mt-0.5">กรุณาเลือกแขวง/ตำบล</p>}
                </div>

                {/* รหัสไปรษณีย์ */}
                <div>
                  <label className="text-sm text-gray-600 mb-1 block">รหัสไปรษณีย์ <span className="text-red-500">*</span></label>
                  <input value={addrForm.zipCode} readOnly placeholder="กรอกอัตโนมัติเมื่อเลือกตำบล"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600 cursor-not-allowed" />
                </div>

                {/* Default */}
                <div className="col-span-1 md:col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="isDefault" checked={addrForm.isDefault}
                    onChange={(e) => setAddrForm({ ...addrForm, isDefault: e.target.checked })}
                    className="accent-green-600" />
                  <label htmlFor="isDefault" className="text-sm text-gray-600">ตั้งเป็นที่อยู่หลัก</label>
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={handleSubmit} disabled={isPending}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50">
                  {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
                <button onClick={closeForm} className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
                  ยกเลิก
                </button>
              </div>
            </div>
          )}

          {addresses?.map((addr) => (
            <div key={addr.id} className="bg-white rounded-xl p-3 sm:p-5 border border-gray-100 flex justify-between items-start">
              <div>
                {addr.isDefault && <span className="text-sm bg-green-100 text-green-700 px-2 py-0.5 rounded-full mb-2 inline-block">หลัก</span>}
                <p className="font-medium text-gray-800">{addr.recipient} · {addr.phone}</p>
                <p className="text-sm text-gray-600 mt-1">{addr.address}, {addr.subdistrict}, {addr.district}, {addr.province} {addr.zipCode}</p>
              </div>
              <div className="flex gap-3 ml-4 mt-0.5">
                <button onClick={() => handleEdit(addr)} className="text-gray-500 hover:text-green-600 transition"><Pencil size={16} /></button>
                <button onClick={() => deleteAddress.mutate(addr.id)} className="text-gray-500 hover:text-red-600 transition"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'farms' && (
        <div className="space-y-6">
          {/* Pending invitations */}
          {invitations.length > 0 && (
            <div className="bg-white rounded-xl border border-orange-100 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-orange-100 bg-orange-50 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                <span className="font-semibold text-orange-700">คำเชิญที่รอการตอบรับ</span>
                <span className="ml-auto text-sm text-orange-500">{invitations.length} รายการ</span>
              </div>
              <div className="divide-y divide-gray-50">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-green-100 flex-shrink-0 flex items-center justify-center text-2xl">
                      {inv.farm.image
                        ? <Image src={inv.farm.image} alt={inv.farm.name} fill sizes="80px" className="object-cover" />
                        : '🌾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{inv.farm.name}</p>
                      {inv.farm.province && <p className="text-sm text-gray-500">{inv.farm.province}</p>}
                      {inv.inviter && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          เชิญโดย <span className="text-gray-700">{inv.inviter.name}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => declineInvitation.mutate(inv.id)}
                        disabled={declineInvitation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
                      >
                        <X size={14} /> ปฏิเสธ
                      </button>
                      <button
                        onClick={() => acceptInvitation.mutate(inv.id)}
                        disabled={acceptInvitation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                      >
                        <Check size={14} /> ตอบรับ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accepted memberships */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
              <Store size={16} className="text-gray-600" />
              <span className="font-semibold text-gray-800">ฟาร์มที่จัดการอยู่</span>
              <span className="ml-auto text-sm text-gray-500">{memberships.length} ฟาร์ม</span>
            </div>
            {memberships.length === 0 ? (
              <div className="text-center py-14">
                <Store size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500">ยังไม่ได้เป็นแอดมินฟาร์มใด</p>
                <p className="text-sm text-gray-300 mt-1">เมื่อได้รับคำเชิญและตอบรับแล้วจะแสดงที่นี่</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {memberships.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-4">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-green-100 flex-shrink-0 flex items-center justify-center text-2xl">
                      {m.farm.image
                        ? <Image src={m.farm.image} alt={m.farm.name} fill sizes="80px" className="object-cover" />
                        : '🌾'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">{m.farm.name}</p>
                      {m.farm.province && <p className="text-sm text-gray-500">{m.farm.province}</p>}
                      <span className="text-sm px-2 py-0.5 rounded-full bg-green-50 text-green-600 mt-1 inline-block">แอดมินฟาร์ม</span>
                    </div>
                    <Link
                      href="/seller/dashboard"
                      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <Store size={14} /> จัดการฟาร์ม
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setCropFile(null)}
        />
      )}
    </div>
  )
}
