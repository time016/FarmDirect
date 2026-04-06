'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Trash2, Play, Globe, Video, ExternalLink, CircleAlert, RefreshCw, AlertTriangle } from 'lucide-react'

interface SubdistrictOption { name_th: string; postal_code: number }
interface DistrictOption { name_th: string; subdistricts: SubdistrictOption[] }
interface ProvinceOption { name_th: string; districts: DistrictOption[] }

const MAX_IMAGES = 5

function detectVideoType(url: string): 'youtube' | 'facebook' | 'tiktok' | 'other' {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube'
  if (/facebook\.com/.test(url)) return 'facebook'
  if (/tiktok\.com/.test(url)) return 'tiktok'
  return 'other'
}

const videoTypeLabel: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  youtube: { label: 'YouTube', icon: <Play size={14} />, color: 'text-red-500' },
  facebook: { label: 'Facebook', icon: <Globe size={14} />, color: 'text-blue-600' },
  tiktok: { label: 'TikTok', icon: <Video size={14} />, color: 'text-gray-700' },
  other: { label: 'Video', icon: <Video size={14} />, color: 'text-gray-600' },
}

const selectCls = (disabled: boolean) =>
  `w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white ${disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`

export default function EditFarmClient({ provinces }: { provinces: ProvinceOption[] }) {
  const { user, isAuthenticated } = useAuthStore()
  const qc = useQueryClient()
  const isOwner = user?.role === 'SELLER' || (user?.role === 'ADMIN' || user?.role === 'HOST')
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', location: '', province: '', district: '', subdistrict: '', zipCode: '',
    images: [] as string[],
    videos: [] as string[],
  })
  const [initialized, setInitialized] = useState(false)

  const { data: farm, isLoading } = useQuery({
    queryKey: ['my-farm'],
    queryFn: () => api.get('/farms/my').then((r) => r.data),
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (farm && !initialized) {
      const imgs: string[] = Array.isArray(farm.images) && farm.images.length > 0
        ? farm.images
        : farm.image ? [farm.image] : []
      setForm({
        name: farm.name ?? '',
        description: farm.description ?? '',
        location: farm.location ?? '',
        province: farm.province ?? '',
        district: farm.district ?? '',
        subdistrict: farm.subdistrict ?? '',
        zipCode: farm.zipCode ?? '',
        images: imgs,
        videos: Array.isArray(farm.videos) ? farm.videos : [],
      })
      setInitialized(true)
    }
  }, [farm, initialized])

  const selectedProvince = useMemo(() => provinces.find((p) => p.name_th === form.province) ?? null, [form.province, provinces])
  const selectedDistrict = useMemo(() => selectedProvince?.districts.find((d) => d.name_th === form.district) ?? null, [selectedProvince, form.district])

  const handleProvinceChange = (value: string) => setForm((f) => ({ ...f, province: value, district: '', subdistrict: '', zipCode: '' }))
  const handleDistrictChange = (value: string) => setForm((f) => ({ ...f, district: value, subdistrict: '', zipCode: '' }))
  const handleSubdistrictChange = (value: string) => {
    const sub = selectedDistrict?.subdistricts.find((s) => s.name_th === value)
    setForm((f) => ({ ...f, subdistrict: value, zipCode: sub?.postal_code ? String(sub.postal_code) : '' }))
  }

  const updateFarm = useMutation({
    mutationFn: () => api.put('/farms', {
      name: form.name,
      description: form.description,
      location: form.location,
      province: form.province,
      district: form.district,
      subdistrict: form.subdistrict,
      zipCode: form.zipCode,
      image: form.images[0] ?? null,
      images: form.images,
      videos: form.videos,
    }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-farm'] })
      toast.success('บันทึกข้อมูลฟาร์มแล้ว')
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const resubmit = useMutation({
    mutationFn: () => api.post('/farms/resubmit'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-farm'] }); toast.success('ยื่นขออนุมัติใหม่แล้ว') },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  })

  const handleAddImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const remaining = MAX_IMAGES - form.images.length
    if (remaining <= 0) { toast.error(`อัปโหลดได้สูงสุด ${MAX_IMAGES} รูป`); return }
    const toUpload = files.slice(0, remaining)
    setUploading(true)
    try {
      const urls: string[] = []
      for (const file of toUpload) {
        const fd = new FormData()
        fd.append('image', file)
        const { data } = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        urls.push(data.url)
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }))
      toast.success(`อัปโหลด ${urls.length} รูปสำเร็จ`)
    } catch {
      toast.error('อัปโหลดล้มเหลว')
    } finally {
      setUploading(false)
      if (imageInputRef.current) imageInputRef.current.value = ''
    }
  }

  const removeImage = (idx: number) => setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== idx) }))
  const addVideo = () => {
    const url = newVideoUrl.trim()
    if (!url) return
    if (form.videos.includes(url)) { toast.error('มีลิงก์นี้แล้ว'); return }
    setForm((prev) => ({ ...prev, videos: [...prev.videos, url] }))
    setNewVideoUrl('')
  }
  const removeVideo = (idx: number) => setForm((prev) => ({ ...prev, videos: prev.videos.filter((_, i) => i !== idx) }))

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-600">ข้อมูลฟาร์ม</h1>

      {farm?.isSuspended && (
        <div className="border rounded-xl p-5 space-y-3 bg-orange-50 border-orange-200">
          <div className="flex items-start gap-2">
            <CircleAlert size={18} className="mt-0.5 flex-shrink-0 text-orange-500" />
            <p className="font-semibold text-orange-700">ฟาร์มถูกระงับการใช้งาน</p>
          </div>
          <p className="text-sm text-orange-500">กรุณาแก้ไขข้อมูลฟาร์มตามที่แจ้ง แล้วยื่นขออนุมัติใหม่พร้อมชี้แจง</p>
          <button
            onClick={() => resubmit.mutate()}
            disabled={resubmit.isPending}
            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition disabled:opacity-60"
          >
            <RefreshCw size={14} className={resubmit.isPending ? 'animate-spin' : ''} />
            ยื่นขออนุมัติใหม่
          </button>
        </div>
      )}

      {farm && !farm.isVerified && !farm.isSuspended && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-yellow-500 flex-shrink-0" />
          <p className="text-sm text-yellow-700">ฟาร์มของคุณอยู่ระหว่างรอการตรวจสอบจาก Admin</p>
        </div>
      )}

      {!isOwner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          คุณมีสิทธิ์ดูข้อมูลเท่านั้น เฉพาะเจ้าของฟาร์มสามารถแก้ไขได้
        </div>
      )}

      {/* ข้อมูลทั่วไป */}
      <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-100 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-600">ข้อมูลทั่วไป</h2>
          {farm?.id && (
            <Link href={`/farms/${farm.slug ?? farm.id}`} target="_blank"
              className="flex items-center gap-1.5 text-sm font-semibold text-green-700 bg-green-100 hover:bg-green-200 transition px-3 py-1.5 rounded-full">
              <ExternalLink size={13} /> ดูหน้าฟาร์ม
            </Link>
          )}
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">ชื่อฟาร์ม</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            disabled={!isOwner} className={inputCls} />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">คำอธิบายฟาร์ม</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            disabled={!isOwner} rows={4} placeholder="เล่าเกี่ยวกับฟาร์มของคุณ..."
            className={`${inputCls} resize-none`} />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">ที่ตั้ง (เลขที่ / หมู่บ้าน)</label>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            disabled={!isOwner} placeholder="เช่น 123 หมู่ 5"
            className={inputCls} />
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">จังหวัด</label>
          <select value={form.province} onChange={(e) => handleProvinceChange(e.target.value)}
            disabled={!isOwner} className={selectCls(!isOwner)}>
            <option value="">เลือกจังหวัด</option>
            {provinces.map((p) => <option key={p.name_th} value={p.name_th}>{p.name_th}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">อำเภอ / เขต</label>
          <select value={form.district} onChange={(e) => handleDistrictChange(e.target.value)}
            disabled={!isOwner || !selectedProvince} className={selectCls(!isOwner || !selectedProvince)}>
            <option value="">เลือกอำเภอ / เขต</option>
            {selectedProvince?.districts.map((d) => <option key={d.name_th} value={d.name_th}>{d.name_th}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">ตำบล / แขวง</label>
          <select value={form.subdistrict} onChange={(e) => handleSubdistrictChange(e.target.value)}
            disabled={!isOwner || !selectedDistrict} className={selectCls(!isOwner || !selectedDistrict)}>
            <option value="">เลือกตำบล / แขวง</option>
            {selectedDistrict?.subdistricts.map((s) => <option key={s.name_th} value={s.name_th}>{s.name_th}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-gray-600 mb-1 block">รหัสไปรษณีย์</label>
          <input value={form.zipCode} readOnly
            className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm bg-gray-50 text-gray-600" />
        </div>
      </div>

      {/* Image Manager */}
      <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-600">รูปภาพฟาร์ม</h2>
            <p className="text-sm text-gray-500 mt-0.5">รูปแรกจะเป็นรูปหน้าปก · สูงสุด {MAX_IMAGES} รูป</p>
          </div>
          {isOwner && <span className="text-sm text-gray-500">{form.images.length}/{MAX_IMAGES}</span>}
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {form.images.map((url, idx) => (
            <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
              <Image src={url} alt={`farm-${idx}`} fill sizes="(max-width:640px) 33vw, 20vw" className="object-cover" />
              {idx === 0 && (
                <span className="absolute top-1 left-1 bg-green-600 text-white text-[10px] px-1.5 py-0.5 rounded font-medium">หน้าปก</span>
              )}
              {isOwner && (
                <button onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          ))}
          {isOwner && form.images.length < MAX_IMAGES && (
            <button onClick={() => imageInputRef.current?.click()} disabled={uploading}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-300 hover:border-green-400 flex flex-col items-center justify-center text-gray-500 hover:text-green-500 transition disabled:opacity-50">
              {uploading
                ? <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                : <><Plus size={20} /><span className="text-[10px] mt-1">เพิ่มรูป</span></>}
            </button>
          )}
        </div>
        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleAddImages} />
      </div>

      {/* Video Links */}
      <div className="bg-white rounded-xl p-3 sm:p-6 border border-gray-100 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-600">วิดีโอแนะนำฟาร์ม</h2>
          <p className="text-sm text-gray-500 mt-0.5">รองรับ YouTube, Facebook, TikTok</p>
        </div>
        {form.videos.map((url, idx) => {
          const type = detectVideoType(url)
          const meta = videoTypeLabel[type]
          return (
            <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5">
              <span className={`flex items-center gap-1 text-sm font-medium flex-shrink-0 ${meta.color}`}>{meta.icon} {meta.label}</span>
              <span className="text-sm text-gray-700 truncate flex-1">{url}</span>
              {isOwner && (
                <button onClick={() => removeVideo(idx)} className="text-gray-500 hover:text-red-500 transition flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )
        })}
        {form.videos.length === 0 && <p className="text-sm text-gray-500">ยังไม่มีวิดีโอ</p>}
        {isOwner && (
          <div className="flex gap-2">
            <input value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addVideo()}
              placeholder="วางลิงก์ YouTube / Facebook / TikTok"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button onClick={addVideo} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition font-medium">เพิ่ม</button>
          </div>
        )}
      </div>

      {/* Save */}
      <div className="flex items-center gap-4">
        {isOwner && (
          <button onClick={() => updateFarm.mutate()} disabled={updateFarm.isPending}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition disabled:opacity-50">
            {updateFarm.isPending ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        )}
        {farm?.status && (
          <span className={`text-sm px-3 py-1.5 rounded-full font-medium ${
            farm.status === 'verified' ? 'bg-green-100 text-green-700'
            : farm.status === 'pending' ? 'bg-yellow-100 text-yellow-700'
            : 'bg-red-100 text-red-600'
          }`}>
            {farm.status === 'verified' ? 'อนุมัติแล้ว' : farm.status === 'pending' ? 'รอการอนุมัติ' : 'ถูกปฏิเสธ'}
          </span>
        )}
      </div>
    </div>
  )
}
