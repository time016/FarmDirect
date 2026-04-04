'use client'
import { useState, useRef } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'

interface Props {
  currentImage?: string | null
  onUploaded: (url: string) => void
  height?: string
  width?: string
}

export default function ImageUpload({ currentImage, onUploaded, height = 'h-56', width = 'w-full' }: Props) {
  const [preview, setPreview] = useState<string>(currentImage || '')
  const [loading, setLoading] = useState(false)
  const [hovered, setHovered] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setLoading(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      const { data } = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      onUploaded(data.url)
    } catch {
      toast.error('อัปโหลดไม่สำเร็จ')
      setPreview(currentImage || '')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`relative ${width} ${height} cursor-pointer overflow-hidden bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 hover:border-green-400 transition`}
      onClick={() => !loading && inputRef.current?.click()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Background image */}
      {preview ? (
        <img src={preview} alt="cover" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-500">
          <Camera size={width === 'w-24' ? 20 : 36} />
          {width !== 'w-24' && <span className="text-sm">คลิกเพื่ออัปโหลดรูป</span>}
        </div>
      )}

      {/* Hover overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-2 transition-all duration-200"
        style={{ backgroundColor: hovered ? 'rgba(0,0,0,0.45)' : 'transparent' }}
      >
        {loading ? (
          <Loader2 size={28} className="text-white animate-spin" />
        ) : hovered ? (
          <>
            <Camera size={width === 'w-24' ? 16 : 28} className="text-white drop-shadow" />
            {width !== 'w-24' && <span className="text-white text-sm font-semibold drop-shadow">เปลี่ยนรูป</span>}
          </>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  )
}
